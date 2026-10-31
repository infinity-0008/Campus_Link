import { describe, expect, it } from "vitest";
import { averageVectors, cosineSimilarity, normalizeVector, roundVector } from "../src/utils/vectorMath.js";

describe("embedding vector helpers", () => {
  it("normalizes vectors to unit length", () => {
    const vector = normalizeVector([3, 4]);
    expect(Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0))).toBeCloseTo(1);
  });

  it("averages and renormalizes chunk vectors", () => {
    const vector = averageVectors([[1, 0], [0, 1]]);
    expect(vector[0]).toBeCloseTo(Math.SQRT1_2);
    expect(vector[1]).toBeCloseTo(Math.SQRT1_2);
  });

  it("calculates cosine similarity and rounds stored values", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(roundVector([0.123456], 4)).toEqual([0.1235]);
  });
});
