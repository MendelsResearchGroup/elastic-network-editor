

export type TableProps<T extends { id: number }> = {
  title: string;
  rows: T[];
  fields: FieldSpec<T>[];
  onChange: (rows: T[]) => void;
  onRemove: (id: number) => void;
  maxHeight?: number | string; 
};

export type FieldSpec<T> = {
  key: keyof T;              // property name to edit
  label: string;             // column label
  kind?: "number" | "text"; // input type
  step?: number;             // for number inputs
  widthClass?: string;       // optional width utility (e.g., w-24)
  readOnly?: boolean;        // show as text instead of input
};

export function EditableList<T extends { id: number }>({ title, rows, fields, onChange, onRemove, maxHeight = 500 }: TableProps<T>) {
  const colCount = fields.length + 1; // +1 for remove button

  function updateCell(idx: number, key: keyof T, raw: string) {
    const next = [...rows];
    const row = { ...next[idx] } as any;
    const spec = fields.find(f => f.key === key);
    if (spec?.kind === "number") {
      const v = raw === "" ? NaN : Number(raw);
      row[key] = Number.isNaN(v) ? (undefined as any) : v;
    } else {
      row[key] = raw as any;
    }
    next[idx] = row;
    onChange(next);
  }

  return (
    <div className="rounded-2xl border p-3 overflow-auto" style={{ maxHeight }}>
      <div className="font-semibold mb-2">{title}</div>

      {/* Header */}
      <div className="grid items-center text-xs font-semibold text-slate-600" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}>
        {fields.map(f => (
          <div key={String(f.key)} className="py-1 pr-2">{f.label}</div>
        ))}
        <div className="py-1 text-right">{/* actions */}</div>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {rows.map((row, idx) => (
          <div key={row.id} className="grid items-center" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0,1fr))` }}>
            {fields.map(spec => {
              const value = (row as any)[spec.key];
              const common = "border rounded px-2 py-1 text-sm" + (spec.widthClass ? ` ${spec.widthClass}` : "");
              return (
                <div key={String(spec.key)} className="py-1 pr-2">
                  {spec.readOnly ? (
                    <div className="text-sm">{String(value)}</div>
                  ) : spec.kind === "number" ? (
                    <input
                      className={common}
                      type="number"
                      value={value}
                      step={spec.step ?? 1}
                      onChange={e => updateCell(idx, spec.key, e.target.value)}
                    />
                  ) : (
                    <input
                      className={common}
                      type="text"
                      value={value}
                      onChange={e => updateCell(idx, spec.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
            <div className="py-1 text-right">
              <button className="text-red-600 text-sm" onClick={() => onRemove(row.id)}>remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
