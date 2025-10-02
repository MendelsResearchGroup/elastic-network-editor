import type { Atom } from "./model";

export const angleTheta = (i: Atom, j: Atom, k: Atom) => {
  const v1x = i.x - j.x, v1y = i.y - j.y;
  const v2x = k.x - j.x, v2y = k.y - j.y;
  const dot = v1x * v2x + v1y * v2y;
  const n1 = Math.hypot(v1x, v1y), n2 = Math.hypot(v2x, v2y);
  const c = Math.min(1, Math.max(-1, dot / ((n1 || 1) * (n2 || 1))));
  return Math.acos(c);
}