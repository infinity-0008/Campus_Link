import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(request, response, next) {
  next(new ApiError(404, "NOT_FOUND", `Route not found: ${request.method} ${request.originalUrl}`));
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  let normalized = error;

  if (error instanceof ZodError) {
    normalized = new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", error.issues);
  } else if (error instanceof SyntaxError && Object.hasOwn(error, "body")) {
    normalized = new ApiError(400, "INVALID_JSON", "Request body contains invalid JSON.");
  } else if (error?.type === "entity.too.large") {
    normalized = new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  } else if (error?.code === 11000) {
    normalized = new ApiError(409, "DUPLICATE_RESOURCE", "A record with this value already exists.");
  } else if (error instanceof mongoose.Error.CastError) {
    normalized = new ApiError(400, "INVALID_IDENTIFIER", "A supplied identifier is invalid.");
  } else if (error instanceof mongoose.Error.ValidationError) {
    normalized = new ApiError(400, "MODEL_VALIDATION_ERROR", "The supplied data is invalid.");
  } else if (!(error instanceof ApiError)) {
    normalized = new ApiError(500, "INTERNAL_SERVER_ERROR", "An unexpected server error occurred.");
  }

  const statusCode = normalized.statusCode || 500;
  const logMethod = statusCode >= 500 ? "error" : "warn";
  logger[logMethod]({
    err: error,
    requestId: request.id,
    method: request.method,
    path: request.originalUrl,
    statusCode,
  }, normalized.message);

  const errorPayload = {
    code: normalized.code || "INTERNAL_SERVER_ERROR",
    message: normalized.message || "An unexpected server error occurred.",
  };

  if (normalized.details !== undefined) errorPayload.details = normalized.details;
  if (env.NODE_ENV !== "production" && statusCode >= 500) {
    errorPayload.debug = { name: error.name };
  }

  return response.status(statusCode).json({
    success: false,
    error: errorPayload,
  });
}
