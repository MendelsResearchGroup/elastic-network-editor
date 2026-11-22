import { useMemo, useRef, useState } from "react";
import { EditableList, type FieldSpec } from "./EditableList";
import type { Atom, Bond } from "./model";
import rotatingSquares from "../examples/rotating-squares/rotating-squares.lmp?raw";
import thermalLattice from "../examples/negative-thermal-expansion/lattice.lmp?raw";
import { parseLmp, generateLmp } from "./parse";
import CanvasView from "./CanvasView";
import { useGraph } from "./useGraph";
import Simulation from "./Simulation";
import { BaseButton } from "./BaseButton";
import { copyText } from "./clipboard";

const examples = [
  { id: "rotating-squares", name: "Rotating squares", input: rotatingSquares, script: "auxetic-compress" },
  { id: "negative-thermal-expansion", name: "Negative thermal expansion", input: thermalLattice, script: "nte" },
] as const;
const example = examples.find(item => item.id === new URLSearchParams(location.search).get("example"));
const starter = parseLmp(rotatingSquares);
const exampleGraph = example?.id === "rotating-squares" ? starter : example && parseLmp(example.input);

const SIMULATION_SCRIPTS = [
  { id: "nte", label: "Cold and hot plateaus", path: "/nte.deformation" },
  {
    id: "thermal-expand",
    label: "Thermal Expansion",
    path: "/thermal-expand.deformation",
  },
  {
    id: "auxetic-compress",
    label: "Auxetic Compression",
    path: "/auxetic/compress.deformation",
    assets: [
      { path: "/auxetic/init.mod", target: "init.mod" },
      { path: "/auxetic/potential.mod", target: "potential.mod" },
    ],
  },
] as const;

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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const handleCopy = async () => {
    try {
      await copyText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <div className="rounded-2xl border p-3 h-[320px] flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold">LAMMPS data preview</div>
        <div className="flex items-center gap-2">
          {copyStatus !== "idle" && (
            <span
              className={`text-xs ${
                copyStatus === "copied" ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {copyStatus === "copied" ? "Copied" : "Copy failed"}
            </span>
          )}
          <BaseButton
            variant="ghost"
            disabled={!text}
            onClick={handleCopy}
            title="Copy LAMMPS data"
          >
            Copy
          </BaseButton>
        </div>
      </div>
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
    model,
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
    appendSelection,
  } = useGraph(starter, exampleGraph);

  const [zoomPercent, setZoomPercent] = useState(example ? 100 : 200);
  const [showSim, setShowSim] = useState(Boolean(example));
  const [simulationScriptId, setSimulationScriptId] =
    useState<typeof SIMULATION_SCRIPTS[number]["id"]>(example?.script ?? "auxetic-compress");
  const scale = zoomPercent / 100;

  const lmp = useMemo(() => generateLmp(atoms, bonds, model), [atoms, bonds, model]);
  const simulationScript =
    SIMULATION_SCRIPTS.find((s) => s.id === simulationScriptId) ?? SIMULATION_SCRIPTS[0];

  const [loadedFile, setLoadedFile] = useState(0);
  const [importError, setImportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const onPickFile = () => fileRef.current?.click();
  const onLoadFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const input = e.currentTarget;
    try {
      loadFromString(await f.text());
      setImportError("");
      setSelected(null);
      setLoadedFile(version => version + 1);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      input.value = "";
    }
  };

  return (
    <main className="studio">
      <header className="masthead">
        <h1><span className="network-mark" aria-hidden="true">◇</span> Elastic Network Editor</h1>
        <details className="example-menu">
          <summary>Examples</summary>
          <nav aria-label="Network examples">{examples.map(item =>
            <a key={item.id} href={`?example=${item.id}`} target="_blank" rel="noreferrer">{item.name}</a>
          )}</nav>
        </details>
      </header>
      <section className="workbench">
        <div className="toolstrip">
          {showSim ? <BaseButton variant="ghost" onClick={() => setShowSim(false)}>← Edit network</BaseButton> : <>
            <BaseButton variant="primary" onClick={addAtom}>+ Atom</BaseButton>
            <BaseButton variant="primary" onClick={addBond}>+ Bond</BaseButton>
            <BaseButton variant="ghost" disabled={!canUndo} onClick={undo}>Undo</BaseButton>
            <BaseButton variant="ghost" disabled={!canRedo} onClick={redo}>Redo</BaseButton>
            <BaseButton variant="ghost" onClick={onPickFile}>Load .lmp</BaseButton>
            <input ref={fileRef} type="file" accept=".lmp,.data,.txt" hidden onChange={onLoadFile} />
          </>}
          <div className="run-tools">
            <select aria-label="Simulation script" value={simulationScriptId} onChange={e => setSimulationScriptId(e.target.value as typeof simulationScriptId)}>
              {SIMULATION_SCRIPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            {!showSim && <BaseButton variant="success" disabled={!lmp} onClick={() => setShowSim(true)}>▶ Simulate</BaseButton>}
          </div>
        </div>
        {importError && <p role="alert">{importError}</p>}
        {!showSim && <div className="stage">
          <CanvasView
            key={loadedFile}
            model={model}
            appendSelection={appendSelection}
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
        </div>}
        {showSim && lmp && <Simulation key={simulationScript.id} network={lmp} script={simulationScript} isOpen />}
        {!showSim && <footer className="canvas-footer">
          <span>{atoms.length} atoms · {bonds.length} bonds</span>
          <label>Zoom <input type="range" min={50} max={250} value={zoomPercent} onChange={e => setZoomPercent(Number(e.target.value))} /> {zoomPercent}%</label>
        </footer>}
      </section>
      <details className="network-details">
        <summary>Network data</summary>
        <div className="data-panels">
          <LammpsPreview text={lmp} />
          <AtomTable rows={atoms} onChange={setAtoms} onRemove={removeAtom} />
          <BondTable rows={bonds} onChange={setBonds} onRemove={removeBond} />
        </div>
      </details>
    </main>
  );
}
