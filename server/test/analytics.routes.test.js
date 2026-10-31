import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const jobId = "507f1f77bcf86cd799439011";

describe("Phase 8 analytics routes", () => {
  it.each([
    ["get", "/api/analytics/overview"],
    ["get", "/api/analytics/skills-demand"],
    ["get", "/api/analytics/placements"],
    ["get", `/api/analytics/reports/drive/${jobId}`],
    ["get", `/api/analytics/reports/drive/${jobId}/export.csv`],
    ["get", "/api/analytics/reports/overview/export.csv"],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
