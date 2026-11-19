// lammps.js keeps the worker at a step boundary until its frame callback resolves.
export class FrameGate {
  private pending: Promise<void> | undefined;
  private release: (() => void) | undefined;

  pause() {
    this.pending ??= new Promise<void>(resolve => { this.release = resolve; });
  }

  resume() {
    this.pending = undefined;
    this.release?.();
    this.release = undefined;
  }

  async wait() {
    while (this.pending) await this.pending;
  }
}
