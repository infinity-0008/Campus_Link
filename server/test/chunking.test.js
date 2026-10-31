import { describe, expect, it } from "vitest";
import { chunkText } from "../src/utils/chunking.js";

describe("chunkText", () => {
  it("splits long text into chunks of at most the requested number of words", () => {
    const chunks = chunkText("one two three four five six seven", 3);
    expect(chunks).toEqual(["one two three", "four five six", "seven"]);
    expect(chunks.every((chunk) => chunk.split(/\s+/).length <= 3)).toBe(true);
  });

  it("returns an empty list for blank input", () => {
    expect(chunkText("  ")).toEqual([]);
  });
});
