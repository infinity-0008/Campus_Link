import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("GET /api/health", () => {
  it("returns the documented readiness payload and process memory", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.objectContaining({
      status: expect.stringMatching(/^(ok|degraded)$/),
      db: expect.stringMatching(/^(connected|disconnected)$/),
      embeddings: "fallback",
      llm: expect.stringMatching(/^(enabled|disabled)$/),
      memoryMb: expect.any(Number),
    }));
    expect(response.headers["x-request-id"]).toBeTruthy();
  });
});

describe("unknown routes", () => {
  it("return the standard error response", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: expect.objectContaining({
        code: "NOT_FOUND",
        message: expect.any(String),
      }),
    });
  });
});
