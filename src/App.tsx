import { useMemo, useState } from "react";
import { EditableList, type FieldSpec } from "./EditableList";
import type { Angle, Atom, Bond, BondTypes } from "./model";
import { generateLmp } from "./parse";
import CanvasView from "./CanvasView";
import { useGraph } from "./useGraph";

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
    { key: "k", label: "k", kind: "number", step: 0.1, widthClass: "w-24" },
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
    </div>
  );
}

export default function App() {
  const {
    atoms, bonds, setAtoms, setBonds,
    addAtom, addBond, removeAtom, removeBond,
    clearAtoms, clearBonds,
    undo, redo, canUndo, canRedo,
    setSelected, removeByIds, selected, addBondBetween
  } = useGraph({
    atoms: [
      { id: 1, x: -1, y: -1 },
      { id: 2, x: -1, y: 1 },
      { id: 3, x: 1, y: 1 },
      { id: 4, x: 1, y: -1 },
      { id: 5, x: 0, y: 0 },
    ],
    bonds: [
      { id: 1, i: 1, j: 2, k: 0.5 },
      { id: 2, i: 2, j: 3, k: 0.5 },
      { id: 3, i: 3, j: 4, k: 0.5 },
      { id: 4, i: 1, j: 4, k: 0.5 },
      { id: 5, i: 1, j: 5, k: 1 },
      { id: 6, i: 2, j: 5, k: 1 },
      { id: 7, i: 3, j: 5, k: 1 },
      { id: 8, i: 4, j: 5, k: 1 },
    ],
  });

  const [zoomPercent, setZoomPercent] = useState(100);
  const scale = zoomPercent / 100;

  const bondTypes: BondTypes = useMemo(() => {
    const uniq = [...new Map(bonds.map(b => [b.k, b])).values()].map(b => b.k).sort((a, b) => a - b);
    const map = new Map<number, number>();
    uniq.forEach((k, idx) => map.set(k, idx + 1));
    return { uniq, map };
  }, [bonds]);

  const lmp = useMemo(() => generateLmp(atoms, bonds, bondTypes), [atoms, bonds, bondTypes]);

  return (
    <div className="w-full h-full grid grid-cols-1 xl:grid-cols-[1fr_480px] gap-4 p-4 bg-white text-slate-900">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={addAtom}>Add atom</button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={addBond}>Add bond</button>
          <div className="ml-2 flex gap-2">
            <button className="px-3 py-1.5 rounded-xl border" disabled={!canUndo} onClick={undo}>Undo</button>
            <button className="px-3 py-1.5 rounded-xl border" disabled={!canRedo} onClick={redo}>Redo</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm">Zoom</span>
            <input
              type="range"
              min={50}
              max={200}
              step={1}
              value={zoomPercent}
              onChange={e => setZoomPercent(parseInt(e.target.value))}
            />
            <span className="tabular-nums text-xs w-12 text-right">{zoomPercent}%</span>
          </div>
        </div>
        <CanvasView
          addBondBetween={addBondBetween}
          atoms={atoms}
          bonds={bonds}
          scale={scale}
          selected={selected}
          setSelected={setSelected}
          setAtoms={setAtoms}
          setBonds={setBonds}
          removeByIds={removeByIds}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AtomTable rows={atoms} onChange={setAtoms} onRemove={removeAtom} />
          <BondTable rows={bonds} onChange={setBonds} onRemove={removeBond} />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <LammpsPreview text={lmp} />
        <div className="rounded-2xl border p-3 grid grid-cols-2 gap-2">
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={clearAtoms}>Clear atoms</button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white" onClick={clearBonds}>Clear bonds/angles</button>
        </div>
      </div>
    </div>
  );
}
