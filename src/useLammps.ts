import { useCallback, useEffect, useRef, useState } from "react";
// import type { BufferView, ScalarType } from "./types/lammps-web";
import createModule from "lammps.js";
import type { LAMMPSWeb, BufferView, LammpsModule} from "lammps.js";

type ScriptAsset = { path: string; target?: string };
export type SimulationScriptSpec = { id: string; label: string; path: string; assets?: ReadonlyArray<ScriptAsset> };

// const base = "/work";

export function useLammps(
  onPrint: (...args: unknown[]) => void,
  network: string,
  script: SimulationScriptSpec
) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const modRef = useRef<LammpsModule | null>(null);
  const lmpRef = useRef<LAMMPSWeb | null>(null);
  const scriptRef = useRef<SimulationScriptSpec>(script);

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

  const fetchText = useCallback(async (resourcePath: string) => {
    const base = import.meta.env.BASE_URL ?? "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    const cleanedPath = resourcePath.replace(/^\/+/, "");
    const res = await fetch(`${normalizedBase}${cleanedPath}`);
    if (!res.ok) {
      throw new Error(`Failed to load ${resourcePath}: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }, []);

  const prepareScript = useCallback(
    async (spec: SimulationScriptSpec) => {
      const { M } = await initLammps();
      const scriptBody = await fetchText(spec.path);
      M.FS.writeFile("in.lmp", `echo none\nlog none\nclear\n${scriptBody}`);
      if (spec.assets) {
        for (const asset of spec.assets) {
          const assetBody = await fetchText(asset.path);
          const target =
            asset.target ??
            asset.path
              .split("/")
              .filter(Boolean)
              .pop() ??
            "asset.mod";
          M.FS.writeFile(target, assetBody);
        }
      }
    },
    [fetchText, initLammps]
  );

  useEffect(() => {
    scriptRef.current = script;
    prepareScript(script).catch((err) => {
      console.error("Failed to preload LAMMPS script", err);
    });
  }, [script, prepareScript]);

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


  const setNetwork = useCallback(async () => {
    const { M } = await initLammps();
    M.FS.writeFile("network.lmp", network);
  }, [initLammps, network]);

  useEffect(() => {
    setNetwork().catch((err) => {
      console.error("Failed to sync network with LAMMPS FS", err);
    });
  }, [setNetwork]);

  const start = useCallback(async () => {
    try {
      const { lmp } = await initLammps();
      lmp.stop();
      await prepareScript(scriptRef.current);
      await setNetwork();
      setRunning(true);
      lmp.start();
      lmp.runFile("in.lmp");
    } catch (err) {
      console.error("Failed to start LAMMPS", err);
      setRunning(false);
    }
  }, [initLammps, prepareScript, setNetwork]);

  const runFrames = useCallback(async (n: number) => { lmpRef.current?.advance(n, true, true); }, []);
  const stop = useCallback(() => {
    lmpRef.current?.stop();
    setRunning(false);
  }, []);

  return { ready, running, start, stop, readPositions, readBonds, runFrames, readBox, setNetwork };
}
