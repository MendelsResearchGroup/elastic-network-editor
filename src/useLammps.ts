import { useCallback, useEffect, useRef, useState } from "react";
import { LammpsClient } from "lammps.js/client";

type ScriptAsset = { path: string; target?: string };
export type SimulationScriptSpec = { id: string; label: string; path: string; assets?: ReadonlyArray<ScriptAsset> };
export type StepFrame = {
  step: number;
  positions: Float32Array;
  p1: Float32Array;
  p2: Float32Array;
  bondCount: number;
  matrix: Float32Array;
  origin: Float32Array;
  lengths: Float32Array;
};

export function useLammps(
  onPrint: (...args: unknown[]) => void,
  network: string,
  script: SimulationScriptSpec
) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const clientRef = useRef<LammpsClient | null>(null);
  const scriptRef = useRef<SimulationScriptSpec>(script);
  const runSeqRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const onStepRef = useRef<((frame: StepFrame) => void) | null>(null);
  const pendingFrameRef = useRef<StepFrame | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const delayResolveRef = useRef<(() => void) | null>(null);
  const deferredStopTimerRef = useRef<number | null>(null);

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      delayResolveRef.current = () => {
        delayResolveRef.current = null;
        delayTimerRef.current = null;
        resolve();
      };
      delayTimerRef.current = window.setTimeout(() => {
        delayResolveRef.current?.();
      }, ms);
    });
  }, []);

  const cancelSleep = useCallback(() => {
    if (delayTimerRef.current !== null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    delayResolveRef.current?.();
    delayResolveRef.current = null;
  }, []);

  const clearDeferredStop = useCallback(() => {
    if (deferredStopTimerRef.current !== null) {
      window.clearTimeout(deferredStopTimerRef.current);
      deferredStopTimerRef.current = null;
    }
  }, []);

  const requestStop = useCallback((dispose = false) => {
    stopRequestedRef.current = true;
    runSeqRef.current += 1;
    cancelSleep();
    clearDeferredStop();
    setRunning(false);

    const client = clientRef.current;
    if (!client) {
      if (dispose) {
        setReady(false);
      }
      return;
    }

    if (dispose) {
      clientRef.current = null;
      setReady(false);
    }

    deferredStopTimerRef.current = window.setTimeout(() => {
      deferredStopTimerRef.current = null;
      if (!dispose && clientRef.current !== client) return;

      client.stop();
      if (dispose) {
        client.dispose();
      }
    }, 0);
  }, [cancelSleep, clearDeferredStop]);

  const initLammps = useCallback(async () => {
    if (clientRef.current) return clientRef.current;
    const client = await LammpsClient.create({
      print: onPrint,
      printErr: onPrint,
    });
    clientRef.current = client;
    setReady(true);
    return client;
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
      const client = await initLammps();
      const scriptBody = await fetchText(spec.path);
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
          client.writeFile(target, assetBody);
        }
      }
      return scriptBody.endsWith("\n") ? scriptBody : `${scriptBody}\n`;
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
    const client = clientRef.current;
    if (!client) return { positions: new Float32Array(0), ids: new Int32Array(0), types: new Int32Array(0), count: 0 };
    const particles = client.syncParticles({ copy: false });
    if (!particles.count) {
      return { positions: new Float32Array(0), ids: new Int32Array(0), types: new Int32Array(0), count: 0 };
    }
    return {
      positions: (particles.positions as Float32Array) ?? new Float32Array(0),
      ids: particles.ids ?? new Int32Array(0),
      types: (particles.types as Int32Array) ?? new Int32Array(0),
      count: particles.count,
    };
  }, []);


  const readBonds = useCallback(() => {
    const client = clientRef.current;
    if (!client) return { p1: new Float32Array(0), p2: new Float32Array(0), count: 0 };
    const bonds = client.syncBonds({ copy: false });
    if (!bonds.count) {
      return { p1: new Float32Array(0), p2: new Float32Array(0), count: 0 };
    }
    return {
      p1: (bonds.first as Float32Array) ?? new Float32Array(0),
      p2: (bonds.second as Float32Array) ?? new Float32Array(0),
      count: bonds.count,
    };
  }, []);

  const readBox = useCallback(() => {
    const client = clientRef.current;
    if (!client) return { matrix: new Float32Array(0), origin: new Float32Array(0), lengths: new Float32Array(0) };
    const box = client.syncBox({ copy: false });
    return {
      matrix: (box.matrix as Float32Array) ?? new Float32Array(0),
      origin: (box.origin as Float32Array) ?? new Float32Array(0),
      lengths: (box.lengths as Float32Array) ?? new Float32Array(0),
    };
  }, []);

  const setOnStep = useCallback((onStep: ((frame: StepFrame) => void) | null) => {
    onStepRef.current = onStep;
    if (onStep && pendingFrameRef.current) {
      onStep(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
  }, []);


  const setNetwork = useCallback(async () => {
    const client = await initLammps();
    client.writeFile("network.lmp", network);
  }, [initLammps, network]);

  useEffect(() => {
    setNetwork().catch((err) => {
      console.error("Failed to sync network with LAMMPS FS", err);
    });
  }, [setNetwork]);

  useEffect(() => {
    const shutdown = () => {
      requestStop(true);
    };

    window.addEventListener("beforeunload", shutdown);
    return () => {
      window.removeEventListener("beforeunload", shutdown);
      shutdown();
    };
  }, [requestStop]);

  const start = useCallback(async () => {
    requestStop();
    const runSeq = runSeqRef.current + 1;
    runSeqRef.current = runSeq;
    stopRequestedRef.current = false;
    cancelSleep();

    try {
      const client = await initLammps();
      const scriptText = await prepareScript(scriptRef.current);
      await setNetwork();
      setRunning(true);
      client.start();
      void client.runScriptAsync(
        scriptText,
        async (data) => {
          if (runSeqRef.current !== runSeq || stopRequestedRef.current) return;

          const frame: StepFrame = {
            step: data.step,
            positions: data.particles?.positions
              ? Float32Array.from(data.particles.positions)
              : new Float32Array(0),
            p1: data.bonds?.first
              ? Float32Array.from(data.bonds.first)
              : new Float32Array(0),
            p2: data.bonds?.second
              ? Float32Array.from(data.bonds.second)
              : new Float32Array(0),
            bondCount: data.bonds?.count ?? 0,
            matrix: data.box?.matrix
              ? Float32Array.from(data.box.matrix)
              : new Float32Array(0),
            origin: data.box?.origin
              ? Float32Array.from(data.box.origin)
              : new Float32Array(0),
            lengths: data.box?.lengths
              ? Float32Array.from(data.box.lengths)
              : new Float32Array(0),
          };

          if (onStepRef.current) {
            onStepRef.current(frame);
          } else {
            pendingFrameRef.current = frame;
          }

          await sleep(0);
        },
        { every: 10, fixId: "jsasync", copy: false }
      ).catch((err) => {
        if (runSeqRef.current === runSeq && !stopRequestedRef.current) {
          console.error("Failed to start LAMMPS", err);
        }
      }).finally(() => {
        if (runSeqRef.current === runSeq) {
          setRunning(false);
        }
      });
    } catch (err) {
      if (!stopRequestedRef.current) {
        console.error("Failed to start LAMMPS", err);
      }
      if (runSeqRef.current === runSeq) {
        setRunning(false);
      }
    }
  }, [cancelSleep, initLammps, prepareScript, requestStop, setNetwork, sleep]);

  const stop = useCallback(() => {
    requestStop();
  }, [requestStop]);

  const reset = useCallback(() => {
    pendingFrameRef.current = null;
    requestStop(true);
  }, [requestStop]);

  return { ready, running, start, stop, reset, readPositions, readBonds, readBox, setNetwork, setOnStep };
}
