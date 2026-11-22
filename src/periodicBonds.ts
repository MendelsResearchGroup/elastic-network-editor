import type { ImportedModel } from "./model";

type Point = { x: number; y: number };
type Segment = [Point, Point];

export function orthogonalCell(model?: ImportedModel) {
  if (!model || model.box.some(line => line.endsWith("xy xz yz") && Number(line.split(/\s+/)[0]) !== 0)) return;
  const [left, right] = model.box.find(line => line.endsWith("xlo xhi"))!.split(/\s+/).map(Number);
  const [top, bottom] = model.box.find(line => line.endsWith("ylo yhi"))!.split(/\s+/).map(Number);
  return { left, right, top, bottom };
}

export function periodicBondSegments(a: Point, b: Point, cell: ReturnType<typeof orthogonalCell>): Segment[] {
  if (!cell) return [[a, b]];
  const { left, right, top, bottom } = cell;
  // Atoms dragged outside the displayed cell remain editable where they were placed.
  if ([a, b].some(({ x, y }) => x < left || x > right || y < top || y > bottom)) return [[a, b]];

  const width = right - left;
  const height = bottom - top;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const shiftX = Math.abs(dx) > width / 2 ? Math.sign(dx) * width : 0;
  const shiftY = Math.abs(dy) > height / 2 ? Math.sign(dy) * height : 0;
  if (!shiftX && !shiftY) return [[a, b]];

  // Split the minimum-image spring wherever it crosses a face. A diagonal
  // spring can cross two faces at different points before reaching its partner.
  const vx = dx - shiftX;
  const vy = dy - shiftY;
  const cuts = [0, 1];
  if (shiftX && vx) cuts.push(((shiftX > 0 ? left : right) - a.x) / vx);
  if (shiftY && vy) cuts.push(((shiftY > 0 ? top : bottom) - a.y) / vy);
  cuts.sort((first, second) => first - second);
  const segments: Segment[] = [];
  for (let index = 1; index < cuts.length; index++) {
    const start = cuts[index - 1], end = cuts[index];
    if (end - start < 1e-12) continue;
    const middle = (start + end) / 2;
    const offsetX = shiftX ? Math.floor((a.x + middle * vx - left) / width) * width : 0;
    const offsetY = shiftY ? Math.floor((a.y + middle * vy - top) / height) * height : 0;
    segments.push([
      { x: a.x + start * vx - offsetX, y: a.y + start * vy - offsetY },
      { x: a.x + end * vx - offsetX, y: a.y + end * vy - offsetY },
    ]);
  }
  return segments;
}
