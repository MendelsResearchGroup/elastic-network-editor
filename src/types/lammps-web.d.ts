export enum ScalarType { Float32, Float64, Int32, Int64 }

export interface BufferView {
  ptr: number;
  length: number;
  components: number;
  type: ScalarType;
}

export interface ParticleSnapshot {
  positions: BufferView;
  ids: BufferView;
  types: BufferView;
  count: number;
}

export interface BondSnapshot {
  first: BufferView;
  second: BufferView;
  count: number;
}

export interface BoxSnapshot {
  matrix: BufferView;
  origin: BufferView;
  lengths: BufferView;
}

export interface LammpsWeb {
  start(): void;
  stop(): void;
  advance(steps: number, applyPre?: boolean, applyPost?: boolean): void;
  runCommand(command: string): void;
  runScript(script: string): void;
  runFile(path: string): void;
  isReady(): boolean;
  getIsRunning(): boolean;
  getCurrentStep(): number;
  getTimestepSize(): number;
  syncParticles(): ParticleSnapshot;
  syncBonds(): BondSnapshot;
  syncSimulationBox(): BoxSnapshot;
}
