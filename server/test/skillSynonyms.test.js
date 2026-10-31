import { describe, expect, it } from "vitest";
import { SKILL_SYNONYMS, extractSkillsFromText, normalizeSkill } from "../src/utils/skillSynonyms.js";

describe("skill synonym extraction", () => {
  it("contains at least 80 canonical skill entries", () => {
    expect(Object.keys(SKILL_SYNONYMS).length).toBeGreaterThanOrEqual(80);
  });

  it("normalizes common abbreviations and detects equivalent wording", () => {
    expect(normalizeSkill("ML")).toBe("machine learning");
    expect(normalizeSkill("ReactJS")).toBe("react");
    const skills = extractSkillsFromText("Built neural models using Python, PyTorch and ReactJS; used PostgreSQL.");
    expect(skills).toEqual(expect.arrayContaining(["python", "pytorch", "react", "postgresql"]));
  });

  it("does not match short skills inside unrelated words", () => {
    expect(extractSkillsFromText("I am a good communicator.")).not.toContain("go");
  });
});
