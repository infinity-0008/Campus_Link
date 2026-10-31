import { describe, expect, it } from "vitest";
import {
  createInterviewRequestSchema,
  interviewCalendarRequestSchema,
  updateInterviewRequestSchema,
} from "../src/modules/interviews/interviews.validation.js";

const validId = "507f1f77bcf86cd799439011";
const future = "2027-01-01T10:00:00.000Z";

describe("Phase 7 interview request validation", () => {
  it("accepts an online interview with a meeting link", () => {
    const result = createInterviewRequestSchema.safeParse({
      body: {
        applicationId: validId,
        scheduledAt: future,
        durationMins: 30,
        mode: "online",
        link: "https://meet.example.com/room",
      },
    });
    expect(result.success).toBe(true);
  });

  it("requires a link for online interviews", () => {
    const result = createInterviewRequestSchema.safeParse({
      body: {
        applicationId: validId,
        scheduledAt: future,
        durationMins: 30,
        mode: "online",
      },
    });
    expect(result.success).toBe(false);
  });

  it("requires a location for onsite interviews", () => {
    const result = createInterviewRequestSchema.safeParse({
      body: {
        applicationId: validId,
        scheduledAt: future,
        durationMins: 30,
        mode: "onsite",
      },
    });
    expect(result.success).toBe(false);
  });

  it("requires a bounded from/to range for calendar queries", () => {
    expect(interviewCalendarRequestSchema.safeParse({ query: { from: future } }).success).toBe(false);
    expect(interviewCalendarRequestSchema.safeParse({
      query: { from: "2027-01-01T00:00:00.000Z", to: "2027-02-01T00:00:00.000Z", page: "1", limit: "20" },
    }).success).toBe(true);
  });

  it("requires a new scheduledAt value for rescheduling", () => {
    expect(updateInterviewRequestSchema.safeParse({
      params: { id: validId },
      body: { action: "reschedule" },
    }).success).toBe(false);
  });
});
