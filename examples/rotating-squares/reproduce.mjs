import { readFile } from "node:fs/promises";
import { LammpsClient } from "lammps.js/client";
import { generateLmp, parseLmp } from "../../src/parse.ts";
import { calculateBoxMeasurement } from "../../src/poisson.ts";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
let reference;
const print = line => {
  if (String(line).startsWith("EDITOR_REFERENCE ")) {
    const [, width, height] = line.split(/\s+/).map(Number);
    reference = { width, height };
  }
  if (String(line).includes("ERROR:")) console.error(line);
};
const client = await LammpsClient.create({ print, printErr: print });
try {
  client.start();
  const { atoms, bonds, model } = parseLmp(await read("rotating-squares.lmp"));
  client.writeFile("network.lmp", generateLmp(atoms, bonds, model));
  for (const name of ["init.mod", "potential.mod"]) {
    client.writeFile(name, await read("../../public/auxetic/" + name));
  }
  await client.runScriptAsync(await read("../../public/auxetic/compress.deformation"), () => {}, { every: 10000 });
  const [width, height] = client.syncBox({ copy: true }).lengths;
  const result = calculateBoxMeasurement(reference, { width, height });
  if (!result || Math.abs(result.axialStrain + 0.03) > 1e-6) throw Error("Incomplete compression");
  console.log(JSON.stringify({ reference, result }, null, 2));
} finally {
  client.dispose();
}
