import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { getEmbeddingStatus } from "../../workers/pool.js";

export function getHealth(request, response) {
  const dbConnected = mongoose.connection.readyState === 1;
  const productionDatabaseUnavailable = env.NODE_ENV === "production" && !dbConnected;
  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

  const details = {
    status: dbConnected ? "ok" : "degraded",
    db: dbConnected ? "connected" : "disconnected",
    embeddings: getEmbeddingStatus(),
    llm: env.AI_ENABLED && env.LLM_API_KEY && env.LLM_MODEL ? "enabled" : "disabled",
    memoryMb,
  };

  if (productionDatabaseUnavailable) {
    return response.status(503).json({
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "The API database connection is unavailable.",
        details,
      },
    });
  }

  return response.status(200).json({ success: true, data: details });
}
