import { describe, expect, it } from "vitest";
import { extractResumeSchema } from "../src/ai/schemas/extractResume.js";

describe("resume extraction schema", () => {
  it("accepts structured extraction output and supplies empty arrays", () => {
    const result = extractResumeSchema.parse({
      skills: ["JavaScript", "React"],
      projects: [{ title: "CampusLink", description: "Placement platform", techStack: ["React", "Node.js"] }],
    });
    expect(result.experience).toEqual([]);
    expect(result.education).toEqual([]);
  });

  it("rejects unknown fields and malformed skill lists", () => {
    expect(() => extractResumeSchema.parse({ skills: [42] })).toThrow();
    expect(() => extractResumeSchema.parse({ skills: [], privateEmail: "candidate@example.com" })).toThrow();
  });
});
