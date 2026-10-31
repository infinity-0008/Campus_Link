import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB id is required.");

export const listNotificationsRequestSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(100000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    unreadOnly: z.enum(["true", "false"]).optional().default("false"),
  }).strict(),
});

export const notificationIdRequestSchema = z.object({
  params: z.object({ id: objectId }).strict(),
});
