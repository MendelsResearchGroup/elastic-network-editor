import { useMemo, useRef, useState } from "react";
import { EditableList, type FieldSpec } from "./EditableList";
import type { Atom, Bond } from "./model";
import { generateLmp } from "./parse";
import CanvasView from "./CanvasView";
import { useGraph } from "./useGraph";
import SimPanel from "./SimPanel";
import { BaseButton } from "./BaseButton";



function AtomTable({
  rows,
  onChange,
  onRemove,
}: {
  rows: Atom[];
  onChange: (r: Atom[]) => void;
  onRemove: (id: number) => void;
}) {
  const fields: FieldSpec<Atom>[] = [
    { key: "id", label: "id", readOnly: true, widthClass: "w-16" },
    { key: "x", label: "x", kind: "number", widthClass: "w-24" },
    { key: "y", label: "y", kind: "number", widthClass: "w-24" },
  ];
  return (
    <EditableList
      title="Atoms"
      rows={rows}
      fields={fields}
      onChange={onChange}
      onRemove={onRemove}
    />
  );
}

function BondTable({
  rows,
  onChange,
  onRemove,
}: {
  rows: Bond[];
  onChange: (r: Bond[]) => void;
  onRemove: (id: number) => void;
}) {
  const fields: FieldSpec<Bond>[] = [
    { key: "id", label: "id", readOnly: true, widthClass: "w-16" },
    { key: "i", label: "i", kind: "number", widthClass: "w-20" },
    { key: "j", label: "j", kind: "number", widthClass: "w-20" },
    { key: "k", label: "k", kind: "number", widthClass: "w-24" },
  ];
  return (
    <EditableList
      title="Bonds"
      rows={rows}
      fields={fields}
      onChange={onChange}
      onRemove={onRemove}
    />
  );
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
    atoms,
    bonds,
    setAtoms,
    setBonds,
    addAtom,
    addBond,
    removeAtom,
    removeBond,
    undo,
    redo,
    canUndo,
    canRedo,
    setSelected,
    removeByIds,
    selected,
    addBondBetween,
    loadFromString,
  } = useGraph();

  const [zoomPercent, setZoomPercent] = useState(200);
  const [showSim, setShowSim] = useState(false);
  const scale = zoomPercent / 100;


  const lmp = useMemo(
    () => generateLmp(atoms, bonds),
    [atoms, bonds]
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => fileRef.current?.click();
  const onLoadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    loadFromString(text);
    e.target.value = "";
  };

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr] bg-white text-slate-900">
      <div className="flex items-center gap-2 p-3 border-b sticky top-0 bg-white z-10">
        <div className="flex gap-2">
          <BaseButton variant="ghost" disabled={!canUndo} onClick={undo}>
            Undo
          </BaseButton>
          <BaseButton variant="ghost" disabled={!canRedo} onClick={redo}>
            Redo
          </BaseButton>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-2" />

        <div className="flex gap-2">
          <BaseButton variant="primary" onClick={addAtom}>
            Add Atom
          </BaseButton>
          <BaseButton variant="primary" onClick={addBond}>
            Add Bond
          </BaseButton>
          <BaseButton variant="ghost" onClick={onPickFile}>
            Load .lmp
          </BaseButton>
          <input
            ref={fileRef}
            type="file"
            accept=".lmp,.data,.txt"
            className="hidden"
            onChange={onLoadFile}
          />
        </div>

        <div className="h-5 w-px bg-slate-200 mx-2" />
        <BaseButton
          variant="success"
          onClick={() => setShowSim(true)}
          disabled={!atoms.length}
          title={
            atoms.length
              ? "Simulate current network"
              : "Add atoms to enable simulation"
          }
        >
          Simulate
        </BaseButton>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm">Zoom</span>
          <input
            className="accent-slate-900 cursor-pointer"
            type="range"
            min={50}
            max={250}
            step={1}
            value={zoomPercent}
            onChange={(e) => setZoomPercent(parseInt(e.target.value))}
          />
          <span className="tabular-nums text-xs w-12 text-right">
            {zoomPercent}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4 p-4">
        <div
          className="rounded-2xl border p-2 relative overflow-hidden"
          style={{ height: "calc(100vh - 72px)" }}
        >
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

          {showSim && (
            <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm border-l border-t shadow-lg">
              <div className="flex items-center gap-2 p-2 border-b bg-white">
                <div className="font-medium text-sm">Simulation</div>
                <div className="text-xs text-slate-500 ml-2">
                  (live view of current network)
                </div>
                <BaseButton
                  variant="ghost"
                  onClick={() => setShowSim(false)}
                  className="ml-auto"
                >
                  X
                </BaseButton>
              </div>
              <div className="p-2 h-[calc(100%-40px)] overflow-hidden">
                <SimPanel network={lmp} />
              </div>
            </div>
          )}
        </div>

        <div
          className="flex flex-col gap-3 overflow-auto"
          style={{ maxHeight: "calc(100vh - 72px)" }}
        >
          <LammpsPreview text={lmp} />
          <AtomTable rows={atoms} onChange={setAtoms} onRemove={removeAtom} />
          <BondTable rows={bonds} onChange={setBonds} onRemove={removeBond} />
        </div>
      </div>
    </div>
  );
}
