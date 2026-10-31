import { z } from "zod";

export const suggestJobSkillsSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(80)).max(80),
}).strict();
