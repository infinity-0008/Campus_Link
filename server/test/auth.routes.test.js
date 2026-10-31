import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("authentication route guards and validation", () => {
  it("rejects registration attempts that try to create an admin", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Platform Admin",
        email: "admin@example.com",
        password: "long-enough-password",
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid registration body before accessing MongoDB", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "not-an-email", password: "123", role: "student" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires a Bearer token for /auth/me", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("requires a Bearer token for the student profile route", async () => {
    const response = await request(app).get("/api/students/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

describe("Phase 3 student route authentication", () => {
  it.each([
    ["get", "/api/students/me"],
    ["put", "/api/students/me"],
    ["post", "/api/students/me/resume"],
    ["get", "/api/students/me/resume"],
    ["post", "/api/students/me/resume/reparse"],
  ])("requires a Bearer token for %s %s", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
