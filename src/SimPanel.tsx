// SimPanel.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLammps } from "./useLammps";
import { BaseButton } from "./BaseButton";

type BondsView = { count: number; p1: Float32Array; p2: Float32Array };
type Frame = { pos: Float32Array; bondsPacked: Float32Array; bondCount: number };

const BG = 0xffffff;
const ATOM = 0x2563eb;
const BOND = 0x334155;

export default function SimPanel({ network, autoPlay = true }: { network: string; autoPlay?: boolean }) {
  const { ready, running, startMinimal, stop, readPositions, readBonds, runFrames, readBox } =
    useLammps(console.log, network);

  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{
    r: THREE.WebGLRenderer;
    cam: THREE.PerspectiveCamera;
    s: THREE.Scene;
    atoms: THREE.InstancedMesh;
    bonds: THREE.LineSegments;
  } | null>(null);

  const rafRender = useRef<number>(0);
  const rafTick = useRef<number>(0);
  const scrubbing = useRef(false);
  const followLive = useRef(true);

  const frames = useRef<Frame[]>([]);
  const frameIdx = useRef(0);
  const [inputFrameIdx, setInputFrameIdx] = useState(frameIdx.current);
  useEffect(() => { frameIdx.current = inputFrameIdx; }, [inputFrameIdx]);

  useEffect(() => {
    if (!host.current || three.current) return;

    // Scene & renderer
    const s = new THREE.Scene();
    s.background = new THREE.Color(BG);

    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(window.devicePixelRatio || 1);
    r.setSize(550, 550);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;

    // Subtle real 3D look: perspective cam, slight tilt
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(0, 3.5, 8);
    cam.lookAt(0, 0, 0);

    host.current.innerHTML = "";
    host.current.appendChild(r.domElement);

    // Atoms: shaded spheres
    const atoms = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.12, 24, 20),
      new THREE.MeshStandardMaterial({ color: ATOM, metalness: 0.05, roughness: 0.6 }),
      20000
    );

    // Bonds: keep as lines (fast), now lit scene makes them pop
    const bonds = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: BOND, linewidth: 1 })
    );

    // Nicer lighting for roundness
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8090a0, 0.85);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(2.5, 4, 3);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-3, 2, -2);

    s.add(hemi, key, fill, atoms, bonds);

    three.current = { r, cam, s, atoms, bonds };

    const render = () => {
      r.render(s, cam);
      rafRender.current = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      if (!host.current || !three.current) return;
      const sz = Math.min(host.current.getBoundingClientRect().width || 480, 640);
      three.current.r.setSize(sz, sz, false);
      three.current.cam.aspect = 1; // we keep square canvas
      three.current.cam.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    onResize();

    autoPlay && startMinimal();

    return () => {
      if (rafRender.current) cancelAnimationFrame(rafRender.current);
      window.removeEventListener("resize", onResize);
      if (three.current) {
        three.current.atoms.geometry.dispose();
        (three.current.atoms.material as THREE.Material).dispose();
        three.current.bonds.geometry.dispose();
        (three.current.bonds.material as THREE.Material).dispose();
        three.current.r.dispose();
        three.current.r.domElement.remove();
        three.current = null;
      }
    };
  }, []);

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

  // ---------- live capture while running ----------
  useEffect(() => {
    if (!three.current || !running) return;

    frames.current = [];
    frameIdx.current = 0;
    followLive.current = true;

    let active = true;

    const tick = () => {
      if (!active) return;

      runFrames(6);

      const posView = readPositions();
      console.log(readBox());
      if (posView && posView.length) {
        const bondsView = readBonds();
        const posCopy = Float32Array.from(posView);
        const bondsPacked = bondsView.count ? packBonds(bondsView) : new Float32Array(0);

        if (!scrubbing.current) {
          drawAtoms(posCopy);
          drawBondsPacked(bondsPacked, bondsView.count);
        }

        frames.current = [...frames.current, { pos: posCopy, bondsPacked, bondCount: bondsView.count }];
        if (followLive.current && !scrubbing.current) frameIdx.current = frames.current.length - 1;
      }

      rafTick.current = requestAnimationFrame(tick);
    };

    rafTick.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      if (rafTick.current) cancelAnimationFrame(rafTick.current);
    };
  }, [running, readPositions, readBonds, runFrames]);

  // ---------- draw scrubbed frame ----------
  useEffect(() => {
    if (!three.current || !frames.current.length) return;
    const f = frames.current[frameIdx.current];
    drawAtoms(f.pos);
    drawBondsPacked(f.bondsPacked, f.bondCount);
  }, [inputFrameIdx]);

  const onScrubStart = () => { scrubbing.current = true; followLive.current = false; };
  const onScrubEnd = () => { scrubbing.current = false; };

  return (
    <div className="border rounded p-3 flex flex-col gap-2 bg-white">
      <div className="flex items-center gap-3">
        <BaseButton
          variant="primary"
          disabled={!ready || running}
          onClick={startMinimal}
          title={ready ? "Run simulation" : "Initializing..."}
        >
          Run
        </BaseButton>

        <BaseButton
          variant="ghost"
          disabled={!running}
          onClick={stop}
          title={running ? "Stop simulation" : "Not running"}
        >
          Pause
        </BaseButton>

        <input
          type="range"
          min={0}
          max={Math.max(0, frames.current.length - 1)}
          value={frameIdx.current}
          onChange={(e) => setInputFrameIdx(+e.target.value)}
          onMouseDown={onScrubStart}
          onMouseUp={onScrubEnd}
          onTouchStart={onScrubStart}
          onTouchEnd={onScrubEnd}
          className="flex-1 accent-slate-900 cursor-pointer"
        />
        <span className="text-xs w-16 text-right tabular-nums">
          {frames.current.length ? `${frameIdx.current + 1}/${frames.current.length}` : "—"}
        </span>
      </div>

      <div ref={host} className="w-full aspect-square" />
    </div>
  );
}
