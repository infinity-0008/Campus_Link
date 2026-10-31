import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema } from "../src/modules/auth/auth.validation.js";

describe("auth request schemas", () => {
  it("normalizes email and accepts student registration", () => {
    const result = registerSchema.parse({
      name: "Aarav Student",
      email: "  AARAV@example.com ",
      password: "secure-pass-123",
      role: "student",
    });

    expect(result.email).toBe("aarav@example.com");
    expect(result.role).toBe("student");
  });

  it("accepts recruiter registration with optional organization details", () => {
    const result = registerSchema.parse({
      name: "Recruiter User",
      email: "recruiter@example.com",
      password: "secure-pass-123",
      role: "recruiter",
      company: "Example Labs",
      designation: "Talent Partner",
      website: "https://example.com",
    });

    expect(result.company).toBe("Example Labs");
  });

  it("rejects public admin registration", () => {
    expect(() => registerSchema.parse({
      name: "Platform Admin",
      email: "admin@example.com",
      password: "secure-pass-123",
      role: "admin",
    })).toThrow();
  });

  it("rejects short passwords and unknown body fields", () => {
    expect(() => registerSchema.parse({
      name: "A Student",
      email: "student@example.com",
      password: "short",
      role: "student",
    })).toThrow();

    expect(() => loginSchema.parse({
      email: "student@example.com",
      password: "secure-pass-123",
      isAdmin: true,
    })).toThrow();
  });

  it("accepts an optional role selector on login", () => {
    expect(loginSchema.parse({
      email: "student@example.com",
      password: "secure-pass-123",
      role: "student",
    }).role).toBe("student");
  });
});
