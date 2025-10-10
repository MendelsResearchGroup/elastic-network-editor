import type { Atom, Bond, BondTypes } from "./model";
import { angleTheta } from "./utils";

function distance(a: Atom, b: Atom) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const generateLmp = (
  atoms: Atom[],
  bonds: Bond[],
  bondTypes: BondTypes
) => {
  // infer angles
  const neighbors = new Map<number, number[]>();
  bonds.forEach(b => {
    if (!neighbors.has(b.i)) neighbors.set(b.i, []);
    if (!neighbors.has(b.j)) neighbors.set(b.j, []);
    neighbors.get(b.i)!.push(b.j);
    neighbors.get(b.j)!.push(b.i);
  });

  const inferredAngles: { i: number; j: number; k: number }[] = [];
  for (const [j, neigh] of neighbors) {
    if (neigh.length < 2) continue;
    const uniq = Array.from(new Set(neigh)).sort((a, b) => a - b);
    for (let a = 0; a < uniq.length; a++) {
      for (let b = a + 1; b < uniq.length; b++) {
        inferredAngles.push({ i: uniq[a], j, k: uniq[b] });
      }
    }
  }

  const nat = atoms.length;
  const nb = bonds.length;
  const na = inferredAngles.length;

  const bondTypeIds = new Map<number, number>();
  let nextBT = 1;
  for (const b of bonds) {
    if (!bondTypeIds.has(b.k)) bondTypeIds.set(b.k, nextBT++);
  }
  const nbt = Math.max(1, bondTypeIds.size);

  const naty = 1;
  const natet = Math.max(1, na);

  const atomIndexMap = new Map(atoms.map((a, idx) => [a.id, idx + 1] as const));

  // --- compute box bounds from atom coords ---
  const xs = atoms.map(a => a.x);
  const ys = atoms.map(a => a.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // add small padding
  const pad = 0.1;
  const xlo = minX - pad;
  const xhi = maxX + pad;
  const ylo = minY - pad;
  const yhi = maxY + pad;

  // flat system in z, small thickness
  const zlo = -0.1;
  const zhi = 0.1;

  const lines: string[] = ["LAMMPS data file.", ""];
  lines.push(`${nat} atoms`);
  lines.push(`${nb} bonds`);
  lines.push(`${na} angles`);
  lines.push(`0 dihedrals`);
  lines.push(`0 impropers`);
  lines.push(`${naty} atom types`);
  lines.push(`${nbt} bond types`);
  lines.push(`${natet} angle types`);
  lines.push(`0 dihedral types`);
  lines.push(`0 improper types`);
  lines.push(`${xlo.toFixed(6)} ${xhi.toFixed(6)} xlo xhi`);
  lines.push(`${ylo.toFixed(6)} ${yhi.toFixed(6)} ylo yhi`);
  lines.push(`${zlo.toFixed(6)} ${zhi.toFixed(6)} zlo zhi`);
  lines.push(`0.0 0.0 0.0 xy xz yz`);
  lines.push("");

  lines.push("Masses");
  lines.push("");
  lines.push(`1 1.0`);
  lines.push("");

  lines.push("Atoms # ['atomID', 'moleculeID', 'atomType', 'charge', 'x', 'y', 'z']");
  lines.push("");
  atoms.forEach((a, idx) => {
    const id = idx + 1;
    const mol = 1;
    const type = 1;
    const q = 0.0;
    lines.push(`${id} ${mol} ${type} ${q.toFixed(6)} ${a.x.toFixed(6)} ${a.y.toFixed(6)} 0.000000`);
  });
  lines.push("");

  lines.push("Bonds # ['ID', 'type', 'atom1', 'atom2']");
  lines.push("");
  bonds.forEach((b, bi) => {
    const t = bondTypeIds.get(b.k) || 1;
    const i = atomIndexMap.get(b.i)!;
    const j = atomIndexMap.get(b.j)!;
    lines.push(`${bi + 1} ${t} ${i} ${j}`);
  });
  lines.push("");

  lines.push("Angles");
  lines.push("");
  inferredAngles.forEach((a, ai) => {
    const t = ai + 1;
    const i = atomIndexMap.get(a.i)!;
    const j = atomIndexMap.get(a.j)!;
    const k = atomIndexMap.get(a.k)!;
    lines.push(`${ai + 1} ${t} ${i} ${j} ${k}`);
  });
  lines.push("");

  lines.push("Bond Coeffs # ['bondID', 'bondCoeff', 'd']");
  lines.push("");
  if (!bonds.length) { 
    throw new Error('Must have bonds')
  }
  
  const seen = new Set<number>();
  bonds.forEach(b => {
    if (seen.has(b.k)) return;
    seen.add(b.k);
    const t = bondTypeIds.get(b.k)!;
    const ai = atoms.find(x => x.id === b.i)!;
    const aj = atoms.find(x => x.id === b.j)!;
    const r0 = distance(ai, aj);
    lines.push(`${t} ${b.k} ${r0.toFixed(6)}`);
  });

  lines.push("");

  lines.push("Angle Coeffs");
  lines.push("");
  if (inferredAngles.length) {
    inferredAngles.forEach((a, ai) => {
      const aiA = atoms.find(x => x.id === a.i)!;
      const ajA = atoms.find(x => x.id === a.j)!;
      const akA = atoms.find(x => x.id === a.k)!;
      const th0 = angleTheta(aiA, ajA, akA) * 180 / Math.PI;
      const t = ai + 1;
      lines.push(`${t} 0.01 ${th0.toFixed(6)}`);
    });
  } else {
    lines.push(`1 0.0 120.000000`);
  }
  lines.push("");

  return lines.join("\n");
};

// grab the text block under a header until the next header or EOF
function section(src: string, name: string): string {
  const re = new RegExp(
    `(?:^|\\n)\\s*${name}\\b[^\\n]*\\n+([\\s\\S]*?)(?=\\n\\s*(?:Atoms|Bonds|Angles|Masses|Bond\\s+Coeffs|Angle\\s+Coeffs)\\b|$)`,
    "i"
  );
  const m = src.match(re);
  return m ? m[1].trim() : "";
}

export function parseLmp(lmp: string): { atoms: Atom[]; bonds: Bond[] } {
  const atomsTxt = section(lmp, "Atoms");
  const bondsTxt = section(lmp, "Bonds");
  const bondCoeffsTxt = section(lmp, "Bond Coeffs");

  const typeIdToK = (() => {
    const map = new Map<number, number>();
    if (!bondCoeffsTxt) return map;
    for (const line of bondCoeffsTxt.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || !/^\d/.test(t)) continue;
      const [typeId, k] = t.split(/\s+/).map(Number);
      if (Number.isFinite(typeId) && Number.isFinite(k)) map.set(typeId, k);
    }
    return map;
  })();

  const atoms: Atom[] = atomsTxt
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s && /^\d/.test(s))
    .map(s => {
      const p = s.split(/\s+/);
      return { id: +p[0], x: +p[4], y: +p[5] };
    });

  const bonds: Bond[] = bondsTxt
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s && /^\d/.test(s))
    .map(s => {
      const p = s.split(/\s+/);
      const id = +p[0];
      const typeId = +p[1];
      const i = +p[2];
      const j = +p[3];
      const k = typeIdToK.get(typeId) ?? 1;
      return { id, i, j, k };
    });

  return { atoms, bonds };
}