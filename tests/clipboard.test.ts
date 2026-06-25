import assert from "node:assert/strict";
import test from "node:test";
import { copyText } from "../src/clipboard.ts";

test("copies the complete LAMMPS text", async () => {
  const writes: string[] = [];
  const text = "LAMMPS network\nAtoms\n1 1 0 0 0\n";

  await copyText(text, {
    async writeText(value) {
      writes.push(value);
    },
  });

  assert.deepEqual(writes, [text]);
});
