export function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new TypeError("A non-empty vector is required.");
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    throw new TypeError("Cannot normalize a zero or non-finite vector.");
  }
  return vector.map((value) => value / magnitude);
}

export function averageVectors(vectors) {
  if (!Array.isArray(vectors) || vectors.length === 0) return null;
  const dimensions = vectors[0].length;
  if (!vectors.every((vector) => Array.isArray(vector) && vector.length === dimensions)) {
    throw new TypeError("All vectors must have the same dimensions.");
  }
  const mean = Array(dimensions).fill(0);
  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) mean[index] += vector[index] / vectors.length;
  }
  return normalizeVector(mean);
}

export function roundVector(vector, digits = 4) {
  const factor = 10 ** digits;
  return vector.map((value) => Math.round(value * factor) / factor);
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) {
    throw new TypeError("Cosine similarity requires equally-sized, non-empty vectors.");
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
