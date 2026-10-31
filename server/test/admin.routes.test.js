import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const studentId = "507f1f77bcf86cd799439011";

describe("Phase 8 admin routes", () => {
  it.each([
    ["get", "/api/admin/students"],
    ["patch", `/api/admin/students/${studentId}`],
    ["get", "/api/admin/recruiters"],
    ["patch", `/api/admin/recruiters/${studentId}/approve`],
    ["get", "/api/admin/drives"],
    ["get", "/api/admin/audit-logs"],
    ["get", "/api/admin/export/students.csv"],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
