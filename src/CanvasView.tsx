import React, { useEffect, useMemo, useRef } from "react";
import type { Atom, Bond } from "./model";

type CanvasViewProps = {
  atoms: Atom[];
  bonds: Bond[];
  scale: number;
  selected: number | null;
  setSelected: (id: number | null) => void;
  setAtoms: React.Dispatch<React.SetStateAction<Atom[]>>;
  setBonds: React.Dispatch<React.SetStateAction<Bond[]>>;
};

export default function CanvasView({
  atoms,
  bonds,
  scale,
  selected,
  setSelected,
  setAtoms,
  setBonds,
}: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: "atom" | "group"; id?: number; dx?: number; dy?: number; start?: { x: number; y: number }; last?: { x: number; y: number } } | null>(null);
  const byId = useMemo(() => new Map(atoms.map(a => [a.id, a])), [atoms]);

  const WORLD = 50;

  const selectionRef = useRef<Set<number>>(new Set(selected ? [selected] : []));
  useEffect(() => {
    if (selected != null && !selectionRef.current.has(selected)) {
      selectionRef.current = new Set([selected]);
    }
  }, [selected]);

  const marqueeRef = useRef<null | { x0: number; y0: number; x1: number; y1: number }>(null);
  const clipboardRef = useRef<{ atoms: Atom[]; bonds: Bond[] } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    c.width = Math.max(1, Math.floor(cssW * dpr));
    c.height = Math.max(1, Math.floor(cssH * dpr));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * scale * WORLD, 0, 0, dpr * scale * WORLD, c.width / 2, c.height / 2);

    const px = (n: number) => n / (scale * WORLD);

    ctx.lineWidth = px(2);
    ctx.globalAlpha = 0.95;
    bonds.forEach(b => {
      const ai = byId.get(b.i), aj = byId.get(b.j);
      if (!ai || !aj) return;
      const bothSel = selectionRef.current.has(ai.id) && selectionRef.current.has(aj.id);
      ctx.beginPath();
      ctx.moveTo(ai.x, ai.y);
      ctx.lineTo(aj.x, aj.y);
      ctx.strokeStyle = bothSel ? "#1e40af" : "#334155";
      ctx.stroke();
      const mx = (ai.x + aj.x) / 2, my = (ai.y + aj.y) / 2;
      ctx.fillStyle = "#111827";
      ctx.font = `${px(12)}px ui-sans-serif`;
      ctx.fillText(`k=${b.k}`, mx + px(6), my - px(6));
    });

    ctx.globalAlpha = 1;
    atoms.forEach(a => {
      const sel = selectionRef.current.has(a.id);
      ctx.beginPath();
      ctx.arc(a.x, a.y, px(8), 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#2563eb" : "#0ea5e9";
      ctx.fill();
      ctx.strokeStyle = sel ? "#1e3a8a" : "#0c4a6e";
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.font = `${px(12)}px ui-sans-serif`;
      ctx.fillText(`${a.id}`, a.x + px(10), a.y - px(10));
    });

    if (marqueeRef.current) {
      const { x0, y0, x1, y1 } = marqueeRef.current;
      const x = Math.min(x0, x1), y = Math.min(y0, y1);
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      ctx.save();
      const px1 = px(1.5);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = px1;
      ctx.strokeStyle = "#3b82f6";
      ctx.setLineDash([px(6), px(6)]);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, [atoms, bonds, scale, byId]);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const xDev = ("clientX" in e ? e.clientX : 0) - rect.left;
    const yDev = ("clientY" in e ? e.clientY : 0) - rect.top;
    const xDevice = xDev * dpr, yDevice = yDev * dpr;
    const a = dpr * scale * WORLD;
    const x = (xDevice - c.width / 2) / a;
    const y = (yDevice - c.height / 2) / a;
    return { x, y };
  }

  function hitTest(x: number, y: number) {
    const r = 12 / (scale * WORLD);
    for (let i = atoms.length - 1; i >= 0; i--) {
      const a = atoms[i];
      if (Math.hypot(a.x - x, a.y - y) <= r) return a.id;
    }
    return null;
  }

  function setSelection(next: Set<number>) {
    selectionRef.current = next;
    if (next.size === 1) setSelected([...next][0]);
    else setSelected(null);
    canvasRef.current?.dispatchEvent(new Event("refresh"));
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = getCanvasPoint(e);
    const id = hitTest(p.x, p.y);
    const sel = new Set(selectionRef.current);

    if (e.shiftKey) {
      marqueeRef.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      dragRef.current = { mode: "group", start: p, last: p };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (id != null) {
      if (!sel.has(id)) setSelection(new Set([id]));
      const a = atoms.find(x => x.id === id)!;
      dragRef.current = {
        mode: selectionRef.current.size > 1 ? "group" : "atom",
        id,
        dx: p.x - a.x,
        dy: p.y - a.y,
        start: p,
        last: p,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      setSelection(new Set());
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || !(e.buttons & 1)) return;
    const p = getCanvasPoint(e);
    if (marqueeRef.current) {
      marqueeRef.current.x1 = p.x;
      marqueeRef.current.y1 = p.y;
      canvasRef.current?.dispatchEvent(new Event("refresh"));
      return;
    }
    const { mode, id, dx, dy, last } = dragRef.current;
    if (mode === "atom" && id != null) {
      setAtoms(prev => prev.map(a => (a.id === id ? { ...a, x: p.x - (dx ?? 0), y: p.y - (dy ?? 0) } : a)));
    } else if (mode === "group" && last) {
      const ddx = p.x - last.x, ddy = p.y - last.y;
      if (ddx === 0 && ddy === 0) return;
      const s = selectionRef.current;
      setAtoms(prev => prev.map(a => (s.has(a.id) ? { ...a, x: a.x + ddx, y: a.y + ddy } : a)));
      dragRef.current.last = p;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (marqueeRef.current) {
      const { x0, y0, x1, y1 } = marqueeRef.current;
      const xMin = Math.min(x0, x1), xMax = Math.max(x0, x1);
      const yMin = Math.min(y0, y1), yMax = Math.max(y0, y1);
      const next = new Set<number>();
      atoms.forEach(a => {
        if (a.x >= xMin && a.x <= xMax && a.y >= yMin && a.y <= yMax) next.add(a.id);
      });
      setSelection(next);
      marqueeRef.current = null;
      canvasRef.current?.dispatchEvent(new Event("refresh"));
    }
    dragRef.current = null;
  };

  function copySelectionToClipboardRef() {
    const sel = selectionRef.current;
    const selAtoms = atoms.filter(a => sel.has(a.id));
    const idSet = new Set(selAtoms.map(a => a.id));
    const selBonds = bonds.filter(b => idSet.has(b.i) && idSet.has(b.j));
    clipboardRef.current = { atoms: selAtoms.map(a => ({ ...a })), bonds: selBonds.map(b => ({ ...b })) };
  }

  function pasteClipboard(offset = { dx: 0.06, dy: 0.06 }) {
    const clip = clipboardRef.current;
    if (!clip || clip.atoms.length === 0) return;
    const maxId = atoms.reduce((m, a) => Math.max(m, a.id), 0);
    const idsSorted = [...clip.atoms].map(a => a.id).sort((a, b) => a - b);
    const idMap = new Map<number, number>();
    idsSorted.forEach((oldId, idx) => idMap.set(oldId, maxId + 1 + idx));
    const newAtoms: Atom[] = clip.atoms.map(a => ({ ...a, id: idMap.get(a.id)!, x: a.x + offset.dx, y: a.y + offset.dy }));
    const newBonds: Bond[] = clip.bonds.map(b => ({ ...b, i: idMap.get(b.i)!, j: idMap.get(b.j)! }));
    setAtoms(prev => [...prev, ...newAtoms]);
    setBonds(prev => [...prev, ...newBonds]);
    setSelection(new Set(newAtoms.map(a => a.id)));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();
      if (key === "c") {
        if (selectionRef.current.size === 0) return;
        copySelectionToClipboardRef();
        e.preventDefault();
      } else if (key === "v") {
        if (!clipboardRef.current || clipboardRef.current.atoms.length === 0) {
          if (selectionRef.current.size > 0) copySelectionToClipboardRef();
        }
        pasteClipboard();
        e.preventDefault();
      } else if (key === "d") {
        if (selectionRef.current.size > 0 && (!clipboardRef.current || clipboardRef.current.atoms.length === 0)) {
          copySelectionToClipboardRef();
        }
        pasteClipboard();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [atoms, bonds]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rerender = () => {};
    c.addEventListener("refresh", rerender as any);
    return () => c.removeEventListener("refresh", rerender as any);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-[420px] bg-slate-50"
        style={{ touchAction: "none", cursor: marqueeRef.current ? "crosshair" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="px-3 py-2 text-xs border-t bg-white">
        Shift+drag to box-select. Drag a selected atom to move group. Ctrl/⌘+C, then Ctrl/⌘+V (or Ctrl/⌘+D) to duplicate.
      </div>
    </div>
  );
}
