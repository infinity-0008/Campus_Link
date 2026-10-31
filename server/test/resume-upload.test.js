import { describe, expect, it } from "vitest";
import { validateResumeFile } from "../src/middleware/upload.js";

describe("resume upload validation", () => {
  it("accepts a PDF with the correct extension, MIME type and magic bytes", () => {
    expect(() => validateResumeFile({
      originalname: "resume.pdf",
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.7 sample"),
    })).not.toThrow();
  });

  it("rejects a renamed non-PDF file", () => {
    let thrown;
    try {
      validateResumeFile({
        originalname: "resume.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("MZ executable"),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown?.statusCode).toBe(415);
    expect(thrown?.code).toBe("UNSUPPORTED_RESUME_FORMAT");
  });

  it("rejects missing files", () => {
    let thrown;
    try {
      validateResumeFile(undefined);
    } catch (error) {
      thrown = error;
    }
    expect(thrown?.statusCode).toBe(400);
    expect(thrown?.code).toBe("RESUME_REQUIRED");
  });
});
