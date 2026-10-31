import { z } from "zod";

export const explainMatchSchema = z.object({
  summary: z.string().trim().min(20).max(1200),
  gapAdvice: z.string().trim().min(10).max(1200),
}).strict();
