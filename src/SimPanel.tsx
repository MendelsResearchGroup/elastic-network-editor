import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLammps } from "./useLammps";

export default function SimPanel() {
  const { ready, running, startMinimal, stop, readPositions, readBonds } =
    useLammps(console.log);

  const host = useRef<HTMLDivElement>(null);
  const three = useRef<{ r: THREE.WebGLRenderer; c: THREE.PerspectiveCamera; s: THREE.Scene; atoms: THREE.InstancedMesh; bonds: THREE.LineSegments }>();
  const [frames, setFrames] = useState<any[]>([]);
  const [frameIdx, setFrameIdx] = useState(0);
  const raf = useRef<number>();

  // init Three
  useEffect(() => {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x111111);
    const c = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    c.position.set(0, 0, 8);
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(480, 480);
    host.current!.appendChild(r.domElement);

    const atoms = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial(),
      10000
    );
    const bonds = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xaaaaaa })
    );
    s.add(atoms);
    s.add(bonds);
    s.add(new THREE.DirectionalLight(0xffffff, 1));

    three.current = { r, c, s, atoms, bonds };

    const render = () => {
      r.render(s, c);
      raf.current = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(raf.current!);
  }, []);

  // live recording
  useEffect(() => {
    if (!three.current) return;
    if (!running) return;

    const id = setInterval(() => {
      const pos = readPositions();
      // console.log(pos)
      if (!pos.length) return;
      const b = readBonds();
      setFrames(f => [...f, { pos: new Float32Array(pos), b }]);
    }, 100);

    return () => clearInterval(id);
  }, [running, readPositions, readBonds]);

  // draw a frame
  useEffect(() => {
    if (!three.current || !frames.length) return;
    const { atoms, bonds } = three.current;
    const f = frames[frameIdx];
    const m = new THREE.Matrix4();

    // atoms
    const n = f.pos.length / 3;
    for (let i = 0; i < n; i++) {
      m.setPosition(f.pos[3*i], f.pos[3*i+1], f.pos[3*i+2]);
      atoms.setMatrixAt(i, m);
    }
    atoms.count = n;
    atoms.instanceMatrix.needsUpdate = true;

    // bonds
    const arr = new Float32Array(6 * f.b.count);
    for (let i = 0; i < f.b.count; i++) {
      arr.set([
        f.b.p1[3*i], f.b.p1[3*i+1], f.b.p1[3*i+2],
        f.b.p2[3*i], f.b.p2[3*i+1], f.b.p2[3*i+2]
      ], 6*i);
    }
    bonds.geometry.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    bonds.geometry.computeBoundingSphere();
  }, [frameIdx, frames]);

  return (
    <div className="border rounded p-3 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button disabled={!ready} onClick={startMinimal} className="bg-black text-white px-2 py-1 rounded text-xs">
          Run
        </button>
        <button disabled={!running} onClick={stop} className="border px-2 py-1 rounded text-xs">
          Stop
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, frames.length - 1)}
          value={frameIdx}
          onChange={e => setFrameIdx(+e.target.value)}
          className="flex-1"
        />
      </div>
      <div ref={host} />
    </div>
  );
}
