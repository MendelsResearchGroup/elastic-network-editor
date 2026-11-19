export type Atom = {
  id: number;
  x: number;
  y: number;
  molecule?: number;
  type?: number;
  charge?: number;
  image?: number[];
  velocity?: number[];
};

export type Bond = { id: number; i: number; j: number; k: number; type?: number; restLength?: number };
export type Angle = { id: number; i: number; j: number; k: number; ktheta: number };
export type AngleTypes = { uniq: number[]; map: Map<number, number> };

export type ImportedModel = {
  box: string[];
  masses: number[];
  bondCoefficients: [number, number][];
  angleCoefficients: [number, number][];
  angles: (Angle & { type?: number; degrees: number })[];
};
export type Graph = { atoms: Atom[]; bonds: Bond[]; model?: ImportedModel };
