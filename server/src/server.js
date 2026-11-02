import http from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { logger } from "./utils/logger.js";
import { warmupEmbeddingPool, shutdownWorkerPools } from "./workers/pool.js";
import StudentProfile from "./models/StudentProfile.js";

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDB();
    // Backfill cgpaSemester for existing profiles if missing
    await StudentProfile.updateMany({ cgpa: { $ne: null }, cgpaSemester: null, gradYear: 2026 }, { $set: { cgpaSemester: 7 } }).catch(() => undefined);
    await StudentProfile.updateMany({ cgpa: { $ne: null }, cgpaSemester: null, gradYear: 2027 }, { $set: { cgpaSemester: 5 } }).catch(() => undefined);
    await StudentProfile.updateMany({ cgpa: { $ne: null }, cgpaSemester: null, gradYear: 2028 }, { $set: { cgpaSemester: 3 } }).catch(() => undefined);
    await StudentProfile.updateMany({ cgpa: { $ne: null }, cgpaSemester: null }, { $set: { cgpaSemester: 6 } }).catch(() => undefined);
  } catch (error) {
    logger.error({ err: error }, "MongoDB connection failed.");
    if (env.NODE_ENV === "production") {
      throw error;
    }
    logger.warn("Continuing in development mode without MongoDB. Database-backed routes will not be ready.");
  }

  // The model is downloaded during the build. Startup only loads it from server/models/;
  // a missing or incompatible local model leaves the TF-IDF/keyword fallback available.
  await warmupEmbeddingPool();
  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  logger.info({ memoryMb }, "Process memory after embedding worker initialization.");
  if (memoryMb >= 460) {
    logger.warn({ memoryMb, limitMb: 512 }, "Process is approaching the 512 MB Render memory budget. Consider EMBEDDINGS_ENABLED=false or a larger instance if this persists.");
  }

  server = http.createServer(app);
  // Render routes traffic to 0.0.0.0:$PORT. Binding explicitly avoids
  // accidentally listening only on loopback in a hosted environment.
  server.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT, environment: env.NODE_ENV }, "CampusLink API is listening.");
    logger.info({ memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024) }, "Process memory at startup.");
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started.");

  const forceExit = setTimeout(() => {
    logger.error("Graceful shutdown timed out; forcing process exit.");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await shutdownWorkerPools();
    await disconnectDB();
    clearTimeout(forceExit);
    logger.info("Graceful shutdown completed.");
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during graceful shutdown.");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection.");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception; process will exit.");
  process.exit(1);
});

startServer().catch((error) => {
  logger.fatal({ err: error }, "CampusLink API failed to start.");
  process.exit(1);
});
