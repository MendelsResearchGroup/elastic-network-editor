import type { Graph } from "./model";

// Recognize the untouched example saved by older versions of the homepage.
const previousStarter: Graph = {
  atoms: [
    { id: 1, x: -1.0, y: 0.0 },
    { id: 2, x: -2.0, y: 1.0 },
    { id: 3, x: -1.0, y: 2.0 },
    { id: 4, x: 0.0, y: 1.0 },
    { id: 5, x: -1.0, y: 1.0 },
    { id: 6, x: -2.0, y: -1.0 },
    { id: 7, x: -1.0, y: -2.0 },
    { id: 8, x: 0.0, y: -1.0 },
    { id: 9, x: -1.0, y: -1.0 },
    { id: 10, x: 1.0, y: 0.0 },
    { id: 11, x: 1.0, y: 2.0 },
    { id: 12, x: 2.0, y: 1.0 },
    { id: 13, x: 1.0, y: 1.0 },
    { id: 14, x: 1.0, y: -2.0 },
    { id: 15, x: 2.0, y: -1.0 },
    { id: 16, x: 1.0, y: -1.0 },
  ],
  bonds: [
    { id: 1, i: 1, j: 2, k: 1.0 },
    { id: 2, i: 2, j: 3, k: 1.0 },
    { id: 3, i: 3, j: 4, k: 1.0 },
    { id: 4, i: 1, j: 4, k: 1.0 },
    { id: 5, i: 1, j: 5, k: 0.5 },
    { id: 6, i: 2, j: 5, k: 1.0 },
    { id: 7, i: 3, j: 5, k: 1.0 },
    { id: 8, i: 4, j: 5, k: 1.0 },
    { id: 9, i: 6, j: 7, k: 1.0 },
    { id: 10, i: 7, j: 8, k: 1.0 },
    { id: 11, i: 6, j: 9, k: 1.0 },
    { id: 12, i: 7, j: 9, k: 1.0 },
    { id: 13, i: 8, j: 9, k: 1.0 },
    { id: 14, i: 6, j: 1, k: 1.0 },
    { id: 15, i: 1, j: 8, k: 1.0 },
    { id: 16, i: 9, j: 1, k: 0.5 },
    { id: 17, i: 11, j: 12, k: 1.0 },
    { id: 18, i: 10, j: 12, k: 1.0 },
    { id: 19, i: 10, j: 13, k: 0.3 },
    { id: 20, i: 11, j: 13, k: 1.0 },
    { id: 21, i: 12, j: 13, k: 1.0 },
    { id: 22, i: 14, j: 15, k: 1.0 },
    { id: 23, i: 14, j: 16, k: 1.0 },
    { id: 24, i: 15, j: 16, k: 1.0 },
    { id: 25, i: 10, j: 15, k: 1.0 },
    { id: 26, i: 16, j: 10, k: 0.3 },
    { id: 27, i: 11, j: 4, k: 1.0 },
    { id: 28, i: 13, j: 4, k: 1.0 },
    { id: 29, i: 4, j: 10, k: 1.0 },
    { id: 30, i: 10, j: 8, k: 1.0 },
    { id: 31, i: 16, j: 8, k: 1.0 },
    { id: 32, i: 8, j: 14, k: 1.0 },
  ],
};

export function workspaceGraph(starter: Graph, saved: Partial<Graph> | null): Graph {
  if (!saved?.atoms || !saved.bonds) return starter;
  const { atoms, bonds, model } = saved;
  if (!model && JSON.stringify(atoms) === JSON.stringify(previousStarter.atoms) &&
      JSON.stringify(bonds) === JSON.stringify(previousStarter.bonds)) return starter;
  return { atoms, bonds, model };
}
