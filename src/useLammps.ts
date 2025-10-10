import { useCallback, useEffect, useRef, useState } from "react";
import type { LammpsWeb } from "./types/lammps-web";
import createModule from "./wasm/lammps.js";

type LammpsModule = {
  HEAPF32: Float32Array;
  FS: any;
  LAMMPSWeb: new () => LammpsWeb;
};

export function useLammps(onPrint: (s: string) => void) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const modRef = useRef<LammpsModule | null>(null);
  const lmpRef = useRef<LammpsWeb | null>(null);

  useEffect(() => {
    (async () => {
      const Module = (await createModule({
        print: onPrint,
        printErr: onPrint,
      })) as unknown as LammpsModule;

      const lmp = new Module.LAMMPSWeb();
      modRef.current = Module;
      lmpRef.current = lmp;
      setReady(true);
    })();
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

  const startMinimal = useCallback(async () => {
    const M = modRef.current, lmp = lmpRef.current;
    if (!M || !lmp) throw new Error("LAMMPS not ready");

    const [inTxt, dataTxt] = await Promise.all([
      fetch("/thermal-expand.deformation").then(r => r.text()),
      fetch("/minimal_network.lmp").then(r => r.text()),
    ]);

    const base = "/work";
    try { M.FS.mkdir(base); } catch {}
    M.FS.writeFile(`${base}/in.lmp`, inTxt);
    M.FS.writeFile(`${base}/minimal_network.lmp`, dataTxt);

    setRunning(true);
    
    lmp.start();

    //@ts-ignore
    window.postStepCallback = () => console.log("asd")
    
    await lmp.runFile(`${base}/in.lmp`);
    lmp.setSyncFrequency(1);


  }, []);

  const stop = useCallback(() => {
    lmpRef.current?.stop();
    setRunning(false);
  }, []);

  return { ready, running, startMinimal, stop, readPositions, readBonds };
}
