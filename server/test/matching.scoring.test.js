import { describe, expect, it } from "vitest";
import { calculateMatchScores } from "../src/modules/matching/matching.scoring.js";

function unitVector(cosine, dimensions = 384) {
  const vector = Array(dimensions).fill(0);
  vector[0] = cosine;
  vector[1] = Math.sqrt(Math.max(0, 1 - cosine ** 2));
  return vector;
}

function vectorOnXAxis(dimensions = 384) {
  const vector = Array(dimensions).fill(0);
  vector[0] = 1;
  return vector;
}

function semanticFixture(cosine = 0.71) {
  const jobVector = vectorOnXAxis();
  const resumeVector = unitVector(cosine);
  return {
    allowEmbeddings: true,
    threshold: 0.55,
    profile: {
      skills: [],
      projects: [{ title: "Neural classifier", description: "Built a neural network classifier for image recognition." }],
      experience: [],
      resume: {
        parsedSkills: [],
        parsedText: "Built a neural network classifier for image recognition.",
      },
      embeddings: {
        doc: resumeVector,
        items: [{ kind: "project", text: "Built a neural network classifier for image recognition", vector: resumeVector }],
      },
    },
    job: {
      requiredSkills: ["machine learning"],
      description: "Develop machine learning models for classification.",
      embeddings: {
        doc: jobVector,
        skills: [{ text: "machine learning", vector: jobVector }],
      },
    },
  };
}

describe("Phase 5 matching scorer", () => {
  it("lets semantic embeddings find differently worded skills that exact keywords miss", () => {
    const result = calculateMatchScores(semanticFixture(0.71));

    expect(result.method).toBe("embeddings");
    expect(result.comparison.keyword).toBe(0);
    expect(result.comparison.embeddings).toBeGreaterThan(result.comparison.keyword);
    expect(result.matchedSkills).toEqual([
      expect.objectContaining({ required: "machine learning", similarity: 0.71 }),
    ]);
    expect(result.missingSkills).toEqual([]);
  });

  it("uses the TF-IDF path when embeddings are disabled and records fallbackUsed", () => {
    const result = calculateMatchScores({
      allowEmbeddings: false,
      profile: {
        skills: [],
        projects: [],
        experience: [],
        resume: { parsedSkills: [], parsedText: "ML and DL concepts applied in a neural network project." },
      },
      job: { requiredSkills: ["machine learning", "deep learning"], description: "Machine learning and deep learning role." },
    });

    expect(result.method).toBe("tfidf-fallback");
    expect(result.fallbackUsed).toBe(true);
    expect(result.comparison.keyword).toBe(0);
    expect(result.comparison.embeddings).toBeNull();
    expect(result.matchedSkills.map((item) => item.required)).toEqual(["machine learning", "deep learning"]);
  });

  it("treats the configured skill threshold as inclusive", () => {
    const atBoundary = calculateMatchScores(semanticFixture(0.55));
    const belowBoundary = calculateMatchScores(semanticFixture(0.549));

    expect(atBoundary.matchedSkills).toHaveLength(1);
    expect(belowBoundary.matchedSkills).toHaveLength(0);
    expect(belowBoundary.missingSkills).toContain("machine learning");
  });

  it("returns one or two static learning resources for known skill gaps", () => {
    const fixture = semanticFixture(0.2);
    const result = calculateMatchScores(fixture);
    const machineLearningGap = result.skillGaps.find((item) => item.skill === "machine learning");

    expect(machineLearningGap.resources.length).toBeGreaterThan(0);
    expect(machineLearningGap.resources.length).toBeLessThanOrEqual(2);
    expect(machineLearningGap.resources[0].url).toMatch(/^https:\/\//);
  });

  it("keeps the PDF weighting formula in the embedding breakdown", () => {
    const result = calculateMatchScores(semanticFixture());
    expect(result.breakdown.weights).toEqual({ skill: 0.5, doc: 0.3, project: 0.2 });
  });
});
