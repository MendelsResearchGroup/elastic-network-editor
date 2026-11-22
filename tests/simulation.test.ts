import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { LammpsClient } from "lammps.js/client";
import { calculateBoxMeasurement } from "../src/poisson.ts";
import { generateLmp, parseLmp } from "../src/parse.ts";

const asset = (path: string) => readFile(new URL("../public/" + path, import.meta.url), "utf8");

for (const scenario of ["compression", "heating", "homepage starter"]) {
  test(`${scenario} delivers measured frames with the real serial LAMMPS build`, async () => {
    let reference: number[] = [];
    let frames = 0, temperature: number | null = null;
    const errors: string[] = [];
    const print = (message: unknown) => {
      const line = String(message);
      if (line.startsWith("EDITOR_REFERENCE ")) reference = line.split(/\s+/).slice(1).map(Number);
      if (line.includes("ERROR:")) errors.push(line);
    };
    const client = await LammpsClient.create({ print, printErr: print });
    try {
      client.start();
      const homepage = scenario === "homepage starter";
      const input = homepage
        ? await readFile(new URL("../examples/rotating-squares/rotating-squares.lmp", import.meta.url), "utf8")
        : await asset("minimal_network.lmp");
      const { atoms, bonds, model } = parseLmp(input);
      client.writeFile("network.lmp", generateLmp(atoms, bonds, model));
      for (const name of ["init.mod", "potential.mod"]) client.writeFile(name, await asset("auxetic/" + name));
      const heating = scenario === "heating";
      const script = await asset(heating ? "thermal-expand.deformation" : "auxetic/compress.deformation");
      await client.runScriptAsync(script, data => {
        if (!reference.length) return;
        frames++;
        assert.equal(data.particles?.count, homepage ? 32 : 16);
        temperature = data.computeScalars?.thermo_temp ?? null;
      }, { every: homepage ? 1500 : 5000, computeScalars: heating ? ["thermo_temp"] : [] });
      assert.deepEqual(errors, []);
      assert.ok(frames >= 20);
      const [width, height] = client.syncBox({ copy: true }).lengths;
      assert.ok(width > 0 && height > 0);
      if (heating) {
        assert.ok(temperature !== null && Number.isFinite(temperature));
      } else {
        const result = calculateBoxMeasurement({ width: reference[0], height: reference[1] }, { width, height });
        assert.ok(result && Math.abs(result.axialStrain + 0.03) < 1e-6);
        if (homepage) {
          assert.ok(result.poissonRatio !== null && Math.abs(result.poissonRatio + 1) < 0.01);
          return;
        }
        // Native Windows stable_30Sep2026_update1, same network, seed and input.
        // Compare engineering strains since the relaxed dimensions vary slightly.
        const nativeTransverseStrain = 4.402278612474305 / 4.398442589694316 - 1;
        assert.ok(Math.abs(result.transverseStrain - nativeTransverseStrain) < 0.00005);
      }
    } finally {
      client.dispose();
    }
  });
}
