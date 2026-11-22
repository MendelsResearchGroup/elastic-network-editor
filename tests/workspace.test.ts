import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseLmp } from "../src/parse.ts";
import { periodicBondSegments } from "../src/periodicBonds.ts";
import { workspaceGraph } from "../src/workspaceGraph.ts";

test("the homepage upgrades the untouched old starter and keeps edited networks", async () => {
  const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
  const starter = parseLmp(await read("../examples/rotating-squares/rotating-squares.lmp"));
  const fixture = parseLmp(await read("../public/minimal_network.lmp"));
  // The old homepage saved the drawing without imported metadata.
  const saved = {
    atoms: fixture.atoms.map(({ id, x, y }) => ({ id, x, y })),
    bonds: fixture.bonds.map(({ id, i, j }) => ({
      id, i, j, k: [5, 16].includes(id) ? 0.5 : [19, 26].includes(id) ? 0.3 : 1,
    })),
  };
  assert.equal(workspaceGraph(starter, null), starter);
  assert.equal(workspaceGraph(starter, saved), starter);
  saved.atoms[0].x += 0.5;
  assert.deepEqual(workspaceGraph(starter, saved).atoms, saved.atoms);
  assert.deepEqual(workspaceGraph(starter, { atoms: [], bonds: [] }).atoms, []);
});

const cell = { left: 0, right: 8, top: 0, bottom: 8 };

test("a periodic spring ends and resumes at opposite cell edges", () => {
  assert.deepEqual(periodicBondSegments({ x: 7, y: 3 }, { x: 1, y: 5 }, cell), [
    [{ x: 7, y: 3 }, { x: 8, y: 4 }],
    [{ x: 0, y: 4 }, { x: 1, y: 5 }],
  ]);
});

test("a diagonal periodic spring can cross both edges before reaching its partner", () => {
  assert.deepEqual(periodicBondSegments({ x: 7.5, y: 6.5 }, { x: 1.5, y: 0.5 }, cell), [
    [{ x: 7.5, y: 6.5 }, { x: 8, y: 7 }],
    [{ x: 0, y: 7 }, { x: 1, y: 8 }],
    [{ x: 1, y: 0 }, { x: 1.5, y: 0.5 }],
  ]);
});
