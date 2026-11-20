import { useCallback, useEffect, useRef, useState } from "react";
import type { LammpsWorkerClient, WorkerStepData } from "lammps.js/client";
import { boxDimensionsFromLengths, type BoxDimensions } from "./poisson";
import { FrameGate } from "./frameGate";

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
  reference: BoxDimensions;
  temperature: number | null;
};

type Run = {
  controller: AbortController;
  client?: LammpsWorkerClient;
  gate: FrameGate;
};

async function readAsset(path: string, signal: AbortSignal) {
  const url = import.meta.env.BASE_URL + path.replace(/^\/+/, "");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Cannot load ${path} (HTTP ${response.status}).`);
  return response.text();
}

export function useLammps(onPrint: (...args: unknown[]) => void, network: string, script: SimulationScriptSpec) {
  const [status, setStatus] = useState<"idle" | "running" | "paused">("idle");
  const [error, setError] = useState("");
  const active = useRef<Run | null>(null);
  const listener = useRef<((frame: StepFrame) => void) | null>(null);
  const setOnStep = useCallback((fn: typeof listener.current) => { listener.current = fn; }, []);

  const reset = useCallback(() => {
    const run = active.current;
    active.current = null;
    run?.controller.abort();
    run?.client?.dispose();
    run?.gate.resume();
  }, []);
  useEffect(() => reset, [reset]);

  const stop = useCallback(() => {
    const run = active.current;
    if (!run) return;
    run.gate.pause();
    setStatus("paused");
  }, []);

  const start = useCallback(async () => {
    const previous = active.current;
    if (previous) {
      previous.gate.resume();
      setStatus("running");
      return;
    }

    const run: Run = { controller: new AbortController(), gate: new FrameGate() };
    active.current = run;
    setStatus("running");
    setError("");
    let reference: BoxDimensions | null = null;
    const output = (message: unknown) => {
      const text = String(message);
      if (active.current !== run) return;
      if (text.startsWith("EDITOR_REFERENCE ")) {
        reference = boxDimensionsFromLengths(text.trim().split(/\s+/).slice(1).map(Number));
      }
      onPrint(text);
    };
    try {
      const moduleUrl = import.meta.env.BASE_URL + "lammps-runtime/client.js";
      const { LammpsClient }: typeof import("lammps.js/client") = await import(/* @vite-ignore */ moduleUrl);
      if (active.current !== run) return;
      const client = await LammpsClient.create({ print: output, printErr: output }, {
        worker: true,
        onError: err => {
          if (active.current === run) {
            setError(err.message);
            reset();
            setStatus("idle");
          }
        },
      });
      if (active.current !== run) { client.dispose(); return; }
      run.client = client;
      const signal = run.controller.signal;
      const body = await readAsset(script.path, signal);
      for (const asset of script.assets ?? []) {
        client.writeFile(asset.target ?? asset.path.split("/").pop()!, await readAsset(asset.path, signal));
      }
      if (active.current !== run) return;
      client.writeFile("network.lmp", network);
      const thermal = script.id !== "auxetic-compress";
      let nextFrameAt = 0;
      await client.runScriptAsync(body, async (data: WorkerStepData) => {
        // The worker acknowledges this frame only when the callback returns.
        // Pace visible snapshots independently of the numerical timestep.
        const delay = nextFrameAt - performance.now();
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        await run.gate.wait();
        if (!reference || active.current !== run || !data.particles || !data.box) return;
        nextFrameAt = performance.now() + 1000 / 30;
        listener.current?.({
          step: data.step, positions: data.particles.positions,
          p1: data.bonds?.first ?? new Float32Array(), p2: data.bonds?.second ?? new Float32Array(),
          bondCount: data.bonds?.count ?? 0, matrix: data.box.matrix, origin: data.box.origin,
          lengths: data.box.lengths, reference, temperature: data.computeScalars?.thermo_temp ?? null,
        });
      }, { every: 500, computeScalars: thermal ? ["thermo_temp"] : [] });
      if (!reference) throw new Error("The simulation did not report its reference cell.");
    } catch (err) {
      if (active.current === run) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (active.current === run) {
        reset();
        setStatus("idle");
      }
    }
  }, [network, script, onPrint, reset]);

  return { status, start, stop, reset, error, setOnStep };
}
