import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { LammpsClient } from "lammps.js/client";
import { parseLmp, generateLmp } from "../../src/parse.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const { atoms, bonds, model } = parseLmp(await read("lattice.lmp"));
const script = await read("../../public/nte.deformation");
for (const seed of [1001, 2003, 3001]) {
  const means = [];
  const print = line => {
    if (line.startsWith("NTE_MEAN ")) means.push(line.split(" ").slice(1).map(Number));
    if (line.includes("ERROR:")) console.error(line);
  };
  const client = await LammpsClient.create({ print, printErr: print });
  try {
    client.start();
    client.writeFile("network.lmp", generateLmp(atoms, bonds, model));
    await client.runScriptAsync(script.replace("seed index 1001", "seed index " + seed), () => {}, { every: 500 });
    assert.equal(means.length, 2);
    const [cold, hot] = means;
    console.log({ seed, cold, hot, areaChangePercent: 100 * (hot[2] / cold[2] - 1) });
    assert.ok(hot[1] > cold[1] && hot[2] < cold[2]);
  } finally {
    client.dispose();
  }
}
