import { useCallback, useRef, useState } from "react";
import type { LammpsWeb } from "./types/lammps-web";
import createModule from "./wasm/lammps.js";

type LammpsModule = {
  HEAPF32: Float32Array;
  FS: any;
  LAMMPSWeb: new () => LammpsWeb;
};
const base = "/work";

export function useLammps(onPrint: (s: string) => void, network: string) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const modRef = useRef<LammpsModule | null>(null);
  const lmpRef = useRef<LammpsWeb | null>(null);

  const initLammps = useCallback(async () => {
    if (modRef.current && lmpRef.current) { return { M: modRef.current, lmp: lmpRef.current }; }

    const Module = (await createModule({
      print: onPrint,
      printErr: onPrint,
    })) as unknown as LammpsModule;

    const lmp = new Module.LAMMPSWeb();
    modRef.current = Module;
    lmpRef.current = lmp;
    setReady(true);

    return { M: Module, lmp };
  }, [onPrint]);

  const readPositions = useCallback(() => {
    const M = modRef.current, lmp = lmpRef.current;
    if (!M || !lmp) return new Float32Array(0);
    const n = lmp.getNumAtoms();
    if (!n) return new Float32Array(0);
    lmp.computeParticles();
    const ptr = lmp.getPositionsPointer();
    const heap = M.HEAPF32;
    return heap.subarray(ptr >> 2, (ptr >> 2) + 3 * n);
  }, []);

  const readBonds = useCallback(() => {
    const M = modRef.current, lmp = lmpRef.current;
    if (!M || !lmp) return { p1: new Float32Array(0), p2: new Float32Array(0), count: 0 };
    const nb = lmp.computeBonds();
    if (!nb) return { p1: new Float32Array(0), p2: new Float32Array(0), count: 0 };
    const heap = M.HEAPF32;
    const p1 = lmp.getBondsPosition1Pointer();
    const p2 = lmp.getBondsPosition2Pointer();
    return {
      p1: heap.subarray(p1 >> 2, (p1 >> 2) + 3 * nb),
      p2: heap.subarray(p2 >> 2, (p2 >> 2) + 3 * nb),
      count: nb,
    };
  }, []);
  const readBox = useCallback(() => {
    const M = modRef.current, lmp = lmpRef.current;
    if (!M || !lmp)
      return { lx: 0, ly: 0, lz: 0 };

    const ptr = lmp.getBoxSizePointer(); // C++ method returning double[3]
    const heap = M.HEAPF32;              // use F64 because it's double[]
    const vals = heap.subarray(ptr >> 3, (ptr >> 3) + 3);

    return { lx: vals[0], ly: vals[1], lz: vals[2] };
  }, []);

  const start = useCallback(async () => {
    console.log('start')
    const { M, lmp } = await initLammps();

    const inTxt = await
      fetch(`${import.meta.env.BASE_URL}/thermal-expand.deformation`).then(r => r.text())

    M.FS.writeFile(`in.lmp`, "echo none\nlog none\nclear\n" + inTxt);
    setNetwork();

    setRunning(true);
    lmp.setSyncFrequency(1);
    lmp.start();

    lmp.runFile(`in.lmp`);
  }, []);

  const setNetwork = async () => {
    const { M } = await initLammps();

    M.FS.writeFile(`network.lmp`, network);
  }

  const runFrames = useCallback(async (n: number) => { lmpRef.current?.runCommand(`run ${n}`); }, [])
  const stop = useCallback(() => {
    lmpRef.current?.stop();
    setRunning(false);
  }, []);

  return { ready, running, start, stop, readPositions, readBonds, runFrames, readBox, setNetwork };
}
