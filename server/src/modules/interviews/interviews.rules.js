export const ACTIVE_INTERVIEW_STATUSES = Object.freeze(["scheduled", "rescheduled"]);

/** Half-open interval comparison: an interview ending at another's start is not a conflict. */
export function intervalsOverlap(startA, durationA, startB, durationB) {
  const aStart = new Date(startA).getTime();
  const bStart = new Date(startB).getTime();
  const aEnd = aStart + Number(durationA) * 60_000;
  const bEnd = bStart + Number(durationB) * 60_000;
  return aStart < bEnd && bStart < aEnd;
}

export function isActiveInterviewStatus(status) {
  return ACTIVE_INTERVIEW_STATUSES.includes(status);
}

export function formatInterviewTime(date) {
  return new Date(date).toISOString();
}
