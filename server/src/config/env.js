import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Resolve server/.env explicitly so `npm run dev` works when launched from the
// repository root (the documented workflow). Existing process variables win.
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const booleanFromEnv = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.union([z.boolean(), z.enum(["true", "false"])]).transform((value) => value === true || value === "true"),
);

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z.string().default(""),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  JWT_SECRET: z.string().default(""),
  JWT_EXPIRES_IN: z.string().min(1).default("1d"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  MAX_RESUME_MB: z.coerce.number().int().min(1).max(20).default(5),
  AI_ENABLED: booleanFromEnv.default(true),
  LLM_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  LLM_MODEL: optionalNonEmptyString,
  LLM_API_KEY: optionalNonEmptyString,
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
  LLM_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  EMBEDDINGS_ENABLED: booleanFromEnv.default(true),
  EMBEDDINGS_MODEL: z.string().min(1).default("Xenova/all-MiniLM-L6-v2"),
  EMBEDDINGS_THREADS: z.coerce.number().int().min(1).max(4).default(1),
  PARSE_THREADS: z.coerce.number().int().min(1).max(8).default(2),
  SKILL_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
}).superRefine((values, context) => {
  if (values.NODE_ENV === "production") {
    if (!values.MONGODB_URI) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MONGODB_URI"],
        message: "MONGODB_URI is required in production.",
      });
    }
  }
  if (values.NODE_ENV !== "test" && values.JWT_SECRET.length < 32) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET must contain at least 32 characters outside the test environment.",
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = Object.freeze(parsed.data);
