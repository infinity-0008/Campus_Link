import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const jobId = "507f1f77bcf86cd799439011";
const applicationId = "507f1f77bcf86cd799439012";

describe("Phase 6 application routes", () => {
  it.each([
    ["post", `/api/jobs/${jobId}/apply`],
    ["get", "/api/applications/me"],
    ["get", `/api/jobs/${jobId}/applications`],
    ["get", `/api/jobs/${jobId}/applications/export.csv`],
    ["patch", `/api/jobs/${jobId}/applications/bulk-shortlist`],
    ["patch", `/api/applications/${applicationId}/status`],
    ["get", `/api/applications/${applicationId}/ai-summary`],
    ["get", `/api/students/${applicationId}`],
    ["get", `/api/students/${applicationId}/resume`],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
