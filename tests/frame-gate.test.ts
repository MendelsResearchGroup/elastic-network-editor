import assert from "node:assert/strict";
import test from "node:test";
import { FrameGate } from "../src/frameGate.ts";

test("a paused callback holds the same frame across repeated pause/resume requests", async () => {
  const gate = new FrameGate();
  const frames: number[] = [];
  const publish = async (step: number) => { await gate.wait(); frames.push(step); };
  await publish(100);
  gate.pause();
  gate.pause();
  const nextFrame = publish(200);
  gate.resume();
  gate.pause();
  await Promise.resolve();
  assert.deepEqual(frames, [100]);
  gate.resume();
  await nextFrame;
  await publish(300);
  assert.deepEqual(frames, [100, 200, 300]);
});
