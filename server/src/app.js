import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { globalRateLimiter } from "./middleware/rateLimiter.js";
import { ApiError } from "./utils/ApiError.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import healthRoutes from "./modules/health/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import studentRoutes from "./modules/students/students.routes.js";
import jobRoutes from "./modules/jobs/jobs.routes.js";
import matchingRoutes from "./modules/matching/matching.routes.js";
import applicationRoutes from "./modules/applications/application.routes.js";
import interviewRoutes from "./modules/interviews/interviews.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

app.disable("x-powered-by");
// Render terminates TLS at a trusted reverse proxy. Trust one hop so request IPs
// and rate-limit keys are per client rather than the shared proxy address.
if (env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(pinoHttp({
  logger,
  genReqId: (request, response) => {
    const suppliedId = request.headers["x-request-id"];
    const requestId = typeof suppliedId === "string" && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId)
      ? suppliedId
      : randomUUID();
    response.setHeader("x-request-id", requestId);
    return requestId;
  },
  redact: ["req.headers.authorization", "req.headers.cookie"],
}));

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header are server-to-server tools such as Postman.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new ApiError(403, "CORS_ORIGIN_DENIED", "Origin is not allowed by CORS."));
  },
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(mongoSanitize());
app.use(globalRateLimiter);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/matching", matchingRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
