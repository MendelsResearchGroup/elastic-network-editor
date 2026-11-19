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
const exampleGraph = example && parseLmp(example.input);

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
  } = useGraph(exampleGraph);

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
    <div className="w-full h-full grid grid-rows-[auto_1fr] bg-white text-slate-900">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b sticky top-0 bg-white z-10">
        <nav aria-label="Network examples" className="flex gap-3 text-sm">
          {examples.map(item => <a key={item.id} className="underline" href={`?example=${item.id}`} target="_blank" rel="noreferrer">{item.name}</a>)}
        </nav>
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
          disabled={!lmp}
          title={
            lmp
              ? "Simulate current network"
              : "Add a bond with valid endpoints to enable simulation"
          }
        >
          Simulate
        </BaseButton>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600" htmlFor="simulation-script">
            Script
          </label>
          <select
            id="simulation-script"
            className="border border-slate-300 rounded-md px-2 py-1 text-sm bg-white"
            value={simulationScriptId}
            onChange={(e) =>
              setSimulationScriptId(e.target.value as typeof simulationScriptId)
            }
            title="Choose which simulation input script to run"
          >
            {SIMULATION_SCRIPTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {importError && <span role="alert">{importError}</span>}
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

          <SimulationWrapper
            isOpen={showSim && Boolean(lmp)}
            setIsOpen={setShowSim}
            lmp={lmp}
            script={simulationScript}
          />
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

type SimulationScript = (typeof SIMULATION_SCRIPTS)[number];

const SimulationWrapper = ({
  isOpen,
  setIsOpen,
  lmp,
  script,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  lmp: string;
  script: SimulationScript;
}) =>
  <div className="absolute inset-0 z-20 bg-white/95 border-l border-t" style={{
    visibility: isOpen ? "visible" : "hidden",
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? "auto" : "none",
  }}>
    <div className="flex items-center justify-between gap-2 p-2 border-b bg-white">
      <div>
        <div>
          <div className="font-medium text-sm">Simulation · {script.label}</div>
          <div className="text-xs text-slate-500">
            (live view of current network)
          </div>
        </div>
      </div>
      <BaseButton
        variant="ghost"
        onClick={() => setIsOpen(false)}
      >
        X
      </BaseButton>
    </div>
    <div className="p-2 h-[calc(100%-40px)] overflow-auto">
      {isOpen && <Simulation key={script.id} network={lmp} isOpen={isOpen} script={script} />}
    </div>
  </div>
