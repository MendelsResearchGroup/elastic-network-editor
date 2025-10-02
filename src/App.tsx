import React, { useEffect, useMemo, useRef, useState } from "react";
import { EditableList, type FieldSpec } from "./EditableList";
import type { Angle, AngleTypes, Atom, Bond, BondTypes } from "./model";
import { generateLmp } from "./parse";
import { angleTheta } from "./utils";


type CanvasViewProps = {
  atoms: Atom[];
  bonds: Bond[];
  angles: Angle[];
  zoom: number;
  selected: number | null;
  setSelected: (id: number | null) => void;
  setAtoms: React.Dispatch<React.SetStateAction<Atom[]>>;
};


function CanvasView({ atoms, bonds, angles, zoom, selected, setSelected, setAtoms }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const byId = useMemo(() => new Map(atoms.map(a => [a.id, a])), [atoms]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    c.width = Math.max(1, Math.floor(cssW * dpr));
    c.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.lineWidth = 2 / zoom;
    ctx.globalAlpha = 0.95;
    bonds.forEach(b => {
      const ai = byId.get(b.i), aj = byId.get(b.j);
      if (!ai || !aj) return;
      ctx.beginPath();
      ctx.moveTo(ai.x, ai.y);
      ctx.lineTo(aj.x, aj.y);
      ctx.strokeStyle = "#334155";
      ctx.stroke();
      const mx = (ai.x + aj.x) / 2, my = (ai.y + aj.y) / 2;
      ctx.fillStyle = "#111827";
      ctx.font = `${12 / 1}px ui-sans-serif`;
      ctx.fillText(`k=${b.k}`, mx + 6, my - 6);
    });
    ctx.globalAlpha = 0.55;
    angles.forEach(a => {
      const ai = byId.get(a.i), aj = byId.get(a.j), ak = byId.get(a.k);
      if (!ai || !aj || !ak) return;
      ctx.beginPath();
      ctx.moveTo(ai.x, ai.y);
      ctx.lineTo(aj.x, aj.y);
      ctx.lineTo(ak.x, ak.y);
      ctx.strokeStyle = "#64748b";
      ctx.stroke();
      const th = angleTheta(ai, aj, ak);
      ctx.fillStyle = "#111827";
      ctx.font = `${11 / zoom}px ui-sans-serif`;
      ctx.fillText(`${(th * 180 / Math.PI).toFixed(1)}°`, aj.x + 6, aj.y + 12);
    });
    ctx.globalAlpha = 1;
    atoms.forEach(a => {
      ctx.beginPath();
      ctx.arc(a.x, a.y, 8 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = selected === a.id ? "#2563eb" : "#0ea5e9";
      ctx.fill();
      ctx.strokeStyle = "#0c4a6e";
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.font = `${12 / zoom}px ui-sans-serif`;
      ctx.fillText(`${a.id}`, a.x + 10, a.y - 10);
    });
  }, [atoms, bonds, angles, selected, zoom]);

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (e.clientX - rect.left) * (1 / dpr) * (1 / zoom);
    const y = (e.clientY - rect.top) * (1 / dpr) * (1 / zoom);
    return { x, y };
  }
  function hitTest(x: number, y: number) {
    for (let i = atoms.length - 1; i >= 0; i--) {
      const a = atoms[i];
      if (Math.hypot(a.x - x, a.y - y) <= 10 / zoom) return a.id;
    }
    return null;
  }
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e);
    const id = hitTest(p.x, p.y);
    if (id != null) {
      setSelected(id);
      const a = atoms.find(x => x.id === id)!;
      dragRef.current = { id, dx: p.x - a.x, dy: p.y - a.y };
    } else {
      setSelected(null);
    }
  };
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const p = getCanvasPoint(e);
    const { id, dx, dy } = dragRef.current;
    setAtoms(prev => prev.map(a => (a.id === id ? { ...a, x: p.x - dx, y: p.y - dy } : a)));
  };
  const onMouseUp = () => { dragRef.current = null; };

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-[420px] bg-slate-50 cursor-move"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      <div className="px-3 py-2 text-xs border-t bg-white">Drag atoms to move.</div>
    </div>
  );
}


export function AtomTable({ rows, onChange, onRemove }: { rows: Atom[]; onChange: (r: Atom[]) => void; onRemove: (id: number) => void; }) {
  const fields: FieldSpec<Atom>[] = [
    { key: "id", label: "id", readOnly: true },
    { key: "x", label: "x", kind: "number", step: 0.1, widthClass: "w-24" },
    { key: "y", label: "y", kind: "number", step: 0.1, widthClass: "w-24" },
  ];
  return <EditableList title="Atoms" rows={rows} fields={fields} onChange={onChange} onRemove={onRemove} />;
}

export function BondTable({ rows, onChange, onRemove }: { rows: Bond[]; onChange: (r: Bond[]) => void; onRemove: (id: number) => void; }) {
  const fields: FieldSpec<Bond>[] = [
    { key: "id", label: "id", readOnly: true },
    { key: "i", label: "i", kind: "number", widthClass: "w-16" },
    { key: "j", label: "j", kind: "number", widthClass: "w-16" },
    { key: "k", label: "k", kind: "number", step: 0.001, widthClass: "w-24" },
  ];
  return <EditableList title="Bonds" rows={rows} fields={fields} onChange={onChange} onRemove={onRemove} />;
}

export function AngleTable({ rows, onChange, onRemove }: { rows: Angle[]; onChange: (r: Angle[]) => void; onRemove: (id: number) => void; }) {
  const fields: FieldSpec<Angle>[] = [
    { key: "id", label: "id", readOnly: true },
    { key: "i", label: "i", kind: "number", widthClass: "w-16" },
    { key: "j", label: "j", kind: "number", widthClass: "w-16" },
    { key: "k", label: "k", kind: "number", widthClass: "w-16" },
    { key: "ktheta", label: "kθ", kind: "number", step: 0.001, widthClass: "w-20" },
  ];
  return <EditableList title="Angles" rows={rows} fields={fields} onChange={onChange} onRemove={onRemove} />;
}


function LammpsPreview({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border p-3 h-[420px] flex flex-col">
      <div className="font-semibold mb-2">LAMMPS data preview</div>
      <textarea className="flex-1 w-full resize-none font-mono text-xs border rounded p-2 bg-slate-50" value={text} readOnly />
      <div className="text-xs mt-2">Blank line after each section header; no comments.</div>
    </div>
  );
}

export default function App() {
  const [atoms, setAtoms] = useState<Atom[]>([
    { id: 1, x: 1, y: 1 },
    { id: 2, x: 1, y: 2 },
    { id: 3, x: 2, y: 2 },
    { id: 4, x: 2, y: 1 },

  ]);
  const [bonds, setBonds] = useState<Bond[]>([
    { id: 1, i: 1, j: 2, k: 100 },
    { id: 2, i: 2, j: 4, k: 50 },
    { id: 3, i: 3, j: 4, k: 100 },
    { id: 4, i: 1, j: 3, k: 50 },
  ]);
  const [angles, setAngles] = useState<Angle[]>([
    { id: 1, i: 1, j: 2, k: 4, ktheta: 10 },
    { id: 2, i: 1, j: 3, k: 4, ktheta: 10 },
  ]);
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const bondTypes: BondTypes = useMemo(() => {
    const uniq = [...new Map(bonds.map(b => [b.k, b])).values()].map(b => b.k).sort((a, b) => a - b);
    const map = new Map<number, number>();
    uniq.forEach((k, idx) => map.set(k, idx + 1));
    return { uniq, map };
  }, [bonds]);
  const angleTypes: AngleTypes = useMemo(() => {
    const uniq = [...new Map(angles.map(a => [a.ktheta, a])).values()].map(a => a.ktheta).sort((a, b) => a - b);
    const map = new Map<number, number>();
    uniq.forEach((k, idx) => map.set(k, idx + 1));
    return { uniq, map };
  }, [angles]);

  const lmp = useMemo(() => generateLmp(atoms, bonds, angles, bondTypes, angleTypes), [atoms, bonds, angles, bondTypes, angleTypes]);

  const addAtom = () => {
    const id = atoms.length ? Math.max(...atoms.map(a => a.id)) + 1 : 1;
    setAtoms([...atoms, { id, x: 100, y: 100 }]);
  };
  const removeAtom = (id: number) => {
    setAtoms(atoms.filter(a => a.id !== id));
    setBonds(bonds.filter(b => b.i !== id && b.j !== id));
    setAngles(angles.filter(t => t.i !== id && t.j !== id && t.k !== id));
  };
  const addBond = () => {
    if (atoms.length < 2) return;
    const id = bonds.length ? Math.max(...bonds.map(b => b.id)) + 1 : 1;
    setBonds([...bonds, { id, i: atoms[0].id, j: atoms[1].id, k: 100 }]);
  };
  const removeBond = (id: number) => setBonds(bonds.filter(b => b.id !== id));
  const addAngle = () => {
    if (atoms.length < 3) return;
    const id = angles.length ? Math.max(...angles.map(a => a.id)) + 1 : 1;
    setAngles([...angles, { id, i: atoms[0].id, j: atoms[1].id, k: atoms[2].id, ktheta: 10 }]);
  };
  const removeAngle = (id: number) => setAngles(angles.filter(a => a.id !== id));

  return (
    <div className="w-full h-full grid grid-cols-1 xl:grid-cols-[1fr_480px] gap-4 p-4 bg-white text-slate-900">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={addAtom}>Add atom</button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={addBond}>Add bond</button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={addAngle}>Add angle</button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm">Zoom</span>
            <input type="range" min={100} max={200} step={0.1} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} />
          </div>
        </div>
        <CanvasView atoms={atoms} bonds={bonds} angles={angles} zoom={zoom} selected={selected} setSelected={setSelected} setAtoms={setAtoms} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AtomTable rows={atoms} onChange={setAtoms} onRemove={removeAtom} />
          <BondTable rows={bonds} onChange={setBonds} onRemove={removeBond} />
          <AngleTable rows={angles} onChange={setAngles} onRemove={removeAngle} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <LammpsPreview text={lmp} />
        <div className="rounded-2xl border p-3 grid grid-cols-2 gap-2">
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={() => setAtoms([])}>Clear atoms</button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={() => { setBonds([]); setAngles([]); }}>Clear bonds/angles</button>
        </div>
      </div>
    </div>
  );
}
