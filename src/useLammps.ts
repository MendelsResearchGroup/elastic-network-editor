import { useCallback, useRef, useState } from "react";
import type { BufferView, LammpsWeb, ScalarType } from "./types/lammps-web";
import createModule from "./wasm/lammps.js";

type LammpsModule = {
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;
  HEAP32: Int32Array;
  HEAP64: BigInt64Array;
  ScalarType: typeof ScalarType;
  FS: any;
  LAMMPSWeb: new () => LammpsWeb;
};
const base = "/work";

export function useLammps(onPrint: (s: string) => void, network: string) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const modRef = useRef<LammpsModule | null>(null);
  const lmpRef = useRef<LammpsWeb | null>(null);

  const resolveView = (M: LammpsModule, view: BufferView) => {
      if (!view.ptr || !view.length) return null;

      switch (view.type) {
        case M.ScalarType.Float32: {
          const start = view.ptr >> 2;
          return M.HEAPF32.subarray(start, start + view.length);
        }
        case M.ScalarType.Float64: {
          const start = view.ptr >> 3;
          return M.HEAPF64.subarray(start, start + view.length);
        }
        case M.ScalarType.Int32: {
          const start = view.ptr >> 2;
          return M.HEAP32.subarray(start, start + view.length);
        }
        case M.ScalarType.Int64: {
          const start = view.ptr >> 3;
          return M.HEAP64.subarray(start, start + view.length);
        }
        default:
          return null;
      }
    };

    
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
    if (!M || !lmp) return { positions: new Float32Array(0), ids: new Int32Array(0), types: new Int32Array(0), count: 0 };

    const snap = lmp.syncParticles();
    if (!snap.count) {
      return { positions: new Float32Array(0), ids: new Int32Array(0), types: new Int32Array(0), count: 0 };
    }

    const positions = resolveView(M, snap.positions) as Float32Array | null;
    const ids = resolveView(M, snap.ids);
    const types = resolveView(M, snap.types);

    return {
      positions: positions ?? new Float32Array(0),
      ids: (ids as Int32Array | BigInt64Array) ?? new Int32Array(0),
      types: (types as Int32Array) ?? new Int32Array(0),
      count: snap.count,
    };
  }, []);


  const readBonds = useCallback(() => {
    const M = modRef.current, lmp = lmpRef.current;
    if (!M || !lmp) return { p1: new Float32Array(0), p2: new Float32Array(0), count: 0 };

    const snap = lmp.syncBonds();
    if (!snap.count) {
      return { p1: new Float32Array(0), p2: new Float32Array(0), count: 0 };
    }

    const p1 = resolveView(M, snap.first) as Float32Array | null;
    const p2 = resolveView(M, snap.second) as Float32Array | null;

    return {
      p1: p1 ?? new Float32Array(0),
      p2: p2 ?? new Float32Array(0),
      count: snap.count,
    };
  }, []);

  const readBox = useCallback(() => {
    const M = modRef.current, lmp = lmpRef.current;
    if (!M || !lmp) return { matrix: new Float32Array(0), origin: new Float32Array(0), lengths: new Float32Array(0) };

    const snap = lmp.syncSimulationBox();
    return {
      matrix: (resolveView(M, snap.matrix) as Float32Array | null) ?? new Float32Array(0),
      origin: (resolveView(M, snap.origin) as Float32Array | null) ?? new Float32Array(0),
      lengths: (resolveView(M, snap.lengths) as Float32Array | null) ?? new Float32Array(0),
    };
  }, []);


  const start = useCallback(async () => {
    console.log('start')
    const { M, lmp } = await initLammps();

    const inTxt = await
      fetch(`${import.meta.env.BASE_URL}/thermal-expand.deformation`).then(r => r.text())

    M.FS.writeFile(`in.lmp`, "echo none\nlog none\nclear\n" + inTxt);
    setNetwork();

    setRunning(true);
    // lmp.setSyncFrequency(1);
    lmp.start();

    lmp.runFile(`in.lmp`);
  }, []);

  const setNetwork = async () => {
    const { M } = await initLammps();

    M.FS.writeFile(`network.lmp`, network);
  }

  const runFrames = useCallback(async (n: number) => { lmpRef.current?.advance(n, true, true); }, [])
  const stop = useCallback(() => {
    lmpRef.current?.stop();
    setRunning(false);
  }, []);

  return { ready, running, start, stop, readPositions, readBonds, runFrames, readBox, setNetwork };
}
