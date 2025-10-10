export type ParticlesBuf = {
  positions: Float32Array;
  count: number;
  capacity: number;
};

export function makeParticlesBuf(initialCap = 0): ParticlesBuf {
  return { positions: new Float32Array(3 * initialCap), count: 0, capacity: initialCap };
}

function ensureCapacity(buf: ParticlesBuf, need: number) {
  if (need <= buf.capacity) return;
  const cap = Math.max(need, buf.capacity ? buf.capacity * 2 : 1024);
  buf.positions = new Float32Array(3 * cap);
  buf.capacity = cap;
}

export function packBonds(p1: Float32Array, p2: Float32Array, n: number) {
  const arr = new Float32Array(6 * n);
  for (let i = 0; i < n; i++) {
    const i3 = 3 * i, i6 = 6 * i;
    arr[i6 + 0] = p1[i3 + 0]; arr[i6 + 1] = p1[i3 + 1]; arr[i6 + 2] = p1[i3 + 2];
    arr[i6 + 3] = p2[i3 + 0]; arr[i6 + 4] = p2[i3 + 1]; arr[i6 + 5] = p2[i3 + 2];
  }
  return arr;
}

export function syncPositionsInto(buf: ParticlesBuf, src: Float32Array) {
  const n = (src.length / 3) | 0;
  if (!n) { buf.count = 0; return buf; }
  ensureCapacity(buf, n);
  buf.positions.set(src.subarray(0, 3 * n));
  buf.count = n;
  return buf;
}
