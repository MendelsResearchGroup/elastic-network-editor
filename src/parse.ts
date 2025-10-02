import type { Angle, AngleTypes, Atom, Bond, BondTypes } from "./model";
import { angleTheta } from "./utils";
function distance(a: Atom, b: Atom) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export const generateLmp = (atoms: Atom[], bonds: Bond[], angles: Angle[], bondTypes: BondTypes, angleTypes: AngleTypes) => {
    const nat = atoms.length;
    const nb = bonds.length;
    const na = angles.length;
    const nbt = bondTypes.uniq.length || 1;
    const naty = 1;
    const natet = angleTypes.uniq.length || 1;
    const atomIndexMap = new Map(atoms.map((a, idx) => [a.id, idx + 1] as const));

    const lines: string[] = [];
    lines.push(`${nat} atoms`);
    lines.push(`${nb} bonds`);
    lines.push(`${na} angles`);
    lines.push(`${naty} atom types`);
    lines.push(`${nbt} bond types`);
    lines.push(`${natet} angle types`);
    lines.push("");
    lines.push("Masses");
    lines.push("");
    lines.push(`1 100000.0`);
    lines.push("");
    lines.push("Atoms");
    lines.push("");
    atoms.forEach((a, idx) => {
      const id = idx + 1;
      const mol = 1;
      const type = 1;
      const q = 0.0;
      lines.push(`${id} ${mol} ${type} ${q.toFixed(1)} ${a.x.toFixed(6)} ${a.y.toFixed(6)} 0.000000`);
    });
    lines.push("");
    lines.push("Bonds");
    lines.push("");
    bonds.forEach((b, bi) => {
      const t = bondTypes.map.get(b.k) || 1;
      const i = atomIndexMap.get(b.i)!;
      const j = atomIndexMap.get(b.j)!;
      lines.push(`${bi + 1} ${t} ${i} ${j}`);
    });
    lines.push("");
    lines.push("Angles");
    lines.push("");
    angles.forEach((a, ai) => {
      const t = angleTypes.map.get(a.ktheta) || 1;
      const i = atomIndexMap.get(a.i)!;
      const j = atomIndexMap.get(a.j)!;
      const k = atomIndexMap.get(a.k)!;
      lines.push(`${ai + 1} ${t} ${i} ${j} ${k}`);
    });
    lines.push("");
    lines.push("Bond Coeffs");
    lines.push("");
    if (bonds.length) {
      bondTypes.uniq.forEach((kVal, idx) => {
        const sample = bonds.find(b => b.k === kVal)!;
        const ai = atoms.find(a => a.id === sample.i)!;
        const aj = atoms.find(a => a.id === sample.j)!;
        const r0 = distance(ai, aj);
        lines.push(`${idx + 1} ${kVal} ${r0.toFixed(6)}`);
      });
    } else {
      lines.push(`1 100.0 1.000000`);
    }
    lines.push("");
    lines.push("Angle Coeffs");
    lines.push("");
    if (angles.length) {
      angleTypes.uniq.forEach((kVal, idx) => {
        const sample = angles.find(a => a.ktheta === kVal)!;
        const ai = atoms.find(a => a.id === sample.i)!;
        const aj = atoms.find(a => a.id === sample.j)!;
        const ak = atoms.find(a => a.id === sample.k)!;
        const th0 = angleTheta(ai, aj, ak) * 180 / Math.PI;
        lines.push(`${idx + 1} ${kVal} ${th0.toFixed(6)}`);
      });
    } else {
      lines.push(`1 10.0 120.000000`);
    }
    lines.push("");
    return lines.join("\n");
  }