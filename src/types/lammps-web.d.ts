export type LammpsWeb = {
  getNumAtoms: () => number;
  setSyncFrequency: (every: number) => void;
  setBuildNeighborlist: (buildNeighborlist: boolean) => void;
  getIsRunning: () => boolean;
  getErrorMessage: () => string;
  getLastCommand: () => string;
  getTimesteps: () => number;
  getRunTimesteps: () => number;
  getRunTotalTimesteps: () => number;
  getTimestepsPerSecond: () => number;
  getCPURemain: () => number;
  getWhichFlag: () => number;
  getCompute: (name: string) => LMPModifier;
  getComputeNames: () => CPPArray<string>;
  getFix: (name: string) => LMPModifier;
  getFixNames: () => CPPArray<string>;
  getVariable: (name: string) => LMPModifier;
  getVariableNames: () => CPPArray<string>;
  syncComputes: () => void;
  syncFixes: () => void;
  syncVariables: () => void;
  getMemoryUsage: () => number;

  getPositionsPointer: () => number;
  getIdPointer: () => number;
  getTypePointer: () => number;
  getCellMatrixPointer: () => number;
  getOrigoPointer: () => number;
  getBondsPosition1Pointer: () => number;
  getBondsPosition2Pointer: () => number;
  getBondsDistanceMapPointer: () => number;
  getExceptionMessage: (address: number) => string;

  step: () => void;
  stop: () => boolean;
  start: () => boolean;
  cancel: () => void;
  setPaused: (paused: boolean) => void;
  runCommand: (command: string) => void;
  runFile: (path: string) => void;

  computeBonds: () => number;
  computeParticles: () => number;
};

enum ModifierType {
  ComputePressure,
  ComputeTemp,
  ComputePE,
  ComputeKE,
  ComputeRDF,
  ComputeMSD,
  ComputeVACF,
  ComputeCOM,
  ComputeGyration,
  ComputeKEAtom,
  ComputePropertyAtom,
  ComputeClusterAtom,
  ComputeCNAAtom,
  ComputeOther,
  FixAveChunk,
  FixAveHisto,
  FixAveTime,
  FixOther,
  VariableOther,
}

type CPPArray<T> = {
  get: (index: number) => T;
  size: () => number;
};

export type LMPModifier = {
  getName: () => string;
  getType: () => ModifierType;
  getPerAtomData: () => number;
  getIsPerAtom: () => boolean;
  hasScalarData: () => boolean;
  getClearPerSync: () => boolean;
  getScalarValue: () => number;
  sync: () => void;
  getXLabel: () => string;
  getYLabel: () => string;
  getData1DNames: () => CPPArray<string>;
  getData1D: () => CPPArray<LMPData1D>;
  execute: () => boolean;
  delete: () => void;
};

declare global {
  interface Window {
    lammpsCreateModule?: (opts?: any) => Promise<any> | any;
    wasm?: any;
    lammps?: LammpsWeb;
    syncFrequency?: number;
    postStepCallback?: () => boolean;
    cancel?: boolean;
  }
}
