import { useCallback, useEffect, useMemo, useState } from "react";
import type { Atom, Bond } from "./model";
import { parseLmp } from "./parse";

type Graph = { atoms: Atom[]; bonds: Bond[] };
const STORAGE_KEY = "graph-state-v1";

// Deep clone (structuredClone if present)
function deepClone<T>(x: T): T {
  // @ts-ignore
  if (typeof structuredClone === "function") return structuredClone(x);
  return JSON.parse(JSON.stringify(x));
}
function nextAtomId(list: Atom[]) {
  let m = 0; for (const a of list) if (typeof a.id === "number" && a.id > m) m = a.id; return m + 1;
}

function loadFromStorage(): { atoms?: Atom[]; bonds?: Bond[]; selected?: number | null; zoomPercent?: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function useGraph(initial?: Graph) {
  const initialGraph: Graph = (() => {
    const saved = loadFromStorage();
    if (saved?.atoms && saved?.bonds) return { atoms: saved.atoms, bonds: saved.bonds };
    if (initial) return deepClone(initial);
    return {
      atoms: [
        { id: 1, x: -1.0, y: 0.0 },
        { id: 2, x: -2.0, y: 1.0 },
        { id: 3, x: -1.0, y: 2.0 },
        { id: 4, x: 0.0, y: 1.0 },
        { id: 5, x: -1.0, y: 1.0 },
        { id: 6, x: -2.0, y: -1.0 },
        { id: 7, x: -1.0, y: -2.0 },
        { id: 8, x: 0.0, y: -1.0 },
        { id: 9, x: -1.0, y: -1.0 },
        { id: 10, x: 1.0, y: 0.0 },
        { id: 11, x: 1.0, y: 2.0 },
        { id: 12, x: 2.0, y: 1.0 },
        { id: 13, x: 1.0, y: 1.0 },
        { id: 14, x: 1.0, y: -2.0 },
        { id: 15, x: 2.0, y: -1.0 },
        { id: 16, x: 1.0, y: -1.0 },
      ],
      bonds: [
        { id: 1, i: 1, j: 2, k: 1.0 },
        { id: 2, i: 2, j: 3, k: 1.0 },
        { id: 3, i: 3, j: 4, k: 1.0 },
        { id: 4, i: 1, j: 4, k: 1.0 },
        { id: 5, i: 1, j: 5, k: 0.5 },
        { id: 6, i: 2, j: 5, k: 1.0 },
        { id: 7, i: 3, j: 5, k: 1.0 },
        { id: 8, i: 4, j: 5, k: 1.0 },
        { id: 9, i: 6, j: 7, k: 1.0 },
        { id: 10, i: 7, j: 8, k: 1.0 },
        { id: 11, i: 6, j: 9, k: 1.0 },
        { id: 12, i: 7, j: 9, k: 1.0 },
        { id: 13, i: 8, j: 9, k: 1.0 },
        { id: 14, i: 6, j: 1, k: 1.0 },
        { id: 15, i: 1, j: 8, k: 1.0 },
        { id: 16, i: 9, j: 1, k: 0.5 },
        { id: 17, i: 11, j: 12, k: 1.0 },
        { id: 18, i: 10, j: 12, k: 1.0 },
        { id: 19, i: 10, j: 13, k: 0.3 },
        { id: 20, i: 11, j: 13, k: 1.0 },
        { id: 21, i: 12, j: 13, k: 1.0 },
        { id: 22, i: 14, j: 15, k: 1.0 },
        { id: 23, i: 14, j: 16, k: 1.0 },
        { id: 24, i: 15, j: 16, k: 1.0 },
        { id: 25, i: 10, j: 15, k: 1.0 },
        { id: 26, i: 16, j: 10, k: 0.3 },
        { id: 27, i: 11, j: 4, k: 1.0 },
        { id: 28, i: 13, j: 4, k: 1.0 },
        { id: 29, i: 4, j: 10, k: 1.0 },
        { id: 30, i: 10, j: 8, k: 1.0 },
        { id: 31, i: 16, j: 8, k: 1.0 },
        { id: 32, i: 8, j: 14, k: 1.0 },
      ],

    };
  })();

  const [present, setPresent] = useState<Graph>(initialGraph);
  const [past, setPast] = useState<Graph[]>([]);
  const [future, setFuture] = useState<Graph[]>([]);

  const saved = loadFromStorage();
  const [selected, setSelected] = useState<number | null>(saved?.selected ?? null);
  const [zoomPercent, setZoomPercent] = useState<number>(saved?.zoomPercent ?? 100);

  const commit = useCallback((updater: (g: Graph) => Graph) => {
    setPresent(prev => {
      const next = deepClone(updater(prev));
      if (next.atoms === prev.atoms && next.bonds === prev.bonds) return prev;
      setPast(p => [...p, deepClone(prev)]);
      setFuture([]);
      return next;
    });
  }, []);

  // ---- safe setters
  const setAtoms = useCallback((atoms: Atom[] | ((a: Atom[]) => Atom[])) => {
    commit(g => {
      const nextArr = typeof atoms === "function" ? (atoms as any)(g.atoms) : atoms;
      return { atoms: deepClone(Array.isArray(nextArr) ? nextArr : g.atoms), bonds: g.bonds };
    });
  }, [commit]);

  const setBonds = useCallback((bonds: Bond[] | ((b: Bond[]) => Bond[])) => {
    commit(g => {
      const nextArr = typeof bonds === "function" ? (bonds as any)(g.bonds) : bonds;
      return { atoms: g.atoms, bonds: deepClone(Array.isArray(nextArr) ? nextArr : g.bonds) };
    });
  }, [commit]);

  const addAtom = () => commit(g => ({ atoms: [...g.atoms, { id: nextAtomId(g.atoms), x: 0, y: 0 }], bonds: g.bonds }));
  const removeAtom = (id: number) => commit(g => ({
    atoms: g.atoms.filter(a => a.id !== id),
    bonds: g.bonds.filter(b => b.i !== id && b.j !== id),
  }));
  const addBond = () => commit(g => {
    if (g.atoms.length < 2) return g;
    const [i, j] = [g.atoms[0].id, g.atoms[1].id];
    return { atoms: g.atoms, bonds: [...g.bonds, { id: nextBondId(g.bonds), i, j, k: 1 }] };
  });

  const loadFromString = (lmpString: string) => commit(() => parseLmp(lmpString));

  const removeBond = (id: number) => commit(g => ({ atoms: g.atoms, bonds: g.bonds.filter(b => b.id !== id) }));
  const clearAtoms = () => commit(() => ({ atoms: [], bonds: [] }));
  const clearBonds = () => commit(g => ({ atoms: g.atoms, bonds: [] }));

  const removeByIds = useCallback((ids: number[]) => {
    if (!ids?.length) return;
    const target = new Set(ids);
    commit(g => ({
      atoms: g.atoms.filter(a => !target.has(a.id)),
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

  function nextBondId(list: Bond[]) {
    let m = 0;
    for (const b of list) {
      const bid = (b as any).id;
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
        atoms: g.atoms,
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
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [undo, redo]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        atoms: present.atoms,
        bonds: present.bonds,
        selected,
        zoomPercent,
      }));
    } catch { }
  }, [present, selected, zoomPercent]);

  const atoms = present.atoms;
  const bonds = present.bonds;
  const scale = zoomPercent / 100;

  return useMemo(() => ({
    atoms, bonds, setAtoms, setBonds,
    selected, setSelected,
    zoomPercent, setZoomPercent,
    scale,

    addAtom, removeAtom, addBond, removeBond, clearAtoms, clearBonds, removeByIds,
    undo, redo, canUndo, canRedo, addBondBetween, loadFromString
  }), [
    atoms, bonds, setAtoms, setBonds,
    selected, zoomPercent, scale,
    addAtom, removeAtom, addBond, removeBond, clearAtoms, clearBonds, removeByIds,
    undo, redo, canUndo, canRedo, addBondBetween, loadFromString
  ]);
}
