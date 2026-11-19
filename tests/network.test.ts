import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateLmp, parseLmp } from "../src/parse.ts";

const atoms = [{ id: 5, x: 0, y: 0 }, { id: 9, x: 1, y: 0 }, { id: 3, x: 1, y: 2 }];
const bonds = [{ id: 4, i: 5, j: 9, k: 3 }, { id: 2, i: 9, j: 3, k: 3 }];

test("drawn springs retain their individual equilibrium lengths in either bond order", () => {
  for (const order of [bonds, [...bonds].reverse()]) {
    const network = parseLmp(generateLmp(atoms, order));
    assert.deepEqual(Object.fromEntries(network.bonds.map(b => [b.id, b.restLength])), { 4: 1, 2: 2 });
  }
});

test("a partial drawing remains editable until it has a valid spring", () => {
  assert.equal(generateLmp([], []), "");
  assert.equal(generateLmp(atoms, []), "");
  assert.equal(generateLmp(atoms, [{ ...bonds[0], j: 999 }]), "");
  assert.ok(generateLmp(atoms, [bonds[0]]));
});

test("import, edit and export retain the periodic cell and explicit harmonic model", async () => {
  const input = await readFile(new URL("../public/minimal_network.lmp", import.meta.url), "utf8");
  const network = parseLmp(input.replace("-2.100000 2.100000 xlo xhi", "-4.7 6.8 xlo xhi")
    .replace("0.0 0.0 0.0 xy xz yz", "0.25 0 0 xy xz yz")
    .replace("1 0.01 90.000000", "1 0.72 73.5"));
  const { atoms, bonds, model } = network;
  assert.ok(model);
  atoms[0].x += 0.25;
  bonds[0].k = 2.75;
  const result = parseLmp(generateLmp(atoms, bonds, model));
  assert.deepEqual(result.atoms, atoms);
  assert.deepEqual(result.model!.box, model.box);
  assert.deepEqual(result.model!.angles, model.angles);
  assert.deepEqual(result.model!.masses, model.masses);
  assert.equal(result.bonds[0].restLength, 1.414214);
  assert.equal(result.bonds[0].k, 2.75);
  assert.deepEqual(result.bonds.slice(1), bonds.slice(1));
  assert.deepEqual(result.model!.angles[0], { id: 1, type: 1, i: 2, j: 1, k: 4, ktheta: 0.72, degrees: 73.5 });
});

test("a freely hinged network retains zero explicit angles", () => {
  const initial = parseLmp(generateLmp(atoms, bonds));
  const model = { ...initial.model!, angles: [], angleCoefficients: [] };
  const file = generateLmp(initial.atoms, initial.bonds, model);
  assert.deepEqual(parseLmp(file).model!.angles, []);
  assert.throws(() => parseLmp(file + "\nPair Coeffs\n\n1 1 1"), /unsupported data section/);
});
