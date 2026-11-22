import { useCallback, useEffect, useState } from "react";
import type { Atom, Bond, Graph } from "./model";
import { parseLmp } from "./parse";
import { workspaceGraph } from "./workspaceGraph";

const STORAGE_KEY = "graph-state-v1";

// Deep clone (structuredClone if present)
function deepClone<T>(x: T): T {
  if (typeof structuredClone === "function") return structuredClone(x);
  return JSON.parse(JSON.stringify(x));
}
function nextAtomId(list: Atom[]) {
  let m = 0; for (const a of list) if (typeof a.id === "number" && a.id > m) m = a.id; return m + 1;
}

function loadFromStorage(): (Partial<Graph> & { selected?: number | null; zoomPercent?: number }) | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function useGraph(starter: Graph, example?: Graph) {
  const [saved] = useState(() => example ? null : loadFromStorage());
  const [present, setPresent] = useState<Graph>(() => example ?? workspaceGraph(starter, saved));
  const [past, setPast] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);

  const [selected, setSelected] = useState<number | null>(present === starter ? null : saved?.selected ?? null);
  const [zoomPercent, setZoomPercent] = useState<number>(saved?.zoomPercent ?? 100);

  const commit = useCallback((updater: (g: Graph) => Graph) => {
    setPresent(prev => {
      const updated = updater(prev);
      if (updated === prev) return prev;
      const next = deepClone(updated);
      // Drop angles affected by deleting an atom or one of its original links.
      if (next.model && updated.model === prev.model) {
        const ids = new Set(next.atoms.map(a => a.id));
        const pair = (i: number, j: number) => [Math.min(i,j), Math.max(i,j)].join(":");
        const links = new Set(next.bonds.map(b => pair(b.i, b.j)));
        const removed = new Set(prev.bonds.map(b => pair(b.i, b.j)).filter(key => !links.has(key)));
        next.model.angles = next.model.angles.filter(a => [a.i,a.j,a.k].every(id => ids.has(id)) &&
          !removed.has(pair(a.i,a.j)) && !removed.has(pair(a.j,a.k)));
      }
      setPast(p => [...p, deepClone(prev)]);
      setFuture([]);
      return next;
    });
  }, []);

  // ---- safe setters
  const setAtoms = useCallback((atoms: Atom[] | ((a: Atom[]) => Atom[])) => {
    commit(g => {
      const nextArr = typeof atoms === "function" ? atoms(g.atoms) : atoms;
      return { ...g, atoms: deepClone(Array.isArray(nextArr) ? nextArr : g.atoms), bonds: g.bonds };
    });
  }, [commit]);

  const setBonds = useCallback((bonds: Bond[] | ((b: Bond[]) => Bond[])) => {
    commit(g => {
      const nextArr = typeof bonds === "function" ? bonds(g.bonds) : bonds;
      return { ...g, atoms: g.atoms, bonds: deepClone(Array.isArray(nextArr) ? nextArr : g.bonds) };
    });
  }, [commit]);

  const addAtom = () => commit(g => ({ ...g, atoms: [...g.atoms, { id: nextAtomId(g.atoms), x: 0, y: 0 }], bonds: g.bonds }));
  const removeAtom = (id: number) => commit(g => ({
    ...g, atoms: g.atoms.filter(a => a.id !== id),
    bonds: g.bonds.filter(b => b.i !== id && b.j !== id),
  }));
  const addBond = () => commit(g => {
    if (g.atoms.length < 2) return g;
    const [i, j] = [g.atoms[0].id, g.atoms[1].id];
    return { ...g, atoms: g.atoms, bonds: [...g.bonds, { id: nextBondId(g.bonds), i, j, k: 1 }] };
  });

  const loadFromString = (text: string) => {
    const parsed = parseLmp(text);
    commit(() => parsed);
  };

  const removeBond = (id: number) => commit(g => ({ ...g, atoms: g.atoms, bonds: g.bonds.filter(b => b.id !== id) }));
  const clearAtoms = () => commit(() => ({ atoms: [], bonds: [] }));
  const clearBonds = () => commit(g => ({ ...g, atoms: g.atoms, bonds: [] }));

  const removeByIds = useCallback((ids: number[]) => {
    if (!ids?.length) return;
    const target = new Set(ids);
    commit(g => ({
      ...g, atoms: g.atoms.filter(a => !target.has(a.id)),
      bonds: g.bonds.filter(b => !target.has(b.i) && !target.has(b.j)),
    }));
  }, [commit]);


  const undo = useCallback(() => {
    setPast(p => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture(f => [deepClone(present), ...f]);
      setPresent(deepClone(prev));
      return p.slice(0, -1);
    });
  }, [present]);
  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[0];
      setPast(p => [...p, deepClone(present)]);
      setPresent(deepClone(next));
      return f.slice(1);
    });
  }, [present]);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const appendSelection = (atoms: Atom[], bonds: Bond[], angles: NonNullable<Graph["model"]>["angles"]) => {
    commit(g => {
      let model = g.model;
      if (model && angles.length) {
        const firstId = model.angles.reduce((max, a) => Math.max(max, a.id), 0) + 1;
        model = { ...model, angles: [...model.angles, ...angles.map((a, i) => ({ ...a, id: firstId + i }))] };
      }
      return { atoms: [...g.atoms, ...atoms], bonds: [...g.bonds, ...bonds], model };
    });
  };

  function nextBondId(list: Bond[]) {
    let m = 0;
    for (const b of list) {
      const bid = b.id;
      if (typeof bid === "number" && bid > m) m = bid;
    }
    return m + 1;
  }

  const addBondBetween = useCallback((i: number, j: number, k = 1) => {
    if (i === j) return; // ignore self-bond
    commit(g => {
      const already = g.bonds.some(b =>
        (b.i === i && b.j === j) || (b.i === j && b.j === i)
      );
      if (already) return g;
      return {
        ...g, atoms: g.atoms,
        bonds: [...g.bonds, { id: nextBondId(g.bonds), i, j, k }],
      };
    });
  }, [commit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) { undo(); e.preventDefault(); }
      else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { redo(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [undo, redo]);

  useEffect(() => {
    if (example) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...present,
        selected,
        zoomPercent,
      }));
    } catch { /* Storage may be disabled or full. */ }
  }, [example, present, selected, zoomPercent]);

  const atoms = present.atoms;
  const bonds = present.bonds;
  const scale = zoomPercent / 100;

  return {
    model: present.model, atoms, bonds, setAtoms, setBonds,
    selected, setSelected,
    zoomPercent, setZoomPercent,
    scale,

    addAtom, removeAtom, addBond, removeBond, clearAtoms, clearBonds, removeByIds,
    undo, redo, canUndo, canRedo, addBondBetween, loadFromString, appendSelection
  };
}
