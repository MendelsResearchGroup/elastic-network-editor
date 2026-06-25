import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

// @ts-expect-error OrbitControls does not expose declarations through this path.
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { useLammps } from "./useLammps";
import type { SimulationScriptSpec, StepFrame } from "./useLammps";
import { BaseButton } from "./BaseButton";
import {
  boxDimensionsFromLengths,
  calculateBoxMeasurement,
  type BoxDimensions,
} from "./poisson";

type BondsView = { count: number; p1: Float32Array; p2: Float32Array };
type Frame = {
  pos: Float32Array;
  bondsPacked: Float32Array;
  bondCount: number;
  boxOutline: Float32Array;
  boxSurface: Float32Array;
  box: BoxDimensions | null;
};
type Canvas2DState = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr: number;
};

const BG = 0xffffff;
const ATOM = 0x2563eb;
const BOND = 0x334155;
const BOX = 0x1f2937;

type ChartPoint = {
  frameIndex: number;
  poissonRatio: number;
};

function formatMeasurement(value: number | null) {
  return value === null ? "Unavailable" : value.toPrecision(4);
}

function PoissonChart({
  points,
  selectedFrame,
}: {
  points: ChartPoint[];
  selectedFrame: number;
}) {
  const width = 560;
  const height = 150;
  const padX = 42;
  const padY = 18;

  if (!points.length) {
    return (
      <div className="h-[150px] grid place-items-center border border-slate-200 text-sm text-slate-500">
        Poisson ratio becomes available after horizontal strain develops.
      </div>
    );
  }

  const minFrame = points[0].frameIndex;
  const maxFrame = points[points.length - 1].frameIndex;
  const ratios = points.map((point) => point.poissonRatio);
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  const frameRange = Math.max(1, maxFrame - minFrame);
  const ratioRange = Math.max(1e-9, maxRatio - minRatio);
  const x = (frameIndex: number) =>
    padX + ((frameIndex - minFrame) / frameRange) * (width - 2 * padX);
  const y = (ratio: number) =>
    height - padY - ((ratio - minRatio) / ratioRange) * (height - 2 * padY);
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.frameIndex)} ${y(
          point.poissonRatio
        )}`
    )
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-[150px] border border-slate-200 bg-white"
      role="img"
      aria-label="Poisson ratio by simulation frame"
    >
      <line
        x1={padX}
        y1={height - padY}
        x2={width - padX}
        y2={height - padY}
        stroke="#cbd5e1"
      />
      <line
        x1={padX}
        y1={padY}
        x2={padX}
        y2={height - padY}
        stroke="#cbd5e1"
      />
      <path d={path} fill="none" stroke="#0f766e" strokeWidth="2" />
      {points.map((point) => {
        const selected = point.frameIndex === selectedFrame;
        return (
          <circle
            key={point.frameIndex}
            cx={x(point.frameIndex)}
            cy={y(point.poissonRatio)}
            r={selected ? 5 : 2.5}
            fill={selected ? "#dc2626" : "#0f766e"}
          />
        );
      })}
      <text x={width / 2} y={height - 3} textAnchor="middle" fontSize="10">
        Frame
      </text>
      <text x={4} y={12} fontSize="10">
        {maxRatio.toPrecision(4)}
      </text>
      <text x={4} y={height - padY} fontSize="10">
        {minRatio.toPrecision(4)}
      </text>
    </svg>
  );
}

export default function Simulation({
  network,
  isOpen,
  autoPlay = true,
  script,
}: {
  network: string;
  isOpen: boolean;
  autoPlay?: boolean;
  script: SimulationScriptSpec;
}) {
  const logLammps = useCallback((...args: unknown[]) => {
    console.log("[LAMMPS]", ...args);
  }, []);

  const { ready, running, start, stop, reset, setNetwork, setOnStep } =
    useLammps(logLammps, network, script);

  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{
    r: THREE.WebGLRenderer;
    cam: THREE.OrthographicCamera;
    s: THREE.Scene;
    atoms: THREE.InstancedMesh;
    bonds: THREE.LineSegments;
    boxOutline: THREE.LineLoop;
    boxSurface: THREE.Mesh;
    controls: OrbitControls;
  } | null>(null);
  const canvas2d = useRef<Canvas2DState | null>(null);

  const rafRender = useRef<number>(0);
  const scrubbing = useRef(false);
  const followLive = useRef(true);
  const autoResumeRef = useRef(autoPlay);
  const lastStep = useRef<number>(-1);
  const isOpenRef = useRef(isOpen);
  const hasFramedView = useRef(false);

  const frames = useRef<Frame[]>([]);
  const frameIdx = useRef(0);
  const [frameCount, setFrameCount] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const frameInputRef = useRef<HTMLInputElement>(null);
  const frameLabelRef = useRef<HTMLSpanElement>(null);
  const prevScriptId = useRef(script.id);

  const updateScrubberUi = useCallback(() => {
    if (frameInputRef.current) {
      frameInputRef.current.max = Math.max(0, frames.current.length - 1).toString();
      frameInputRef.current.value = frameIdx.current.toString();
    }
    if (frameLabelRef.current) {
      frameLabelRef.current.textContent = frames.current.length
        ? `${frameIdx.current + 1}/${frames.current.length}`
        : "—";
    }
  }, []);

  const clearRenderedFrame = useCallback(() => {
    if (three.current) {
      drawAtoms(new Float32Array(0));
      drawBondsPacked(new Float32Array(0), 0);
      drawBoxOutline(new Float32Array(0), three.current.boxOutline);
      drawBoxSurface(new Float32Array(0), three.current.boxSurface);
    } else if (canvas2d.current) {
      drawFallback2D(new Float32Array(0), new Float32Array(0), 0, new Float32Array(0));
    }
  }, []);

  const resetViewerState = useCallback(() => {
    frames.current = [];
    frameIdx.current = 0;
    setFrameCount(0);
    setSelectedFrame(0);
    followLive.current = true;
    scrubbing.current = false;
    lastStep.current = -1;
    hasFramedView.current = false;
    if (frameInputRef.current) {
      frameInputRef.current.value = "0";
    }
    clearRenderedFrame();
    updateScrubberUi();
  }, [clearRenderedFrame, updateScrubberUi]);

  const handleRun = useCallback(() => {
    autoResumeRef.current = true;
    start();
  }, [start]);

  const handlePause = useCallback(() => {
    autoResumeRef.current = false;
    stop();
  }, [stop]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    setNetwork().catch((err) => {
      console.error("Failed to sync network with LAMMPS FS", err);
    });
  }, [network, setNetwork]);

  useEffect(() => {
    if (prevScriptId.current === script.id) return;
    prevScriptId.current = script.id;
    resetViewerState();
    autoResumeRef.current = autoPlay;
    reset();
    if (autoResumeRef.current && isOpen) start();
  }, [script.id, autoPlay, isOpen, reset, resetViewerState, start]);

  useEffect(() => {
    if (!isOpen) {
      stop();
      return;
    }

    const mount = host.current;
    if (!mount || three.current || canvas2d.current) return;
    mount.innerHTML = "";

    const viewSize = 8;
    const initWebGL = () => {
      const s = new THREE.Scene();
      s.background = new THREE.Color(BG);

      const r = new THREE.WebGLRenderer({ antialias: true });
      r.setPixelRatio(window.devicePixelRatio || 1);
      r.setSize(550, 550);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;

      const cam = new THREE.OrthographicCamera(
        -viewSize / 2,
        viewSize / 2,
        viewSize / 2,
        -viewSize / 2,
        0.1,
        100
      );
      cam.position.set(0, 0, 10);
      cam.up.set(0, 1, 0);
      cam.lookAt(0, 0, 0);

      mount.appendChild(r.domElement);

      const atoms = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.12, 24, 20),
        new THREE.MeshStandardMaterial({ color: ATOM, metalness: 0.05, roughness: 0.6 }),
        20000
      );
      const bonds = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: BOND, linewidth: 1 })
      );
      const boxOutline = new THREE.LineLoop(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: BOX, linewidth: 1 })
      );
      const boxSurfaceGeometry = new THREE.BufferGeometry();
      boxSurfaceGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
      boxSurfaceGeometry.setIndex([0, 1, 2, 0, 2, 3]);
      const boxSurface = new THREE.Mesh(
        boxSurfaceGeometry,
        new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          transparent: true,
          opacity: 0.22,
          metalness: 0.05,
          roughness: 0.95,
          side: THREE.DoubleSide,
        })
      );
      boxSurface.position.z = -0.02;

      const hemi = new THREE.HemisphereLight(0xffffff, 0x8090a0, 0.7);
      const key = new THREE.DirectionalLight(0xffffff, 0.7);
      key.position.set(2.5, 4, 3);
      const fill = new THREE.DirectionalLight(0xffffff, 0.25);
      fill.position.set(-3, 2, -2);

      const controls = new OrbitControls(cam, r.domElement);
      controls.enableRotate = true;
      controls.minPolarAngle = Math.PI / 2;
      controls.maxPolarAngle = Math.PI / 2;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.zoomSpeed = 1.2;
      controls.panSpeed = 0.6;
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      s.add(hemi, key, fill, boxSurface, atoms, bonds, boxOutline);
      three.current = { r, cam, s, atoms, bonds, boxOutline, boxSurface, controls };

      const render = () => {
        if (!three.current) return;
        controls.update();
        r.render(s, cam);
        rafRender.current = requestAnimationFrame(render);
      };
      render();
    };

    const initCanvas2D = () => {
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const msg = document.createElement("div");
        msg.className = "h-full w-full grid place-items-center text-sm text-slate-500";
        msg.textContent = "Unable to initialize renderer in this browser.";
        mount.appendChild(msg);
        return;
      }
      canvas2d.current = { canvas, ctx, dpr: 1 };
      mount.appendChild(canvas);
    };

    try {
      initWebGL();
    } catch (err) {
      console.error("WebGL init failed, using 2D fallback", err);
      initCanvas2D();
    }

    const onResize = () => {
      const width = Math.min(mount.getBoundingClientRect().width || 480, 640);
      const height = width;
      if (three.current) {
        three.current.r.setSize(width, height, false);
        const aspect = width / height || 1;
        const half = viewSize / 2;
        three.current.cam.left = -half * aspect;
        three.current.cam.right = half * aspect;
        three.current.cam.top = half;
        three.current.cam.bottom = -half;
        three.current.cam.updateProjectionMatrix();
      }
      if (canvas2d.current) {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas2d.current.dpr = dpr;
        canvas2d.current.canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas2d.current.canvas.height = Math.max(1, Math.floor(height * dpr));
      }
    };

    window.addEventListener("resize", onResize);
    onResize();

    if (autoResumeRef.current && autoPlay) start();

    return () => {
      if (rafRender.current) cancelAnimationFrame(rafRender.current);
      window.removeEventListener("resize", onResize);
      if (three.current) {
        three.current.atoms.geometry.dispose();
        (three.current.atoms.material as THREE.Material).dispose();
        three.current.bonds.geometry.dispose();
        (three.current.bonds.material as THREE.Material).dispose();
        three.current.boxOutline.geometry.dispose();
        (three.current.boxOutline.material as THREE.Material).dispose();
        three.current.boxSurface.geometry.dispose();
        (three.current.boxSurface.material as THREE.Material).dispose();
        three.current.controls.dispose();
        three.current.r.dispose();
        three.current.r.domElement.remove();
        three.current = null;
      }
      if (canvas2d.current) {
        canvas2d.current.canvas.remove();
        canvas2d.current = null;
      }
    };
  }, [autoPlay, isOpen, start, stop]);

  const drawAtoms = (pos: Float32Array) => {
    if (!three.current) return;
    const { atoms } = three.current;
    const m = new THREE.Matrix4();
    const n = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const i3 = 3 * i;
      m.makeTranslation(pos[i3], pos[i3 + 1], 0);
      atoms.setMatrixAt(i, m);
    }
    atoms.count = n;
    atoms.instanceMatrix.needsUpdate = true;
  };

  const fitCameraToPositions = (pos: Float32Array) => {
    if (!three.current || pos.length < 3) return;
    const { cam } = three.current;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;
    const width = Math.max(1e-3, maxX - minX);
    const height = Math.max(1e-3, maxY - minY);
    const pad = 1.25;
    const cx = 0.5 * (minX + maxX);
    const cy = 0.5 * (minY + maxY);
    const halfY = 0.5 * height * pad;
    const aspect = (cam.right - cam.left) / Math.max(1e-6, cam.top - cam.bottom);
    const halfX = Math.max(0.5 * width * pad, halfY * aspect);
    cam.left = cx - halfX;
    cam.right = cx + halfX;
    cam.top = cy + halfY;
    cam.bottom = cy - halfY;
    cam.updateProjectionMatrix();
  };

  const drawBondsPacked = (packed: Float32Array, count: number) => {
    if (!three.current) return;
    const { bonds } = three.current;
    const geo = bonds.geometry as THREE.BufferGeometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute | null;
    if (!attr || attr.array.length !== packed.length) {
      geo.setAttribute("position", new THREE.BufferAttribute(packed.slice(), 3));
    } else {
      (attr.array as Float32Array).set(packed);
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
    geo.setDrawRange(0, 2 * count);
    geo.computeBoundingSphere();
  };

  const drawFallback2D = (pos: Float32Array, packed: Float32Array, bondCount: number, boxOutline: Float32Array) => {
    const fallback = canvas2d.current;
    if (!fallback) return;
    const { canvas, ctx, dpr } = fallback;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const scan = (arr: Float32Array) => {
      for (let i = 0; i + 1 < arr.length; i += 3) {
        const x = arr[i];
        const y = arr[i + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    };

    scan(pos);
    if (boxOutline.length) scan(boxOutline);
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;

    const pad = 20;
    const rangeX = Math.max(1e-6, maxX - minX);
    const rangeY = Math.max(1e-6, maxY - minY);
    const scale = Math.min((width - 2 * pad) / rangeX, (height - 2 * pad) / rangeY);
    const offsetX = (width - scale * rangeX) * 0.5 - minX * scale;
    const offsetY = (height - scale * rangeY) * 0.5 + maxY * scale;
    const sx = (x: number) => x * scale + offsetX;
    const sy = (y: number) => offsetY - y * scale;

    if (boxOutline.length >= 12) {
      ctx.beginPath();
      ctx.moveTo(sx(boxOutline[0]), sy(boxOutline[1]));
      for (let i = 3; i + 1 < boxOutline.length; i += 3) {
        ctx.lineTo(sx(boxOutline[i]), sy(boxOutline[i + 1]));
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(241,245,249,0.55)";
      ctx.fill();
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    if (bondCount > 0) {
      ctx.beginPath();
      for (let i = 0; i < bondCount; i++) {
        const i6 = 6 * i;
        ctx.moveTo(sx(packed[i6]), sy(packed[i6 + 1]));
        ctx.lineTo(sx(packed[i6 + 3]), sy(packed[i6 + 4]));
      }
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = "#2563eb";
    for (let i = 0; i + 1 < pos.length; i += 3) {
      ctx.beginPath();
      ctx.arc(sx(pos[i]), sy(pos[i + 1]), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const packBonds = (b: BondsView) => {
    const N = b.count;
    const arr = new Float32Array(6 * N);
    for (let i = 0; i < N; i++) {
      const i3 = 3 * i;
      const i6 = 6 * i;
      arr[i6] = b.p1[i3];
      arr[i6 + 1] = b.p1[i3 + 1];
      arr[i6 + 2] = 0;
      arr[i6 + 3] = b.p2[i3];
      arr[i6 + 4] = b.p2[i3 + 1];
      arr[i6 + 5] = 0;
    }
    return arr;
  };

  const buildBoxCorners = (matrix: Float32Array, origin: Float32Array) => {
    if (!matrix.length || !origin.length) return new Float32Array(0);
    const ax = matrix[0] ?? 0;
    const ay = matrix[1] ?? 0;
    const bx = matrix[3] ?? 0;
    const by = matrix[4] ?? 0;
    const ox = origin[0] ?? 0;
    const oy = origin[1] ?? 0;
    return new Float32Array([
      ox, oy, 0,
      ox + ax, oy + ay, 0,
      ox + ax + bx, oy + ay + by, 0,
      ox + bx, oy + by, 0,
    ]);
  };

  const drawBoxOutline = (outline: Float32Array, line: THREE.LineLoop) => {
    const geo = line.geometry as THREE.BufferGeometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute | null;
    if (!outline.length) {
      if (attr) geo.setDrawRange(0, 0);
      return;
    }
    if (!attr || attr.array.length !== outline.length) {
      geo.setAttribute("position", new THREE.BufferAttribute(outline.slice(), 3));
    } else {
      (attr.array as Float32Array).set(outline);
      attr.needsUpdate = true;
    }
    const updated = geo.getAttribute("position") as THREE.BufferAttribute;
    updated.needsUpdate = true;
    geo.setDrawRange(0, outline.length / 3);
    geo.computeBoundingSphere();
  };

  const drawBoxSurface = (corners: Float32Array, mesh: THREE.Mesh) => {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute | null;
    if (!corners.length) {
      if (attr) geo.setDrawRange(0, 0);
      return;
    }
    const desired = corners.length;
    if (!attr || attr.array.length !== desired) {
      const updated = corners.slice() as Float32Array;
      for (let i = 2; i < updated.length; i += 3) updated[i] = -0.02;
      geo.setAttribute("position", new THREE.BufferAttribute(updated, 3));
    } else {
      const arr = attr.array as Float32Array;
      arr.set(corners);
      for (let i = 2; i < arr.length; i += 3) arr[i] = -0.02;
      attr.needsUpdate = true;
    }
    geo.setDrawRange(0, 6);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };

  useEffect(() => {
    updateScrubberUi();
  }, [updateScrubberUi]);

  useEffect(() => {
    if (!running || !isOpen) return;
    resetViewerState();
  }, [running, isOpen, resetViewerState]);

  const handleStep = useCallback((stepFrame: StepFrame) => {
    if (!isOpenRef.current || (!three.current && !canvas2d.current)) return;
    if (stepFrame.step === lastStep.current) return;
    lastStep.current = stepFrame.step;
    if (!stepFrame.positions.length) return;

    if (three.current && !hasFramedView.current) {
      fitCameraToPositions(stepFrame.positions);
      hasFramedView.current = true;
    }

    const bondsView: BondsView = {
      count: stepFrame.bondCount,
      p1: stepFrame.p1,
      p2: stepFrame.p2,
    };
    const bondsPacked = stepFrame.bondCount ? packBonds(bondsView) : new Float32Array(0);
    const boxCorners = buildBoxCorners(stepFrame.matrix, stepFrame.origin);
    const boxOutline = boxCorners.length ? Float32Array.from(boxCorners) : new Float32Array(0);
    const boxSurface = boxCorners.length ? Float32Array.from(boxCorners) : new Float32Array(0);

    if (!scrubbing.current) {
      if (three.current) {
        drawAtoms(stepFrame.positions);
        drawBondsPacked(bondsPacked, stepFrame.bondCount);
        drawBoxOutline(boxOutline, three.current.boxOutline);
        drawBoxSurface(boxSurface, three.current.boxSurface);
      } else {
        drawFallback2D(stepFrame.positions, bondsPacked, stepFrame.bondCount, boxOutline);
      }
    }

    frames.current.push({
      pos: stepFrame.positions,
      bondsPacked,
      bondCount: stepFrame.bondCount,
      boxOutline,
      boxSurface,
      box: boxDimensionsFromLengths(stepFrame.lengths),
    });

    if (followLive.current && !scrubbing.current) {
      frameIdx.current = frames.current.length - 1;
      setSelectedFrame(frameIdx.current);
    }
    setFrameCount(frames.current.length);
    updateScrubberUi();
  }, [updateScrubberUi]);

  useEffect(() => {
    setOnStep(handleStep);
    return () => setOnStep(null);
  }, [handleStep, setOnStep]);

  const onScrubStart = () => {
    scrubbing.current = true;
    followLive.current = false;
  };

  const onScrubEnd = () => {
    scrubbing.current = false;
  };

  const drawFrameIdx = useCallback((idx: number) => {
    if ((!three.current && !canvas2d.current) || !frames.current.length) return;
    const clamped = Math.max(0, Math.min(idx, frames.current.length - 1));
    frameIdx.current = clamped;
    setSelectedFrame(clamped);
    const f = frames.current[clamped];
    if (three.current) {
      drawAtoms(f.pos);
      drawBondsPacked(f.bondsPacked, f.bondCount);
      drawBoxOutline(f.boxOutline, three.current.boxOutline);
      drawBoxSurface(f.boxSurface, three.current.boxSurface);
    } else {
      drawFallback2D(f.pos, f.bondsPacked, f.bondCount, f.boxOutline);
    }
    updateScrubberUi();
  }, [updateScrubberUi]);

  const visibleFrames = frames.current.slice(0, frameCount);
  const referenceBox =
    visibleFrames.find((frame) => frame.box)?.box ?? null;
  const selectedBox = visibleFrames[selectedFrame]?.box ?? null;
  const selectedMeasurement =
    referenceBox && selectedBox
      ? calculateBoxMeasurement(referenceBox, selectedBox)
      : null;
  const chartPoints: ChartPoint[] =
    !referenceBox
      ? []
      : visibleFrames.flatMap((frame, index) => {
          if (!frame.box) return [];
          const measurement = calculateBoxMeasurement(referenceBox, frame.box);
          return measurement?.poissonRatio === null || !measurement
            ? []
            : [{ frameIndex: index, poissonRatio: measurement.poissonRatio }];
        });

  return (
    <div className="border rounded p-3 flex flex-col gap-3 bg-white">
      <div className="flex items-center gap-3">
        <BaseButton
          variant="primary"
          disabled={!ready || running}
          onClick={handleRun}
          title={ready ? "Run simulation" : "Initializing..."}
        >
          Run
        </BaseButton>

        <BaseButton
          variant="ghost"
          disabled={!running}
          onClick={handlePause}
          title={running ? "Stop simulation" : "Not running"}
        >
          Pause
        </BaseButton>

        <input
          ref={frameInputRef}
          type="range"
          min={0}
          max={0}
          defaultValue={0}
          onChange={(e) => drawFrameIdx(+e.target.value)}
          onMouseDown={onScrubStart}
          onMouseUp={onScrubEnd}
          onTouchStart={onScrubStart}
          onTouchEnd={onScrubEnd}
          className="flex-1 accent-slate-900 cursor-pointer"
        />
        <span ref={frameLabelRef} className="text-xs w-16 text-right tabular-nums">—</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 min-h-0">
        <div ref={host} className="w-full aspect-square" />

        <div className="flex flex-col gap-3 min-w-0">
          <section className="border border-slate-200 p-3">
            <h3 className="text-sm font-semibold mb-2">Box analysis</h3>
            {selectedBox ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500">Width</dt>
                <dd className="text-right font-mono">
                  {selectedBox.width.toPrecision(4)}
                </dd>
                <dt className="text-slate-500">Height</dt>
                <dd className="text-right font-mono">
                  {selectedBox.height.toPrecision(4)}
                </dd>
                <dt className="text-slate-500">Axial strain</dt>
                <dd className="text-right font-mono">
                  {selectedMeasurement
                    ? selectedMeasurement.axialStrain.toPrecision(4)
                    : "Unavailable"}
                </dd>
                <dt className="text-slate-500">Transverse strain</dt>
                <dd className="text-right font-mono">
                  {selectedMeasurement
                    ? selectedMeasurement.transverseStrain.toPrecision(4)
                    : "Unavailable"}
                </dd>
                <dt className="text-slate-500">Poisson ratio</dt>
                <dd className="text-right font-mono font-semibold">
                  {formatMeasurement(
                    selectedMeasurement?.poissonRatio ?? null
                  )}
                </dd>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">
                Box measurements are not available for this frame.
              </p>
            )}
          </section>

          <section className="border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold">Poisson ratio</h3>
              <span className="text-xs text-slate-500">
                Frame {frameCount ? selectedFrame + 1 : 0}
              </span>
            </div>
            <PoissonChart
              points={chartPoints}
              selectedFrame={selectedFrame}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
