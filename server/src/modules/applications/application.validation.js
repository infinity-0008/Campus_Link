import { z } from "zod";
import { APPLICATION_STATUSES } from "../../config/constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB id is required.");

export const applyToJobRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
  body: z.object({}).strict().optional(),
});

export const myApplicationsRequestSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(Object.values(APPLICATION_STATUSES)).optional(),
    sort: z.enum(["recent", "oldest"]).default("recent"),
  }).strict(),
});

export const applicantListRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
  query: z.object({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.enum(["score", "date"]).default("score"),
    status: z.enum(Object.values(APPLICATION_STATUSES)).optional(),
    minScore: z.coerce.number().min(0).max(100).optional(),
    q: z.string().trim().max(120).optional(),
  }).strict(),
});

export const changeApplicationStatusRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
  body: z.object({
    status: z.enum(Object.values(APPLICATION_STATUSES)),
    note: z.string().trim().max(1000).optional().default(""),
  }).strict(),
});

export const bulkShortlistRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
  body: z.object({
    applicationIds: z.array(objectId).min(1).max(100),
    note: z.string().trim().max(1000).optional().default(""),
  }).strict().refine((body) => new Set(body.applicationIds).size === body.applicationIds.length, {
    message: "applicationIds must not contain duplicates.",
    path: ["applicationIds"],
  }),
});

export const applicationIdRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
});
