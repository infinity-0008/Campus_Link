import { describe, expect, it } from "vitest";
import { suggestJobSkills } from "../src/ai/tasks/suggestJobSkills.js";

describe("suggestJobSkills fallback", () => {
  it("returns normalized locally detected skills when no LLM is configured", async () => {
    const result = await suggestJobSkills({
      description: "We need a developer with JavaScript, React, Node.js, MongoDB and REST API experience.",
    });
    expect(result.skills).toEqual(expect.arrayContaining(["javascript", "react", "node.js", "mongodb", "rest api"]));
    expect(result.fallbackUsed).toBe(true);
    expect(result.promptVersion).toBe("1.0.0");
  });

  it("retains recruiter-provided skills in the suggestion result", async () => {
    const result = await suggestJobSkills({
      description: "We need a backend engineer who can build reliable web services and APIs.",
      existingSkills: ["JS", "PostgreSQL"],
    });
    expect(result.skills).toContain("javascript");
    expect(result.skills).toContain("postgresql");
  });
});
