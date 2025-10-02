function AtomTable({ rows, onChange, onRemove }: TableProps<Atom>) {
  return (
    <div className="rounded-2xl border p-3 overflow-auto max-h-[260px]">
      <div className="font-semibold mb-2">Atoms</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className="py-1">id</th>
            <th className="py-1">x</th>
            <th className="py-1">y</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id} className="border-t">
              <td className="py-1 pr-2">{a.id}</td>
              <td className="py-1 pr-2"><input className="w-24 border rounded px-2 py-1" type="number" step={0.001} value={a.x}
                onChange={e => onChange(rows.map(x => x.id === a.id ? { ...x, x: parseFloat(e.target.value) } : x))} /></td>
              <td className="py-1 pr-2"><input className="w-24 border rounded px-2 py-1" type="number" step={0.001} value={a.y}
                onChange={e => onChange(rows.map(x => x.id === a.id ? { ...x, y: parseFloat(e.target.value) } : x))} /></td>
              <td className="py-1 text-right"><button className="text-red-600" onClick={() => onRemove(a.id)}>remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}