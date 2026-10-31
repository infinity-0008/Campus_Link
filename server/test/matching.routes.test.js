import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Phase 5 matching routes", () => {
  it.each([
    ["get", "/api/jobs/recommended"],
    ["get", "/api/jobs/507f1f77bcf86cd799439011/fit"],
    ["get", "/api/matching/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012"],
    ["get", "/api/matching/507f1f77bcf86cd799439011/507f1f77bcf86cd799439012/compare"],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects malformed match identifiers after authentication is supplied", async () => {
    const response = await request(app)
      .get("/api/matching/not-a-job/not-a-student")
      .set("Authorization", "Bearer invalid-token");
    expect(response.status).toBe(401);
  });
});
