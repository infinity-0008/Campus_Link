import { describe, expect, it } from "vitest";
import { sanitizeResumeText } from "../src/ai/sanitize.js";

describe("resume PII sanitization", () => {
  it("removes emails and phone numbers before LLM processing", () => {
    const result = sanitizeResumeText("Contact me at candidate@example.com or +91 98765 43210.");
    expect(result).not.toContain("candidate@example.com");
    expect(result).not.toContain("98765 43210");
    expect(result).toContain("[EMAIL REDACTED]");
    expect(result).toContain("[PHONE REDACTED]");
  });
});
