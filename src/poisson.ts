export type BoxDimensions = {
  width: number;
  height: number;
};

export type BoxMeasurement = BoxDimensions & {
  axialStrain: number;
  transverseStrain: number;
  poissonRatio: number | null;
};

const MIN_AXIAL_STRAIN = 1e-6;

export function boxDimensionsFromLengths(
  lengths: ArrayLike<number>
): BoxDimensions | null {
  const width = lengths[0];
  const height = lengths[1];
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}

export function calculateBoxMeasurement(
  reference: BoxDimensions,
  current: BoxDimensions
): BoxMeasurement | null {
  if (
    !Number.isFinite(reference.width) ||
    !Number.isFinite(reference.height) ||
    !Number.isFinite(current.width) ||
    !Number.isFinite(current.height) ||
    reference.width <= 0 ||
    reference.height <= 0 ||
    current.width <= 0 ||
    current.height <= 0
  ) {
    return null;
  }

  const axialStrain = (current.width - reference.width) / reference.width;
  const transverseStrain =
    (current.height - reference.height) / reference.height;
  const poissonRatio =
    Math.abs(axialStrain) < MIN_AXIAL_STRAIN
      ? null
      : -transverseStrain / axialStrain;

  return {
    width: current.width,
    height: current.height,
    axialStrain,
    transverseStrain,
    poissonRatio,
  };
}
