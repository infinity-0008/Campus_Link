import { describe, expect, it } from "vitest";
import { ACTIVE_INTERVIEW_STATUSES, intervalsOverlap, isActiveInterviewStatus } from "../src/modules/interviews/interviews.rules.js";

describe("Phase 7 interview scheduling rules", () => {
  const start = new Date("2026-11-01T10:00:00.000Z");

  it("detects overlapping interviews for a recruiter", () => {
    expect(intervalsOverlap(start, 60, new Date("2026-11-01T10:30:00.000Z"), 30)).toBe(true);
  });

  it("allows back-to-back interviews without overlap", () => {
    expect(intervalsOverlap(start, 30, new Date("2026-11-01T10:30:00.000Z"), 30)).toBe(false);
  });

  it("detects when an existing long interview overlaps a proposed earlier slot", () => {
    expect(intervalsOverlap(start, 30, new Date("2026-11-01T09:45:00.000Z"), 60)).toBe(true);
  });

  it("treats scheduled and rescheduled as active statuses", () => {
    expect(ACTIVE_INTERVIEW_STATUSES).toEqual(["scheduled", "rescheduled"]);
    expect(isActiveInterviewStatus("scheduled")).toBe(true);
    expect(isActiveInterviewStatus("rescheduled")).toBe(true);
    expect(isActiveInterviewStatus("cancelled")).toBe(false);
    expect(isActiveInterviewStatus("completed")).toBe(false);
  });
});
