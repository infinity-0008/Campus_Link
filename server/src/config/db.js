import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export async function connectDB() {
  if (!env.MONGODB_URI) {
    logger.warn("MONGODB_URI is not set; starting in database-disconnected development mode.");
    return null;
  }

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB connection disconnected.");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB connection re-established.");
  });

  mongoose.connection.on("error", (error) => {
    logger.error({ err: error }, "MongoDB connection error.");
  });

  const connection = await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: 10000,
  });

  logger.info(
    { database: connection.connection.name, host: connection.connection.host },
    "Connected to MongoDB.",
  );

  return connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info("MongoDB connection closed.");
  }
}
