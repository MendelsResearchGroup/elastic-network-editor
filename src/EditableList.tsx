import { useState } from "react";

export type TableProps<T extends { id: number }> = {
  title: string;
  rows: T[];
  fields: FieldSpec<T>[];
  onChange: (rows: T[]) => void;
  onRemove: (id: number) => void;
  maxHeight?: number | string;
  dense?: boolean;
};

export type FieldSpec<T> = {
  key: keyof T;
  label: string;
  kind?: "number" | "text";
  readOnly?: boolean;
  widthClass?: string;
};

export function EditableList<T extends { id: number }>({
  title,
  rows,
  fields,
  onChange,
  onRemove,
  maxHeight = 300,
  dense = true,
}: TableProps<T>) {
  const cellPad = dense ? "px-2 py-1" : "px-3 py-2";

  const keyFor = (rowId: number, k: keyof T) => `${rowId}:${String(k)}`;

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const getDisplay = (row: T, k: keyof T) => {
    const kf = keyFor(row.id, k);
    if (kf in drafts) return drafts[kf];
    const v = (row as any)[k];
    return v === undefined || v === null ? "" : String(v);
  };

  const setDraft = (rowId: number, k: keyof T, v: string) =>
    setDrafts((d) => ({ ...d, [keyFor(rowId, k)]: v }));

  const clearDraft = (rowId: number, k: keyof T) =>
    setDrafts((d) => {
      const n = { ...d };
      delete n[keyFor(rowId, k)];
      return n;
    });

  const isNumericTyping = (s: string) =>
    /^-?\d*(\.\d*)?$/.test(s.trim()); // allows "", "-", "1.", "-0.3", etc. while typing

  const parseNumberStrict = (s: string) => {
    const t = s.trim();
    if (t === "" || t === "-" || t === "." || t === "-.") return undefined;
    const v = Number(t);
    return Number.isFinite(v) ? v : undefined;
  };

  const commitNumber = (rowIdx: number, k: keyof T, s: string) => {
    const v = parseNumberStrict(s);
    if (v === undefined) {
      // revert to original value
      clearDraft(rows[rowIdx].id, k);
      return;
    }
    const next = [...rows];
    next[rowIdx] = { ...(next[rowIdx] as any), [k]: v };
    onChange(next);
    clearDraft(next[rowIdx].id, k);
  };

  const commitText = (rowIdx: number, k: keyof T, s: string) => {
    const next = [...rows];
    next[rowIdx] = { ...(next[rowIdx] as any), [k]: s };
    onChange(next);
    clearDraft(next[rowIdx].id, k);
  };

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-white">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-slate-500 tabular-nums">{rows.length} rows</div>
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        <div
          className="grid text-sm"
          style={{
            gridTemplateColumns: `repeat(${fields.length + 1}, minmax(0,1fr))`,
          }}
        >
          {/* Header */}
          <div className="contents sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b text-slate-600 font-semibold">
            {fields.map((f) => (
              <div key={String(f.key)} className={`${cellPad} ${f.widthClass ?? ""}`}>
                {f.label}
              </div>
            ))}
            <div className={`${cellPad} text-right`} />
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="col-span-full px-3 py-6 text-center text-slate-400">No rows yet</div>
          ) : (
            rows.map((row, idx) => (
              <div
                key={row.id}
                className="contents even:bg-slate-50 hover:bg-slate-100"
              >
                {fields.map((spec) => {
                  const val = getDisplay(row, spec.key);
                  const cls = `w-full border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 ${cellPad} ${spec.widthClass ?? ""}`;
                  if (spec.readOnly) {
                    return (
                      <div key={String(spec.key)} className={`${cellPad} ${spec.widthClass ?? ""}`}>
                        {val}
                      </div>
                    );
                  }
                  if (spec.kind === "number") {
                    return (
                      <div key={String(spec.key)} className={`${cellPad} ${spec.widthClass ?? ""}`}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={cls}
                          value={val}
                          onChange={(e) => {
                            const nv = e.target.value;
                            if (nv === "" || isNumericTyping(nv)) {
                              setDraft(row.id, spec.key, nv);
                            }
                          }}
                          onBlur={(e) => commitNumber(idx, spec.key, e.target.value)}
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={String(spec.key)} className={`${cellPad} ${spec.widthClass ?? ""}`}>
                      <input
                        type="text"
                        className={cls}
                        value={val}
                        onChange={(e) => setDraft(row.id, spec.key, e.target.value)}
                        onBlur={(e) => commitText(idx, spec.key, e.target.value)}
                      />
                    </div>
                  );
                })}
                <div className={`${cellPad} text-right`}>
                  <button
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => onRemove(row.id)}
                    aria-label={`Remove row ${row.id}`}
                    title="Remove"
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
