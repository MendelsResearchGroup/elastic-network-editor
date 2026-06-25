import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("runs auxetic compression at near-zero temperature", async () => {
  const script = await readFile(
    new URL("../public/auxetic/compress.deformation", import.meta.url),
    "utf8"
  );

  assert.match(script, /variable targetTemp equal 1e-7/);
  assert.match(
    script,
    /fix\s+5 all langevin \$\{targetTemp\} \$\{targetTemp\} 5\.0 904297/
  );
  assert.match(
    script,
    /fix\s+6 all nph y 0\.0 0\.0 200\.0 ptemp \$\{targetTemp\}/
  );
});
