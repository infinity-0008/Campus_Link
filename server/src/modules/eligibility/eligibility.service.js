import { JOB_STATUSES } from "../../config/constants.js";

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Pure, deterministic job eligibility rule evaluator.
 * `now` is injectable so deadline boundaries can be tested without timers.
 */
export function evaluateEligibility({ studentProfile, job, now = new Date() }) {
  const failures = [];
  const rules = job?.eligibility ?? {};

  const allowedCourses = Array.isArray(rules.courses) ? rules.courses : [];
  const actualCourse = studentProfile?.course ?? null;

  if (allowedCourses.length > 0) {
    const allowed = new Set(allowedCourses.map(normalize));
    if (!actualCourse || !allowed.has(normalize(actualCourse))) {
      failures.push({
        rule: "course",
        required: allowedCourses,
        actual: actualCourse,
        message: actualCourse
          ? `Degree program ${actualCourse} is not eligible for this job.`
          : `A degree/course from (${allowedCourses.join(", ")}) is required, but your profile has no course set.`,
      });
    }
  }

  const allowedBranches = Array.isArray(rules.branches) ? rules.branches : [];
  const actualBranch = studentProfile?.branch ?? null;
  const actualSpec = studentProfile?.specialization ?? null;

  if (allowedBranches.length > 0) {
    const allowed = new Set(allowedBranches.map(normalize));
    const branchMatch = actualBranch && allowed.has(normalize(actualBranch));
    const specMatch = actualSpec && allowed.has(normalize(actualSpec));

    if (!branchMatch && !specMatch) {
      failures.push({
        rule: "branch",
        required: allowedBranches,
        actual: actualBranch || actualSpec,
        message: actualBranch || actualSpec
          ? `Branch/Specialization ${actualSpec || actualBranch} is not eligible for this job.`
          : `A branch from the allowed list (${allowedBranches.join(", ")}) is required, but your profile has no branch set.`,
      });
    }
  }

  if (rules.minCgpa !== null && rules.minCgpa !== undefined) {
    const actualCgpa = studentProfile?.cgpa ?? null;
    if (actualCgpa === null || Number(actualCgpa) < Number(rules.minCgpa)) {
      failures.push({
        rule: "minCgpa",
        required: Number(rules.minCgpa),
        actual: actualCgpa,
        message: actualCgpa === null
          ? `A CGPA of at least ${rules.minCgpa} is required, but your profile has no CGPA set.`
          : `CGPA ${actualCgpa} is below the required ${rules.minCgpa}.`,
      });
    }
  }

  if (rules.gradYear !== null && rules.gradYear !== undefined) {
    const actualGradYear = studentProfile?.gradYear ?? null;
    if (actualGradYear === null || Number(actualGradYear) !== Number(rules.gradYear)) {
      failures.push({
        rule: "gradYear",
        required: Number(rules.gradYear),
        actual: actualGradYear,
        message: actualGradYear === null
          ? `Graduation year ${rules.gradYear} is required, but your profile has no graduation year set.`
          : `Graduation year ${actualGradYear} does not match the required ${rules.gradYear}.`,
      });
    }
  }

  const maxBacklogs = rules.maxBacklogs ?? 0;
  const actualBacklogs = studentProfile?.backlogs ?? 0;
  if (Number(actualBacklogs) > Number(maxBacklogs)) {
    failures.push({
      rule: "maxBacklogs",
      required: Number(maxBacklogs),
      actual: Number(actualBacklogs),
      message: `${actualBacklogs} backlogs exceed the maximum allowed ${maxBacklogs}.`,
    });
  }

  if (job?.status !== JOB_STATUSES.OPEN) {
    failures.push({
      rule: "jobStatus",
      required: JOB_STATUSES.OPEN,
      actual: job?.status ?? null,
      message: "This job is not currently open for applications.",
    });
  }

  if (job?.deadline) {
    const deadline = new Date(job.deadline);
    if (Number.isFinite(deadline.getTime()) && deadline.getTime() <= new Date(now).getTime()) {
      failures.push({
        rule: "deadline",
        required: deadline.toISOString(),
        actual: new Date(now).toISOString(),
        message: "The application deadline has passed.",
      });
    }
  }

  return { eligible: failures.length === 0, failures };
}
