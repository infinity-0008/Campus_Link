import { describe, expect, it } from "vitest";
import { JOB_STATUSES } from "../src/config/constants.js";
import { evaluateEligibility } from "../src/modules/eligibility/eligibility.service.js";

const now = new Date("2026-10-31T10:00:00.000Z");
const eligibleStudent = {
  branch: "CSE",
  cgpa: 8.0,
  gradYear: 2027,
  backlogs: 1,
};
const openJob = {
  status: JOB_STATUSES.OPEN,
  deadline: new Date("2026-11-01T10:00:00.000Z"),
  eligibility: {
    branches: ["CSE", "IT"],
    minCgpa: 8.0,
    gradYear: 2027,
    maxBacklogs: 1,
  },
};

describe("evaluateEligibility", () => {
  it("passes when the student meets every rule, including exact boundaries", () => {
    expect(evaluateEligibility({ studentProfile: eligibleStudent, job: openJob, now }))
      .toEqual({ eligible: true, failures: [] });
  });

  it("treats an empty allowed-branches list as all branches", () => {
    const result = evaluateEligibility({
      studentProfile: { ...eligibleStudent, branch: "ECE" },
      job: { ...openJob, eligibility: { ...openJob.eligibility, branches: [] } },
      now,
    });
    expect(result.eligible).toBe(true);
  });

  it("rejects a branch outside the allowed list and a missing branch", () => {
    const otherBranch = evaluateEligibility({
      studentProfile: { ...eligibleStudent, branch: "ECE" }, job: openJob, now,
    });
    const missingBranch = evaluateEligibility({
      studentProfile: { ...eligibleStudent, branch: null }, job: openJob, now,
    });
    expect(otherBranch.failures.map((failure) => failure.rule)).toContain("branch");
    expect(missingBranch.failures.map((failure) => failure.rule)).toContain("branch");
  });

  it("accepts CGPA equal to the minimum and rejects CGPA below it or missing", () => {
    const equal = evaluateEligibility({ studentProfile: { ...eligibleStudent, cgpa: 8 }, job: openJob, now });
    const below = evaluateEligibility({ studentProfile: { ...eligibleStudent, cgpa: 7.99 }, job: openJob, now });
    const missing = evaluateEligibility({ studentProfile: { ...eligibleStudent, cgpa: null }, job: openJob, now });
    expect(equal.failures.some((failure) => failure.rule === "minCgpa")).toBe(false);
    expect(below.failures.some((failure) => failure.rule === "minCgpa")).toBe(true);
    expect(missing.failures.some((failure) => failure.rule === "minCgpa")).toBe(true);
  });

  it("requires the configured graduation year", () => {
    const wrong = evaluateEligibility({ studentProfile: { ...eligibleStudent, gradYear: 2028 }, job: openJob, now });
    const missing = evaluateEligibility({ studentProfile: { ...eligibleStudent, gradYear: null }, job: openJob, now });
    expect(wrong.failures.some((failure) => failure.rule === "gradYear")).toBe(true);
    expect(missing.failures.some((failure) => failure.rule === "gradYear")).toBe(true);
  });

  it("accepts backlogs equal to the maximum and rejects one above it", () => {
    const equal = evaluateEligibility({ studentProfile: { ...eligibleStudent, backlogs: 1 }, job: openJob, now });
    const above = evaluateEligibility({ studentProfile: { ...eligibleStudent, backlogs: 2 }, job: openJob, now });
    expect(equal.failures.some((failure) => failure.rule === "maxBacklogs")).toBe(false);
    expect(above.failures.some((failure) => failure.rule === "maxBacklogs")).toBe(true);
  });

  it("rejects jobs that are not open", () => {
    const result = evaluateEligibility({
      studentProfile: eligibleStudent,
      job: { ...openJob, status: JOB_STATUSES.DRAFT },
      now,
    });
    expect(result.failures.some((failure) => failure.rule === "jobStatus")).toBe(true);
  });

  it("treats the exact deadline instant as expired", () => {
    const result = evaluateEligibility({
      studentProfile: eligibleStudent,
      job: { ...openJob, deadline: now },
      now,
    });
    expect(result.failures.some((failure) => failure.rule === "deadline")).toBe(true);
  });

  it("does not apply a deadline rule when no deadline is configured", () => {
    const result = evaluateEligibility({
      studentProfile: eligibleStudent,
      job: { ...openJob, deadline: null },
      now,
    });
    expect(result.failures.some((failure) => failure.rule === "deadline")).toBe(false);
  });
});
