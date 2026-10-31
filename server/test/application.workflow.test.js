import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, APPLICATION_TRANSITIONS } from "../src/config/constants.js";
import { changeApplicationStatusRequestSchema, bulkShortlistRequestSchema } from "../src/modules/applications/application.validation.js";

const { APPLIED, SHORTLISTED, INTERVIEW_SCHEDULED, SELECTED, REJECTED } = APPLICATION_STATUSES;

describe("Phase 6 application workflow contract", () => {
  it("allows only the specified application status transitions", () => {
    expect(APPLICATION_TRANSITIONS[APPLIED]).toEqual([SHORTLISTED, REJECTED]);
    expect(APPLICATION_TRANSITIONS[SHORTLISTED]).toEqual([INTERVIEW_SCHEDULED, REJECTED]);
    expect(APPLICATION_TRANSITIONS[INTERVIEW_SCHEDULED]).toEqual([SELECTED, REJECTED, SHORTLISTED]);
    expect(APPLICATION_TRANSITIONS[SELECTED]).toEqual([]);
    expect(APPLICATION_TRANSITIONS[REJECTED]).toEqual([]);
  });

  it("accepts a valid status update and optional note", () => {
    const result = changeApplicationStatusRequestSchema.safeParse({
      params: { id: "507f1f77bcf86cd799439012" },
      body: { status: SHORTLISTED, note: "Reviewed by recruiter." },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported status", () => {
    const result = changeApplicationStatusRequestSchema.safeParse({
      params: { id: "507f1f77bcf86cd799439012" },
      body: { status: "pending" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate application IDs in bulk shortlisting", () => {
    const id = "507f1f77bcf86cd799439012";
    const result = bulkShortlistRequestSchema.safeParse({
      params: { id: "507f1f77bcf86cd799439011" },
      body: { applicationIds: [id, id] },
    });
    expect(result.success).toBe(false);
  });
});
