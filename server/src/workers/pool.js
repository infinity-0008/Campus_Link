import Piscina from "piscina";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const parseWorkerFile = fileURLToPath(new URL("./parseResume.js", import.meta.url));
const embeddingWorkerFile = fileURLToPath(new URL("./embedText.js", import.meta.url));

let parsePool;
let embeddingPool;
let embeddingStatus = "fallback";

function getParsePool() {
  if (!parsePool) {
    parsePool = new Piscina({
      filename: parseWorkerFile,
      minThreads: 1,
      maxThreads: env.PARSE_THREADS,
      maxQueue: "auto",
      concurrentTasksPerWorker: 1,
      idleTimeout: 30000,
    });
  }
  return parsePool;
}

function getEmbeddingPool() {
  if (!embeddingPool) {
    embeddingPool = new Piscina({
      filename: embeddingWorkerFile,
      minThreads: 1,
      maxThreads: env.EMBEDDINGS_THREADS,
      maxQueue: "auto",
      concurrentTasksPerWorker: 1,
      // Keep exactly one warm worker alive so the model is loaded once per process.
      idleTimeout: Infinity,
    });
  }
  return embeddingPool;
}

const TASK_TIMEOUTS = Object.freeze({
  parseResume: 45000,
  tfidf: 15000,
  matchScore: 15000,
  matchScoreBatch: 60000,
  warmup: 120000,
  embedProfile: 120000,
  embedTexts: 120000,
});

/** Run a pure worker task with a bounded execution time. */
export async function runTask(poolName, taskName, payload, timeoutMs = TASK_TIMEOUTS[taskName] ?? 30000) {
  const pool = poolName === "parse"
    ? getParsePool()
    : poolName === "embedding"
      ? getEmbeddingPool()
      : null;
  if (!pool) throw new TypeError(`Unknown worker pool: ${poolName}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Worker task '${taskName}' exceeded ${timeoutMs} ms.`)), timeoutMs);
  timer.unref?.();
  try {
    return await pool.run({ taskName, payload }, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Worker task '${taskName}' timed out after ${timeoutMs} ms.`);
      timeoutError.code = "WORKER_TASK_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function warmupEmbeddingPool() {
  if (!env.EMBEDDINGS_ENABLED) {
    embeddingStatus = "fallback";
    logger.info("Local embeddings are disabled; matching will use the classical fallback.");
    return { ready: false, reason: "disabled" };
  }

  try {
    const result = await runTask("embedding", "warmup", {});
    embeddingStatus = "ready";
    logger.info({ model: result.model, dimensions: result.dimensions }, "Local embedding model loaded.");
    return result;
  } catch (error) {
    embeddingStatus = "fallback";
    logger.warn({ err: error }, "Local embedding model could not be loaded; the classical fallback will be used.");
    return { ready: false, reason: "model_unavailable" };
  }
}

export function getEmbeddingStatus() {
  return embeddingStatus;
}

export function setEmbeddingStatus(status) {
  if (!["ready", "fallback"].includes(status)) throw new TypeError("Invalid embedding status.");
  embeddingStatus = status;
}

export async function shutdownWorkerPools() {
  await Promise.allSettled([
    parsePool?.destroy(),
    embeddingPool?.destroy(),
  ].filter(Boolean));
  parsePool = undefined;
  embeddingPool = undefined;
}
