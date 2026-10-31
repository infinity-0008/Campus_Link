import { describe, expect, it } from "vitest";
import {
  listStudentsQuerySchema,
  updateStudentBodySchema,
  auditLogQuerySchema,
} from "../src/modules/admin/admin.validation.js";

describe("Phase 8 admin validation", () => {
  it("applies safe pagination defaults", () => {
    expect(listStudentsQuerySchema.parse({}).page).toBe(1);
    expect(listStudentsQuerySchema.parse({}).limit).toBe(20);
  });

  it("rejects a CGPA range where min exceeds max", () => {
    expect(listStudentsQuerySchema.safeParse({ minCgpa: "8.5", maxCgpa: "7.5" }).success).toBe(false);
  });

  it("rejects empty student updates", () => {
    expect(updateStudentBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects a reversed audit-log date range", () => {
    expect(auditLogQuerySchema.safeParse({
      from: "2026-02-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    }).success).toBe(false);
  });
});
