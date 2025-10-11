  import { useEffect, useRef, useState } from "react";
  import * as THREE from "three";
  import { useLammps } from "./useLammps";
  import { BaseButton } from "./BaseButton";

  type BondsView = { count: number; p1: Float32Array; p2: Float32Array };
  type Frame = { pos: Float32Array; bondsPacked: Float32Array; bondCount: number };

  export default function SimPanel({ network, autoPlay = true }: { network: string, autoPlay?: boolean }) {
    const { ready, running, startMinimal, stop, readPositions, readBonds, runFrames } =
      useLammps(console.log, network);

    const host = useRef<HTMLDivElement>(null);
    const three = useRef<{
      r: THREE.WebGLRenderer;
      c: THREE.PerspectiveCamera;
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

    useEffect(() => {frameIdx.current = inputFrameIdx;}, [inputFrameIdx]);
    useEffect(() => {
      if (!host.current || three.current) return;

      const s = new THREE.Scene();
      s.background = new THREE.Color(0xffffff);

      const c = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
      c.position.set(0, 0, 8);

      const r = new THREE.WebGLRenderer({ antialias: true });
      r.setPixelRatio(window.devicePixelRatio || 1);
      r.setSize(480, 480);
      host.current.innerHTML = "";
      host.current.appendChild(r.domElement);

      const atoms = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshStandardMaterial({ color: 0x222222 }),
        20000
      );
      const bonds = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x999999 })
      );
      s.add(atoms, bonds, new THREE.DirectionalLight(0xffffff, 1));

      three.current = { r, c, s, atoms, bonds };

      const render = () => {
        r.render(s, c);
        rafRender.current = requestAnimationFrame(render);
      };
      render();

      const onResize = () => {
        if (!host.current || !three.current) return;
        const sz = Math.min((host.current.getBoundingClientRect().width || 480), 640);
        three.current.r.setSize(sz, sz, false);
        three.current.c.aspect = 1;
        three.current.c.updateProjectionMatrix();
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

    // ---------- helpers ----------
    const drawAtoms = (pos: Float32Array) => {
      if (!three.current) return;
      const { atoms } = three.current;
      const m = new THREE.Matrix4();
      const n = pos.length / 3;
      for (let i = 0; i < n; i++) {
        const i3 = 3 * i;
        m.setPosition(pos[i3], pos[i3 + 1], pos[i3 + 2]);
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
        arr[i6 + 2] = b.p1[i3 + 2];
        arr[i6 + 3] = b.p2[i3 + 0];
        arr[i6 + 4] = b.p2[i3 + 1];
        arr[i6 + 5] = b.p2[i3 + 2];
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
        if (posView && posView.length) {
          const bondsView = readBonds();
          const posCopy = Float32Array.from(posView);
          const bondsPacked = bondsView.count ? packBonds(bondsView) : new Float32Array(0);

          if (!scrubbing.current) {
            drawAtoms(posCopy);
            drawBondsPacked(bondsPacked, bondsView.count);
          }

          frames.current = 
            [...frames.current, { pos: posCopy, bondsPacked, bondCount: bondsView.count }];

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
    }, [inputFrameIdx, frames]);

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
            Stop
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
        <div ref={host} />
      </div>
    );
  }
