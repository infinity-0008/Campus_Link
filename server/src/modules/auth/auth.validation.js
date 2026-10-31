import { z } from "zod";
import { USER_ROLES } from "../../config/constants.js";

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters.")
  .max(128)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 UTF-8 bytes when using bcrypt.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum([USER_ROLES.STUDENT, USER_ROLES.RECRUITER]),
  // Optional recruiter details allow a profile shell to be created at registration.
  company: z.string().trim().max(180).optional(),
  designation: z.string().trim().max(160).optional(),
  website: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().url().max(500).optional(),
  ),
}).strict();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  // The unified login UI may send its selected role. The server always checks it
  // against the role stored on the account; this value never grants permissions.
  role: z.enum(Object.values(USER_ROLES)).optional(),
}).strict();

export const registerRequestSchema = z.object({ body: registerSchema });
export const loginRequestSchema = z.object({ body: loginSchema });
