import { describe, expect, it, vi } from "vitest";
import { authorize } from "../src/middleware/authorize.js";

describe("authorize middleware", () => {
  it("returns 401 when no authenticated user is attached", () => {
    const next = vi.fn();
    authorize("student")({}, {}, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it("returns 403 when the authenticated role is not allowed", () => {
    const next = vi.fn();
    authorize("student")({ user: { role: "recruiter" } }, {}, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(next.mock.calls[0][0].code).toBe("FORBIDDEN");
  });

  it("continues when the authenticated role is allowed", () => {
    const next = vi.fn();
    authorize("student", "admin")({ user: { role: "student" } }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
