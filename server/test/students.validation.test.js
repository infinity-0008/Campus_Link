import { describe, expect, it } from "vitest";
import { updateStudentProfileSchema } from "../src/modules/students/students.validation.js";

describe("student profile update validation", () => {
  it("accepts profile fields within the documented bounds", () => {
    const result = updateStudentProfileSchema.parse({
      body: { branch: "CSE", cgpa: 8.4, gradYear: 2027, backlogs: 0, skills: ["JavaScript", "React"] },
    });
    expect(result.body.cgpa).toBe(8.4);
  });

  it("rejects CGPA outside 0 to 10 and unknown protected fields", () => {
    expect(() => updateStudentProfileSchema.parse({ body: { cgpa: 10.1 } })).toThrow();
    expect(() => updateStudentProfileSchema.parse({ body: { role: "admin" } })).toThrow();
  });

  it("rejects an empty update and reversed experience dates", () => {
    expect(() => updateStudentProfileSchema.parse({ body: {} })).toThrow();
    expect(() => updateStudentProfileSchema.parse({
      body: { experience: [{ company: "X", role: "Dev", startDate: "2025-01-01", endDate: "2024-01-01" }] },
    })).toThrow();
  });
});
