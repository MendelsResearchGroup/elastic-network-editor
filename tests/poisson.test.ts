import assert from "node:assert/strict";
import test from "node:test";
import {
  boxDimensionsFromLengths,
  calculateBoxMeasurement,
} from "../src/poisson.ts";

test("reads horizontal and vertical box lengths", () => {
  assert.deepEqual(boxDimensionsFromLengths(new Float32Array([12, 8, 1])), {
    width: 12,
    height: 8,
  });
  assert.equal(boxDimensionsFromLengths(new Float32Array([0, 8, 1])), null);
});

test("calculates horizontal-compression Poisson ratio", () => {
  const measurement = calculateBoxMeasurement(
    { width: 10, height: 5 },
    { width: 9, height: 5.25 }
  );

  assert.deepEqual(measurement, {
    width: 9,
    height: 5.25,
    axialStrain: -0.1,
    transverseStrain: 0.05,
    poissonRatio: 0.5,
  });
});

test("returns no ratio when axial strain is effectively zero", () => {
  const measurement = calculateBoxMeasurement(
    { width: 10, height: 5 },
    { width: 10 + 1e-8, height: 5.25 }
  );

  assert.equal(measurement.poissonRatio, null);
});

test("returns no measurement for invalid box dimensions", () => {
  assert.equal(
    calculateBoxMeasurement(
      { width: 0, height: 5 },
      { width: 9, height: 5.25 }
    ),
    null
  );
});
