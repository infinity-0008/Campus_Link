import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

const interviewId = "507f1f77bcf86cd799439011";

describe("Phase 7 interview routes", () => {
  it.each([
    ["post", "/api/interviews"],
    ["get", "/api/interviews/me"],
    ["get", "/api/interviews?from=2027-01-01T00:00:00.000Z&to=2027-02-01T00:00:00.000Z"],
    ["patch", `/api/interviews/${interviewId}`],
    ["get", "/api/notifications"],
    ["patch", `/api/notifications/${interviewId}/read`],
    ["patch", "/api/notifications/read-all"],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
