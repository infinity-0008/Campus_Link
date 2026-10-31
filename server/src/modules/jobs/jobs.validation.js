import { z } from "zod";
import { JOB_STATUSES } from "../../config/constants.js";

const nullableDate = z.preprocess(
  (value) => value === "" ? null : value,
  z.coerce.date().nullable().optional(),
);

const salaryRangeSchema = z.object({
  min: z.number().min(0).nullable().optional(),
  max: z.number().min(0).nullable().optional(),
  currency: z.string().trim().min(3).max(3).default("INR"),
}).strict().refine(
  (value) => value.min == null || value.max == null || value.max >= value.min,
  { message: "salaryRange.max must be greater than or equal to salaryRange.min.", path: ["max"] },
);

const eligibilitySchema = z.object({
  branches: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  minCgpa: z.number().min(0).max(10).nullable().default(null),
  gradYear: z.number().int().min(1900).max(2200).nullable().default(null),
  maxBacklogs: z.number().int().min(0).default(0),
}).strict();

const requiredSkillsSchema = z.array(z.string().trim().min(1).max(80)).max(100);

const jobFields = {
  company: z.string().trim().min(2).max(180),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().min(20).max(20000),
  location: z.string().trim().min(2).max(180),
  type: z.enum(["full_time", "internship"]),
  salaryRange: salaryRangeSchema.optional(),
  requiredSkills: requiredSkillsSchema.default([]),
  eligibility: eligibilitySchema.default({}),
  deadline: nullableDate,
  driveDate: nullableDate,
};

export const createJobRequestSchema = z.object({
  body: z.object(jobFields).strict(),
});

export const updateJobRequestSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "A valid job id is required.") }),
  body: z.object(Object.fromEntries(
    Object.entries(jobFields).map(([key, schema]) => [key, schema.optional()]),
  )).strict().refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one job field to update.",
  }),
});

export const jobIdRequestSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "A valid job id is required.") }),
});

export const listJobsRequestSchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional(),
    role: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
    company: z.string().trim().max(120).optional(),
    type: z.enum(["full_time", "internship"]).optional(),
    eligible: z.enum(["true"]).optional(),
    mine: z.enum(["true"]).optional(),
    status: z.enum(Object.values(JOB_STATUSES)).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.enum(["recent", "deadline", "company", "title"]).default("recent"),
  }).strict(),
});

export const suggestSkillsRequestSchema = z.object({
  body: z.object({
    description: z.string().trim().min(20).max(20000),
    existingSkills: requiredSkillsSchema.optional().default([]),
  }).strict(),
});
