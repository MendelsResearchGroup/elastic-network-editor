import type { Atom, Bond, Graph, ImportedModel } from "./model";
import { angleTheta } from "./utils.ts";

function anglesFromDrawing(atoms: Map<number, Atom>, bonds: Bond[]) {
  const neighbors = new Map<number, Set<number>>();
  for (const { i, j } of bonds) {
    if (!neighbors.has(i)) neighbors.set(i, new Set());
    if (!neighbors.has(j)) neighbors.set(j, new Set());
    neighbors.get(i)!.add(j);
    neighbors.get(j)!.add(i);
  }
  const angles: ImportedModel["angles"] = [];
  for (const [j, endpoints] of neighbors) {
    const ids = [...endpoints].sort((a, b) => a - b);
    for (let a = 0; a < ids.length; a++) {
      for (const k of ids.slice(a + 1)) {
        const i = ids[a];
        const degrees = angleTheta(atoms.get(i)!, atoms.get(j)!, atoms.get(k)!) * 180 / Math.PI;
        angles.push({ id: angles.length + 1, i, j, k, ktheta: 0.01, degrees });
      }
    }
  }
  return angles;
}

function drawingBox(atoms: Atom[]) {
  const bounds = (axis: "x" | "y") => {
    const coords = atoms.map(atom => atom[axis]);
    return `${Math.min(...coords) - 0.1} ${Math.max(...coords) + 0.1} ${axis}lo ${axis}hi`;
  };
  return [bounds("x"), bounds("y"), "-0.1 0.1 zlo zhi", "0 0 0 xy xz yz"];
}

// Keep imported type IDs stable. An edited type gets a new entry if other
// interactions still need its original parameters.
function coefficientTable(original: [number, number][] = []) {
  const rows = [...original];
  const byPair = new Map(rows.map(([k, r], i) => [`${k} ${r}`, i + 1]));
  function typeFor(k: number, r: number, preferred?: number) {
    if (preferred && rows[preferred - 1]?.[0] === k && rows[preferred - 1][1] === r) return preferred;
    const key = `${k} ${r}`;
    const existing = byPair.get(key);
    if (existing !== undefined) return existing;
    const id = rows.push([k, r]);
    byPair.set(key, id);
    return id;
  }
  return { rows, typeFor };
}

export function generateLmp(atoms: Atom[], bonds: Bond[], model?: ImportedModel): string {
  if (!atoms.length || !bonds.length) return "";
  const byId = new Map(atoms.map(a => [a.id, a]));
  const springs = coefficientTable(model?.bondCoefficients);
  const bondRows: string[] = [];
  for (const bond of bonds) {
    const a = byId.get(bond.i), b = byId.get(bond.j);
    if (!a || !b || a.id === b.id) return "";
    const length = bond.restLength ?? Math.hypot(a.x - b.x, a.y - b.y);
    const type = springs.typeFor(bond.k, length, bond.type);
    bondRows.push(`${bond.id} ${type} ${a.id} ${b.id}`);
  }
  const angles = model?.angles ?? anglesFromDrawing(byId, bonds);
  const bends = coefficientTable(model?.angleCoefficients);
  const angleRows = angles.map(a => {
    const type = bends.typeFor(a.ktheta, a.degrees, a.type);
    return `${a.id} ${type} ${a.i} ${a.j} ${a.k}`;
  });
  const masses = model?.masses ?? [1];
  const hasImages = atoms.some(a => a.image?.length);
  const lines = [
    "LAMMPS data file.", "",
    `${atoms.length} atoms`, `${bonds.length} bonds`, `${angles.length} angles`,
    `${masses.length} atom types`, `${springs.rows.length} bond types`, `${bends.rows.length} angle types`,
    ...(model?.box ?? drawingBox(atoms)), "",
    "Masses", "", ...masses.map((m, i) => `${i + 1} ${m}`), "",
    "Atoms # full", "", ...atoms.map(a =>
      [a.id, a.molecule ?? 1, a.type ?? 1, a.charge ?? 0, a.x, a.y, 0, ...(a.image ?? (hasImages ? [0, 0, 0] : []))].join(" ")),
    "", "Bonds", "", ...bondRows, "",
    "Bond Coeffs # harmonic", "", ...springs.rows.map(([k, r], i) => `${i + 1} ${k} ${r}`),
  ];
  if (angles.length) lines.push("", "Angles", "", ...angleRows);
  if (bends.rows.length) {
    lines.push("", "Angle Coeffs # harmonic", "", ...bends.rows.map(([k, theta], i) => `${i + 1} ${k} ${theta}`));
  }
  if (atoms.some(a => a.velocity)) {
    lines.push("", "Velocities", "", ...atoms.map(a => [a.id, ...(a.velocity ?? [0, 0, 0])].join(" ")));
  }
  return lines.join("\n") + "\n";
}

// Both bundled scenarios use two-dimensional, full-style harmonic networks.
export function parseLmp(text: string): Graph {
  const sections = new Map<string, number[][]>();
  const counts = new Map<string, number>();
  const box: string[] = [];
  let current = "";
  const unsupported = (reason: string): never => { throw new Error(`Cannot import network: ${reason}`); };
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
    const [body, comment = ""] = raw.split("#");
    const line = body.trim().replace(/\s+/g, " ");
    if (!line) continue;
    if (/^[A-Za-z]/.test(line)) {
      if (!["Atoms", "Bonds", "Angles", "Masses", "Bond Coeffs", "Angle Coeffs", "Velocities"].includes(line)) {
        unsupported(`unsupported data section "${line}".`);
      }
      if (sections.has(line)) unsupported(`duplicate ${line} section.`);
      const style = comment.trim().split(/\s+/)[0];
      if (/^[a-z][\w/]*$/.test(style) && ((line === "Atoms" && style !== "full") ||
          (line.endsWith("Coeffs") && style !== "harmonic"))) unsupported(`unsupported ${line} style ${style}.`);
      current = line;
      sections.set(line, []);
    } else if (!current) {
      const bound = line.match(/^(.*?)\s+(xlo xhi|ylo yhi|zlo zhi|xy xz yz)$/);
      if (bound) {
        const values = bound[1].split(/\s+/).map(Number);
        const tilt = bound[2] === "xy xz yz";
        if (values.length !== (tilt ? 3 : 2) || !values.every(Number.isFinite) ||
            (tilt ? values[1] !== 0 || values[2] !== 0 : values[0] >= values[1]) ||
            box.some(b => b.endsWith(bound[2]))) unsupported("invalid 2D simulation box.");
        box.push(line);
      } else {
        const count = line.match(/^(\d+)\s+(.+)$/);
        if (!count || (!["atoms", "bonds", "angles", "atom types", "bond types", "angle types"].includes(count[2]) &&
            !(Number(count[1]) === 0 && /^(dihedrals|impropers|dihedral types|improper types)$/.test(count[2])))) {
          throw new Error(`Unsupported LAMMPS header: ${line}`);
        }
        counts.set(count[2], Number(count[1]));
      }
    } else {
      const row = line.split(/\s+/).map(Number);
      if (!row.every(Number.isFinite)) unsupported(`invalid number in ${current}.`);
      sections.get(current)!.push(row);
    }
  }
  const rows = (name: string, widths: number[], countName?: string) => {
    const data = sections.get(name) ?? [];
    if (countName && data.length !== (counts.get(countName) ?? 0)) unsupported(`incorrect ${name} count.`);
    const ids = new Set<number>();
    for (const row of data) {
      if (!widths.includes(row.length) || !Number.isInteger(row[0]) || row[0] <= 0 || ids.has(row[0])) {
        unsupported(`invalid or duplicate ${name} record.`);
      }
      ids.add(row[0]);
    }
    return data;
  };
  if (!["xlo xhi", "ylo yhi", "zlo zhi"].every(axis => box.some(line => line.endsWith(axis)))) {
    unsupported("missing simulation box bounds.");
  }
  const masses: number[] = [];
  for (const [id, mass] of rows("Masses", [2], "atom types")) {
    if (id > counts.get("atom types")! || mass <= 0) unsupported("invalid mass or atom type.");
    masses[id - 1] = mass;
  }
  const atoms = rows("Atoms", [7, 10], "atoms").map(([id, molecule, type, charge, x, y, z, ...image]): Atom => {
    if (!masses[type - 1] || z !== 0 || !Number.isInteger(molecule) || !image.every(Number.isInteger)) {
      unsupported("expected full-style atoms in the xy plane with defined masses.");
    }
    return { id, molecule, type, charge, x, y, ...(image.length ? { image } : {}) };
  });
  const byId = new Map(atoms.map(a => [a.id, a]));
  for (const [id, ...velocity] of rows("Velocities", [4])) {
    const atom = byId.get(id);
    if (!atom) throw new Error("Unknown velocity atom.");
    atom.velocity = velocity;
  }
  const coeffs = (name: string, count: string) => {
    const table: [number, number][] = [];
    for (const [id, k, rest] of rows(name, [3], count)) {
      if (id > counts.get(count)!) unsupported(`invalid type ID in ${name}.`);
      table[id - 1] = [k, rest];
    }
    return table;
  };
  const spring = coeffs("Bond Coeffs", "bond types");
  const bend = coeffs("Angle Coeffs", "angle types");
  const bonds = rows("Bonds", [4], "bonds").map(([id, type, i, j]) => {
    const coeff = spring[type - 1];
    if (!coeff || !byId.has(i) || !byId.has(j) || i === j) throw new Error("Invalid bond endpoints or missing harmonic coefficients.");
    return { id, type, i, j, k: coeff[0], restLength: coeff[1] };
  });
  const angles = rows("Angles", [5], "angles").map(([id, type, i, j, k]) => {
    const coeff = bend[type - 1];
    if (!coeff || ![i,j,k].every(a => byId.has(a))) throw new Error("Invalid angle atoms or missing harmonic coefficients.");
    return { id, type, i, j, k, ktheta: coeff[0], degrees: coeff[1] };
  });
  return { atoms, bonds, model: { box, masses, angles, bondCoefficients: spring, angleCoefficients: bend } };
}
