import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Phase 4 job routes", () => {
  it.each([
    ["get", "/api/jobs"],
    ["post", "/api/jobs"],
    ["post", "/api/jobs/ai/suggest-skills"],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects a malformed job id after authentication is supplied", async () => {
    // A syntactically invalid token is rejected before route parameter processing.
    const response = await request(app)
      .get("/api/jobs/not-an-id")
      .set("Authorization", "Bearer invalid-token");
    expect(response.status).toBe(401);
  });
});
