import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB id is required.");

export const matchingPairRequestSchema = z.object({
  params: z.object({ jobId: objectId, studentId: objectId }).strict(),
});

export const matchingJobFitRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
});

export const recommendedJobsRequestSchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional(),
    company: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
    type: z.enum(["full_time", "internship"]).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).strict(),
});
