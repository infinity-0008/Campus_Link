import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB id is required.");
const dateTime = z.string().datetime({ offset: true, message: "Use an ISO 8601 date-time with a timezone, preferably UTC (Z)." });
const durationMins = z.number().int().min(1).max(1440);
const mode = z.enum(["online", "onsite"]);
const location = z.string().trim().max(500).optional().nullable();
const link = z.string().trim().url().max(1000).optional().nullable();
const notes = z.string().trim().max(5000).optional().default("");

export const createInterviewRequestSchema = z.object({
  body: z.object({
    applicationId: objectId,
    scheduledAt: dateTime,
    durationMins,
    mode,
    location,
    link,
    notes,
  }).strict().superRefine((value, context) => {
    if (value.mode === "online" && !value.link) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["link"], message: "A meeting link is required for online interviews." });
    }
    if (value.mode === "onsite" && !value.location) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["location"], message: "A location is required for onsite interviews." });
    }
    if (new Date(value.scheduledAt).getTime() <= Date.now()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledAt"], message: "Interview must be scheduled in the future." });
    }
  }),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  from: dateTime.optional(),
  to: dateTime.optional(),
  status: z.enum(["scheduled", "completed", "cancelled", "rescheduled"]).optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.from) !== Boolean(value.to)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [value.from ? "to" : "from"], message: "Provide both from and to date-times, or neither." });
  }
  if (value.from && value.to) {
    const from = new Date(value.from).getTime();
    const to = new Date(value.to).getTime();
    if (from >= to) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "The to date-time must be later than from." });
    }
    if (to - from > 366 * 24 * 60 * 60 * 1000) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Calendar range cannot exceed 366 days." });
    }
  }
});

export const myInterviewsRequestSchema = z.object({ query: listQuery });

export const interviewCalendarRequestSchema = z.object({
  query: listQuery.superRefine((value, context) => {
    if (!value.from || !value.to) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["from"], message: "Calendar requests require both from and to." });
    }
  }),
});

export const updateInterviewRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
  body: z.object({
    action: z.enum(["reschedule", "cancel", "complete"]),
    scheduledAt: dateTime.optional(),
    durationMins: durationMins.optional(),
    mode: mode.optional(),
    location,
    link,
    notes: z.string().trim().max(5000).optional(),
  }).strict().superRefine((value, context) => {
    if (value.action === "reschedule") {
      if (!value.scheduledAt) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledAt"], message: "A new scheduledAt value is required to reschedule." });
      } else if (new Date(value.scheduledAt).getTime() <= Date.now()) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledAt"], message: "Interview must be rescheduled into the future." });
      }
    }
    if (value.action !== "reschedule" && ["scheduledAt", "durationMins", "mode", "location", "link"].some((key) => value[key] !== undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["action"], message: "Scheduling fields may only be supplied when action is reschedule." });
    }
  }),
});
