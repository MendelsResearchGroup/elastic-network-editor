import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { useLammps } from "./useLammps";
import type { SimulationScriptSpec } from "./useLammps";
import { BaseButton } from "./BaseButton";


type BondsView = { count: number; p1: Float32Array; p2: Float32Array };
type Frame = {
  pos: Float32Array;
  bondsPacked: Float32Array;
  bondCount: number;
  boxOutline: Float32Array;
  boxSurface: Float32Array;
};

const BG = 0xffffff;
const ATOM = 0x2563eb;
const BOND = 0x334155;
const BOX = 0x1f2937;

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
  const { ready, running, start, stop, readPositions, readBonds, runFrames, readBox, setNetwork } =
    useLammps(() => {}, network, script);

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

  const rafRender = useRef<number>(0);
  const rafTick = useRef<number>(0);
  const scrubbing = useRef(false);
  const followLive = useRef(true);
  const autoResumeRef = useRef(autoPlay);

  const frames = useRef<Frame[]>([]);
  const frameIdx = useRef(0);
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
  const handleRun = useCallback(() => {
    autoResumeRef.current = true;
    start();
  }, [start]);
  const handlePause = useCallback(() => {
    autoResumeRef.current = false;
    stop();
  }, [stop]);

  useEffect(() => {
    setNetwork().catch((err) => {
      console.error("Failed to sync network with LAMMPS FS", err);
    });
  }, [network, setNetwork]);
  useEffect(() => {
    if (prevScriptId.current === script.id) return;
    prevScriptId.current = script.id;
    frames.current = [];
    frameIdx.current = 0;
    followLive.current = true;
    if (frameInputRef.current) frameInputRef.current.value = "0";
    updateScrubberUi();
    autoResumeRef.current = autoPlay;
    stop();
    if (autoResumeRef.current && isOpen) {
      start();
    }
  }, [script.id, autoPlay, isOpen, start, stop]);
  useEffect(() => {
    if (!isOpen) {
      stop();
      return;
    }

    if (!host.current || three.current) return;

    const s = new THREE.Scene();
    s.background = new THREE.Color(BG);

    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(window.devicePixelRatio || 1);
    r.setSize(550, 550);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;

    const viewSize = 8;
    const cam = new THREE.OrthographicCamera(-viewSize / 2, viewSize / 2, viewSize / 2, -viewSize / 2, 0.1, 100);
    cam.position.set(0, 0, 10);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);

    host.current.innerHTML = "";
    host.current.appendChild(r.domElement);

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
    boxSurfaceGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(12), 3)
    );
    boxSurfaceGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    const boxSurfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      transparent: true,
      opacity: 0.22,
      metalness: 0.05,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const boxSurface = new THREE.Mesh(boxSurfaceGeometry, boxSurfaceMaterial);
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
      controls.update();
      r.render(s, cam);
      rafRender.current = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      if (!host.current || !three.current) return;
      const width = Math.min(host.current.getBoundingClientRect().width || 480, 640);
      const height = width;
      three.current.r.setSize(width, height, false);

      const aspect = width / height || 1;
      const half = viewSize / 2;
      three.current.cam.left = -half * aspect;
      three.current.cam.right = half * aspect;
      three.current.cam.top = half;
      three.current.cam.bottom = -half;
      three.current.cam.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    onResize();

    if (autoResumeRef.current && autoPlay) {
      start();
    }

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
    };
  }, [autoPlay, isOpen, start, stop]);

  const drawAtoms = (pos: Float32Array) => {
    if (!three.current) return;
    const { atoms } = three.current;
    const m = new THREE.Matrix4();
    const n = pos.length / 3;
    for (let i = 0; i < n; i++) {
      const i3 = 3 * i;
      // still on z=0 plane; perspective + lights make them look 3D
      m.makeTranslation(pos[i3], pos[i3 + 1], 0);
      atoms.setMatrixAt(i, m);
    }
    atoms.count = n;
    atoms.instanceMatrix.needsUpdate = true;
  };

  const drawBondsPacked = (packed: Float32Array, count: number) => {
    if (!three.current) return;
    const { bonds } = three.current;
    const geo = bonds.geometry as THREE.BufferGeometry;
    const attr = geo.getAttribute("position") as THREE.BufferAttribute | null;
    if (!attr || attr.array.length !== packed.length) {
      geo.setAttribute("position", new THREE.BufferAttribute(packed.slice() as any, 3));
    } else {
      (attr.array as Float32Array).set(packed);
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    }
    geo.setDrawRange(0, 2 * count);
    geo.computeBoundingSphere();
  };

const packBonds = (b: BondsView) => {
  const N = b.count;
  const arr = new Float32Array(6 * N);
  for (let i = 0; i < N; i++) {
    const i3 = 3 * i, i6 = 6 * i;
      arr[i6 + 0] = b.p1[i3 + 0];
      arr[i6 + 1] = b.p1[i3 + 1];
      arr[i6 + 2] = 0; // keep bonds on z=0 plane
      arr[i6 + 3] = b.p2[i3 + 0];
      arr[i6 + 4] = b.p2[i3 + 1];
      arr[i6 + 5] = 0;
    }
  return arr;
};

const buildBoxCorners = (matrix: Float32Array, origin: Float32Array) => {
  if (!matrix.length || !origin.length) {
    return new Float32Array(0);
  }
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
    if (attr) {
      geo.setDrawRange(0, 0);
    }
    return;
  }
  if (!attr || attr.array.length !== outline.length) {
    geo.setAttribute("position", new THREE.BufferAttribute(outline.slice() as any, 3));
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
    if (attr) {
      geo.setDrawRange(0, 0);
    }
    return;
  }

  const desired = corners.length;
  if (!attr || attr.array.length !== desired) {
    const updated = corners.slice() as Float32Array;
    for (let i = 2; i < updated.length; i += 3) {
      updated[i] = -0.02;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(updated, 3));
  } else {
    const arr = attr.array as Float32Array;
    arr.set(corners);
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] = -0.02;
    }
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
    if (!three.current || !running || !isOpen) return;

    frames.current = [];
    frameIdx.current = 0;
    followLive.current = true;
    updateScrubberUi();

    let active = true;

    const tick = () => {
      if (!active) return;

      runFrames(5);

      const posSnap = readPositions();
      if (posSnap && posSnap.count) {
        const bondsSnap = readBonds();
        const boxSnap = readBox();
        const posCopy = Float32Array.from(posSnap.positions);
        const bondsPacked = bondsSnap.count ? packBonds(bondsSnap) : new Float32Array(0);
        const boxCorners = buildBoxCorners(boxSnap.matrix, boxSnap.origin);
        const boxOutline = boxCorners.length ? Float32Array.from(boxCorners) : new Float32Array(0);
        const boxSurface = boxCorners.length ? Float32Array.from(boxCorners) : new Float32Array(0);

        if (!scrubbing.current) {
          drawAtoms(posCopy);
          drawBondsPacked(bondsPacked, bondsSnap.count);
          if (three.current) {
            drawBoxOutline(boxOutline, three.current.boxOutline);
            drawBoxSurface(boxSurface, three.current.boxSurface);
          }
        }

        frames.current.push({
          pos: posCopy,
          bondsPacked,
          bondCount: bondsSnap.count,
          boxOutline,
          boxSurface,
        });
        if (followLive.current && !scrubbing.current) {
          frameIdx.current = frames.current.length - 1;
        }
        updateScrubberUi();
      }

      rafTick.current = requestAnimationFrame(tick);
    };

    rafTick.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafTick.current) cancelAnimationFrame(rafTick.current);
    };
  }, [running, readPositions, readBonds, runFrames, isOpen, updateScrubberUi]);

  const onScrubStart = () => { scrubbing.current = true; followLive.current = false; };
  const onScrubEnd = () => { scrubbing.current = false; };

  const drawFrameIdx = useCallback((idx: number) => {
    if (!three.current || !frames.current.length) return;
    const clamped = Math.max(0, Math.min(idx, frames.current.length - 1));
    frameIdx.current = clamped;
    const f = frames.current[clamped];
    drawAtoms(f.pos);
    drawBondsPacked(f.bondsPacked, f.bondCount);
    if (three.current) {
      drawBoxOutline(f.boxOutline, three.current.boxOutline);
      drawBoxSurface(f.boxSurface, three.current.boxSurface);
    }
    updateScrubberUi();
  }, [updateScrubberUi]);
  
  return (
    <div className="border rounded p-3 flex flex-col gap-2 bg-white">
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

      <div ref={host} className="w-full aspect-square" />
    </div>
  );
}
