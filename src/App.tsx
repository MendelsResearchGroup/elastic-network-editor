import { useMemo, useState } from "react";
import { EditableList, type FieldSpec } from "./EditableList";
import type { Angle, Atom, Bond, BondTypes } from "./model";
import { generateLmp } from "./parse";
import CanvasView from "./CanvasView";
import { useGraph } from "./useGraph";

function AtomTable({
  rows, onChange, onRemove,
}: { rows: Atom[]; onChange: (r: Atom[]) => void; onRemove: (id: number) => void }) {
  const fields: FieldSpec<Atom>[] = [
    { key: "id", label: "id", readOnly: true, widthClass: "w-16" },
    { key: "x", label: "x", kind: "number", widthClass: "w-24" },
    { key: "y", label: "y", kind: "number", widthClass: "w-24" },
  ];
  return <EditableList title="Atoms" rows={rows} fields={fields} onChange={onChange} onRemove={onRemove} />;
}

function BondTable({
  rows, onChange, onRemove,
}: { rows: Bond[]; onChange: (r: Bond[]) => void; onRemove: (id: number) => void }) {
  const fields: FieldSpec<Bond>[] = [
    { key: "id", label: "id", readOnly: true, widthClass: "w-16" },
    { key: "i", label: "i", kind: "number", widthClass: "w-20" },
    { key: "j", label: "j", kind: "number", widthClass: "w-20" },
    { key: "k", label: "k", kind: "number", widthClass: "w-24" },
  ];
  return <EditableList title="Bonds" rows={rows} fields={fields} onChange={onChange} onRemove={onRemove} />;
}

function LammpsPreview({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border p-3 h-[320px] flex flex-col">
      <div className="font-semibold mb-2">LAMMPS data preview</div>
      <textarea
        className="flex-1 w-full resize-none font-mono text-xs border rounded p-2 bg-slate-50"
        value={text}
        readOnly
      />
    </div>
  );
}

export default function App() {
  const {
    atoms, bonds, setAtoms, setBonds,
    addAtom, addBond, removeAtom, removeBond,
    undo, redo, canUndo, canRedo,
    setSelected, removeByIds, selected, addBondBetween
  } = useGraph();

  const [zoomPercent, setZoomPercent] = useState(200);
  const scale = zoomPercent / 100;

  const bondTypes: BondTypes = useMemo(() => {
    const uniq = [...new Map(bonds.map(b => [b.k, b])).values()]
      .map(b => b.k)
      .sort((a, b) => a - b);
    const map = new Map<number, number>();
    uniq.forEach((k, idx) => map.set(k, idx + 1));
    return { uniq, map };
  }, [bonds]);

  const lmp = useMemo(() => generateLmp(atoms, bonds, bondTypes), [atoms, bonds, bondTypes]);

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr] bg-white text-slate-900">
      <div className="flex items-center gap-2 p-3 border-b sticky top-0 bg-white z-10">
        <div className="flex gap-2">
          <button className="px-2.5 py-1 rounded-lg border text-sm" disabled={!canUndo} onClick={undo}>Undo</button>
          <button className="px-2.5 py-1 rounded-lg border text-sm" disabled={!canRedo} onClick={redo}>Redo</button>
        </div>
        <div className="h-5 w-px bg-slate-200 mx-2" />
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded-lg bg-slate-900 text-white text-xs" onClick={addAtom}>Add atom</button>
          <button className="px-2 py-1 rounded-lg bg-slate-900 text-white text-xs" onClick={addBond}>Add bond</button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm">Zoom</span>
          <input
            className="accent-slate-900"
            type="range"
            min={50}
            max={250}
            step={1}
            value={zoomPercent}
            onChange={e => setZoomPercent(parseInt(e.target.value))}
          />
          <span className="tabular-nums text-xs w-12 text-right">{zoomPercent}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 p-4">
        <div className="rounded-2xl border p-2 relative overflow-hidden"
          style={{ height: "calc(100vh - 72px)" }}>
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
        </div>

        <div className="flex flex-col gap-3 overflow-auto"
          style={{ maxHeight: "calc(100vh - 72px)" }}>
          <LammpsPreview text={lmp} />
          <AtomTable rows={atoms} onChange={setAtoms} onRemove={removeAtom} />
          <BondTable rows={bonds} onChange={setBonds} onRemove={removeBond} />
        </div>
      </div>
    </div>
  );
}
