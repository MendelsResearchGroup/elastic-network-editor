import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Atom, Bond } from "./model";

type CanvasViewProps = {
  atoms: Atom[];
  bonds: Bond[];
  scale: number;
  selected: number | null;
  setSelected: (id: number | null) => void;
  setAtoms: React.Dispatch<React.SetStateAction<Atom[]>>;
  setBonds: React.Dispatch<React.SetStateAction<Bond[]>>;
  removeByIds: (ids: number[]) => void; 
  addBondBetween: (i: number, j: number, k?: number) => void; 
};

export default function CanvasView({
  atoms,
  bonds,
  scale,
  selected,
  setSelected,
  setAtoms,
  setBonds,
  removeByIds,
  addBondBetween, 
}: CanvasViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dragRef = useRef<{
    start: { x: number; y: number };
    last: { x: number; y: number };
    id: number | null;
    pressed: boolean;
    moved: boolean;
    groupDrag: boolean;
    dx?: number; dy?: number;
  } | null>(null);

  const byId = useMemo(() => new Map(atoms.map(a => [a.id, a])), [atoms]);
  const WORLD = 50;
  const MOVE_EPS = 3 / (scale * WORLD);

  const [gridSnap, setGridSnap] = useState(true);
  const [gridShow, setGridShow] = useState(true);
  const [gridSize, setGridSize] = useState(0.5);
  const snap = (v: number) => gridSnap ? Math.round(v / gridSize) * gridSize : v;

  const selectionRef = useRef<Set<number>>(new Set(selected != null ? [selected] : []));
  const [tick, setTick] = useState(0);
  function setSelection(next: Set<number>) {
    selectionRef.current = next;
    if (next.size === 1) setSelected([...next][0]); else setSelected(null);
    setTick(t => t + 1);
  }
  useEffect(() => {
    if (selected != null && !selectionRef.current.has(selected)) setSelection(new Set([selected]));
  }, [selected]);

  const atomsRef = useRef(atoms); useEffect(() => { atomsRef.current = atoms; }, [atoms]);
  const bondsRef = useRef(bonds); useEffect(() => { bondsRef.current = bonds; }, [bonds]);

  const editorInputRef = useRef<HTMLInputElement>(null);
  const [editor, setEditor] = useState<null | { bondId: number; value: string; left: number; top: number }>(null);

  const validateStr = (s: string) => {
    if (s === "" || s === "-" || s === "." || s === "-.") return false;
    const n = Number(s); return Number.isFinite(n);
  };
  function commitEditorIfOpen(save: boolean) {
    if (!editor) return;
    if (save && validateStr(editor.value)) {
      const val = Number(editor.value);
      const id = editor.bondId;
      setBonds(prev => prev.map(b => (b.id === id ? { ...b, k: val } : b)));
    }
    setEditor(null);
  }

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const xDev = (e.clientX - rect.left) * dpr; const yDev = (e.clientY - rect.top) * dpr;
    const a = dpr * scale * WORLD;
    return { x: (xDev - c.width / 2) / a, y: (yDev - c.height / 2) / a };
  }
  function worldToCanvasCss(x: number, y: number) {
    const c = canvasRef.current!; const dpr = window.devicePixelRatio || 1;
    const a = dpr * scale * WORLD; const xDev = x * a + c.width / 2; const yDev = y * a + c.height / 2;
    return { cx: xDev / dpr, cy: yDev / dpr };
  }
  function hitTestAtom(x: number, y: number) {
    const r = 12 / (scale * WORLD);
    for (let i = atoms.length - 1; i >= 0; i--) {
      const a = atoms[i];
      if (Math.hypot(a.x - x, a.y - y) <= r) return a.id;
    }
    return null;
  }

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth, cssH = c.clientHeight;
    c.width = Math.max(1, Math.floor(cssW * dpr));
    c.height = Math.max(1, Math.floor(cssH * dpr));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr * scale * WORLD, 0, 0, dpr * scale * WORLD, c.width / 2, c.height / 2);

    const px = (n: number) => n / (scale * WORLD);

    if (gridShow) {
      const halfW = c.width / (2 * dpr * scale * WORLD);
      const halfH = c.height / (2 * dpr * scale * WORLD);
      const gs = gridSize;
      const majorEvery = 10;

      ctx.save();
      ctx.lineWidth = px(1);
      ctx.globalAlpha = 0.85;

      const xStart = Math.ceil((-halfW) / gs) * gs;
      const xEnd = Math.floor((halfW) / gs) * gs;
      for (let x = xStart; x <= xEnd; x = +(x + gs).toFixed(12)) {
        const major = Math.round(x / gs) % majorEvery === 0;
        ctx.beginPath();
        ctx.moveTo(x, -halfH);
        ctx.lineTo(x, halfH);
        ctx.strokeStyle = major ? "#94a3b8" : "#e2e8f0";
        ctx.globalAlpha = major ? 0.9 : 0.7;
        ctx.stroke();
      }

      const yStart = Math.ceil((-halfH) / gs) * gs;
      const yEnd = Math.floor((halfH) / gs) * gs;
      for (let y = yStart; y <= yEnd; y = +(y + gs).toFixed(12)) {
        const major = Math.round(y / gs) % majorEvery === 0;
        ctx.beginPath();
        ctx.moveTo(-halfW, y);
        ctx.lineTo(halfW, y);
        ctx.strokeStyle = major ? "#94a3b8" : "#e2e8f0";
        ctx.globalAlpha = major ? 0.9 : 0.7;
        ctx.stroke();
      }
      ctx.restore();
    }

    const px2 = (n: number) => n / (scale * WORLD);

    ctx.lineWidth = px2(2);
    ctx.globalAlpha = 0.95;
    bonds.forEach(b => {
      const ai = byId.get(b.i), aj = byId.get(b.j); if (!ai || !aj) return;
      const bothSel = selectionRef.current.has(b.i) && selectionRef.current.has(b.j);
      ctx.beginPath(); ctx.moveTo(ai.x, ai.y); ctx.lineTo(aj.x, aj.y);
      ctx.strokeStyle = bothSel ? "#1e40af" : "#334155";
      ctx.lineWidth = bothSel ? px2(3) : px2(2);
      ctx.stroke();

      const mx = (ai.x + aj.x) / 2, my = (ai.y + aj.y) / 2;
      const label = `k=${b.k}`;
      ctx.font = `${px2(12)}px ui-sans-serif`;
      const metrics = ctx.measureText(label);
      const padX = px2(4), h = px2(16);
      ctx.save(); ctx.translate(mx, my);
      ctx.globalAlpha = 0.92; ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = px2(1);
      roundedRect(ctx, -(metrics.width/2 + padX), -h/2, metrics.width + padX*2, h, px2(6));
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = "#0f172a";
      ctx.fillText(label, -metrics.width/2, px2(4.5));
      ctx.restore();
    });

    ctx.globalAlpha = 1;
    atoms.forEach(a => {
      const sel = selectionRef.current.has(a.id);
      const r = px2(8);
      if (sel) {
        ctx.beginPath(); ctx.arc(a.x, a.y, r * 1.65, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59,130,246,0.20)"; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      ctx.fillStyle = sel ? "#2563eb" : "#0ea5e9"; ctx.fill();
      ctx.lineWidth = sel ? px2(3) : px2(2); ctx.strokeStyle = sel ? "#1e3a8a" : "#0c4a6e"; ctx.stroke();
      ctx.fillStyle = "#111827"; ctx.font = `${px2(12)}px ui-sans-serif`; ctx.fillText(`${a.id}`, a.x + px2(10), a.y - px2(10));
    });
  }, [atoms, bonds, scale, byId, tick, gridShow, gridSize]);

  function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    wrapperRef.current?.focus({ preventScroll: true });
    if (editor && e.target !== editorInputRef.current) commitEditorIfOpen(true);
    e.preventDefault();
    const p = getCanvasPoint(e);
    const id = hitTestAtom(p.x, p.y);
    const isSelected = id != null && selectionRef.current.has(id);
    dragRef.current = { start: p, last: p, id: id ?? null, pressed: true, moved: false, groupDrag: !!isSelected };
    if (id != null && !isSelected) {
      const a = byId.get(id); if (a) { dragRef.current.dx = p.x - a.x; dragRef.current.dy = p.y - a.y; }
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current; if (!d || !d.pressed || !(e.buttons & 1)) return;
    const p = getCanvasPoint(e);

    if (!d.moved) {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > MOVE_EPS) d.moved = true; else return;
    }

    if (d.groupDrag && selectionRef.current.size > 0) {
      const ddx = p.x - d.last.x, ddy = p.y - d.last.y;
      if (ddx || ddy) {
        const sel = selectionRef.current;
        setAtoms(prev => prev.map(a => {
          if (!sel.has(a.id)) return a;
          const nx = a.x + ddx, ny = a.y + ddy;
          return { ...a, x: snap(nx), y: snap(ny) };
        }));
        d.last = p;
      }
    } else if (d.id != null) {
      const { dx = 0, dy = 0 } = d;
      const nx = p.x - dx, ny = p.y - dy;
      setAtoms(prev => prev.map(a => (a.id === d.id ? { ...a, x: snap(nx), y: snap(ny) } : a)));
      d.last = p;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d) return;

    if (!d.moved) {
      const id = d.id;
      if (id != null) {
        if (e.shiftKey) {
          const next = new Set(selectionRef.current);
          if (next.has(id)) next.delete(id); else next.add(id);
          setSelection(next);
        } else {
          setSelection(new Set([id]));
        }
      } else {
        if (!e.shiftKey) setSelection(new Set());
      }
      setTick(t => t + 1);
    }
    dragRef.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e);
    let best: { id: number; mx: number; my: number; dist: number; k: number } | null = null;
    for (const b of bondsRef.current) {
      const ai = byId.get(b.i), aj = byId.get(b.j); if (!ai || !aj) continue;
      const mx = (ai.x + aj.x) / 2, my = (ai.y + aj.y) / 2;
      const d = Math.hypot(mx - p.x, my - p.y);
      if (!best || d < best.dist) best = { id: b.id, mx, my, dist: d, k: b.k };
    }
    if (!best) return;
    const hitRadius = 18 / (scale * WORLD); if (best.dist > hitRadius) return;
    const { cx, cy } = worldToCanvasCss(best.mx, best.my);
    setEditor({ bondId: best.id, value: String(best.k), left: cx, top: cy });
  };

  function nextAtomId(list: Atom[]) { let m = 0; for (const a of list) if (typeof a.id === "number" && a.id > m) m = a.id; return m + 1; }
  function nextBondId(list: Bond[]) { let m = 0; for (const b of list) if (typeof b.id === "number" && (b as any).id > m) m = (b as any).id; return m + 1; }

  function copySelection() {
    const sel = selectionRef.current; if (sel.size === 0) return null;
    const A = atomsRef.current.filter(a => sel.has(a.id)).map(a => ({ ...a }));
    const idSet = new Set(A.map(a => a.id));
    const B = bondsRef.current.filter(b => idSet.has(b.i) && idSet.has(b.j)).map(b => ({ ...b }));
    return { A, B };
  }

  function pasteSelection(payload?: { A: Atom[]; B: Bond[] }) {
    const data = payload ?? copySelection(); if (!data || data.A.length === 0) return;
    const srcAtoms = data.A, srcBonds = data.B;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of srcAtoms) { if (a.x < minX) minX = a.x; if (a.y < minY) minY = a.y; if (a.x > maxX) maxX = a.x; if (a.y > maxY) maxY = a.y; }
    const w = maxX - minX, h = maxY - minY;
    const dx = Math.max(0.06, w * 0.15), dy = Math.max(0.06, h * 0.15);

    const atomStart = nextAtomId(atomsRef.current);
    const bondStart = nextBondId(bondsRef.current);

    const idMap = new Map<number, number>();
    let nextId = atomStart;
    const newAtoms: Atom[] = srcAtoms.map(a => { const nid = nextId++; idMap.set(a.id, nid); return { ...a, id: nid, x: snap(a.x + dx), y: snap(a.y + dy) }; });
    let nextBond = bondStart;
    const newBonds: Bond[] = srcBonds.map(b => ({ ...b, id: nextBond++, i: idMap.get(b.i)!, j: idMap.get(b.j)! }));

    setAtoms(prev => [...prev, ...newAtoms]);
    setBonds(prev => [...prev, ...newBonds]);
    setSelection(new Set(newAtoms.map(a => a.id)));
  }

  const onWrapperKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (editor && document.activeElement === editorInputRef.current) return;

    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (key === "Delete" || key === "Backspace" || e.code === "Delete" || e.code === "Backspace") {
      const ids = [...selectionRef.current];
      if (ids.length) {
        commitEditorIfOpen(true);
        removeByIds(ids);
        setSelection(new Set());
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (mod && (key === "c" || key === "C")) {
      const payload = copySelection();
      if (payload) { (window as any).__atomClipboard = payload; e.preventDefault(); e.stopPropagation(); }
      return;
    }

    if (mod && (key === "v" || key === "V")) {
      const payload = (window as any).__atomClipboard as { A: Atom[]; B: Bond[] } | undefined;
      if (!payload && selectionRef.current.size > 0) {
        const p = copySelection(); if (p) (window as any).__atomClipboard = p;
      }
      pasteSelection((window as any).__atomClipboard);
      e.preventDefault(); e.stopPropagation();
      return;
    }

    if (mod && (key === "b" || key === "B")) {
      const ids = [...selectionRef.current];
      if (ids.length === 2) {
        addBondBetween(ids[0], ids[1], 1);
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
  };

  useEffect(() => {
    const el = wrapperRef.current; if (!el) return;
    const handler = (ev: MouseEvent) => {
      if (!editor) return;
      if (ev.target === editorInputRef.current) return;
      commitEditorIfOpen(true);
    };
    el.addEventListener("mousedown", handler, { capture: true });
    return () => el.removeEventListener("mousedown", handler, { capture: true } as any);
  }, [editor]);

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={onWrapperKeyDown}
      className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative outline-none"
    >
      <style>{`
        .bond-k-input { -moz-appearance: textfield; }
        .bond-k-input::-webkit-outer-spin-button,
        .bond-k-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>

      <canvas
        ref={canvasRef}
        className="w-full h-full bg-slate-50"
        style={{ touchAction: "none", cursor: dragRef.current?.pressed ? "grabbing" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {editor && (
        <input
          ref={editorInputRef}
          className="bond-k-input absolute z-10 rounded-xl shadow-sm px-2 py-1 text-xs font-mono bg-white
                     border border-slate-300 outline-none focus:border-sky-400 ring-2 ring-sky-300"
          type="number" inputMode="decimal" step="0.001"
          value={editor.value}
          onChange={(e) => setEditor(ed => ed ? { ...ed, value: e.target.value } : ed)}
          onBlur={() => commitEditorIfOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { commitEditorIfOpen(false); }
            else if (e.key === "Enter") { (e.currentTarget as HTMLInputElement).blur(); }
          }}
          style={{ left: editor.left + 8, top: editor.top - 12, width: 88 }}
          autoFocus
        />
      )}

      <div className="px-3 py-2 text-xs border-t bg-white flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={gridShow} onChange={(e) => { setGridShow(e.target.checked); setTick(t=>t+1); }} />
            <span>Grid</span>
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={gridSnap} onChange={(e) => setGridSnap(e.target.checked)} />
            <span>Snap</span>
          </label>
        </div>
        <div className="flex items-center gap-1">
          <span>Spacing</span>
          <select
            value={String(gridSize)}
            onChange={(e) => { setGridSize(parseFloat(e.target.value)); setTick(t=>t+1); }}
            className="border rounded-md px-1 py-[2px]"
          >
            <option value="0.5">0.5</option>
            <option value="0.25">0.25</option>
            <option value="0.1">0.1</option>
            <option value="0.05">0.05</option>
            <option value="0.01">0.01</option>
          </select>
        </div>
        <div className="ml-auto">
          Click to select (Shift+click adds/removes). Drag any selected atom to move the group. Delete/Backspace removes. Ctrl/⌘+C / Ctrl/⌘+V duplicates. Double-click a <code>k=</code> to edit.
        </div>
      </div>
    </div>
  );
}
