import { z } from "zod";
import { USER_STATUSES, JOB_STATUSES } from "../../config/constants.js";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB id is required.");
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const searchSchema = z.string().trim().max(120).optional();

export const listStudentsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  status: z.enum([USER_STATUSES.ACTIVE, USER_STATUSES.SUSPENDED]).optional(),
  course: z.string().trim().max(80).optional(),
  specialization: z.string().trim().max(120).optional(),
  branch: z.string().trim().max(80).optional(),
  gradYear: z.coerce.number().int().min(1900).max(2200).optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  maxCgpa: z.coerce.number().min(0).max(10).optional(),
  sort: z.enum(["name", "cgpa", "gradYear", "createdAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).strict().refine((value) => value.minCgpa === undefined || value.maxCgpa === undefined || value.minCgpa <= value.maxCgpa, {
  message: "minCgpa cannot exceed maxCgpa.",
  path: ["minCgpa"],
});

export const updateStudentBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum([USER_STATUSES.ACTIVE, USER_STATUSES.SUSPENDED]).optional(),
  rollNo: z.string().trim().max(80).nullable().optional(),
  course: z.string().trim().max(80).nullable().optional(),
  specialization: z.string().trim().max(120).nullable().optional(),
  branch: z.string().trim().max(80).nullable().optional(),
  cgpa: z.number().min(0).max(10).nullable().optional(),
  cgpaSemester: z.number().int().min(1).max(12).nullable().optional(),
  gradYear: z.number().int().min(1900).max(2200).nullable().optional(),
  backlogs: z.number().int().min(0).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field must be supplied.");

export const listRecruitersQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  status: z.enum(Object.values(USER_STATUSES)).optional(),
  sort: z.enum(["name", "company", "createdAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const listDrivesQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  q: searchSchema,
  status: z.enum(Object.values(JOB_STATUSES)).optional(),
  sort: z.enum(["createdAt", "driveDate", "deadline", "company", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const idParamsSchema = z.object({ params: z.object({ id: objectIdSchema }) });
export const studentUpdateRequestSchema = z.object({ params: z.object({ id: objectIdSchema }), body: updateStudentBodySchema });
export const studentListRequestSchema = z.object({ query: listStudentsQuerySchema });
export const recruiterListRequestSchema = z.object({ query: listRecruitersQuerySchema });
export const driveListRequestSchema = z.object({ query: listDrivesQuerySchema });

export const auditLogQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  actor: objectIdSchema.optional(),
  action: z.string().trim().max(120).optional(),
  targetType: z.string().trim().max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  q: searchSchema,
}).strict().refine((value) => !value.from || !value.to || new Date(value.from) < new Date(value.to), {
  message: "from must be earlier than to.",
  path: ["from"],
});
export const auditLogListRequestSchema = z.object({ query: auditLogQuerySchema });
