import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB id is required.");
const dateTimeSchema = z.string().datetime({ offset: true });

export const driveReportRequestSchema = z.object({
  params: z.object({ jobId: objectIdSchema }),
});

export const driveReportExportRequestSchema = z.object({
  params: z.object({ jobId: objectIdSchema }),
});

export const analyticsRangeQuerySchema = z.object({
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
}).strict().refine((value) => !value.from || !value.to || new Date(value.from) < new Date(value.to), {
  message: "from must be earlier than to.",
  path: ["from"],
});
export const analyticsRequestSchema = z.object({ query: analyticsRangeQuerySchema });
