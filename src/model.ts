export type Atom = { id: number; x: number; y: number };
export type Bond = { id: number; i: number; j: number; k: number };
export type Angle = { id: number; i: number; j: number; k: number; ktheta: number };

export type AngleTypes = { uniq: number[]; map: Map<number, number> };
