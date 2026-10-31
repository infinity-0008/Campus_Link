import OpenAI from "openai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

const client = env.AI_ENABLED && env.LLM_API_KEY && env.LLM_MODEL
  ? new OpenAI({
    apiKey: env.LLM_API_KEY,
    baseURL: env.LLM_BASE_URL,
    timeout: env.LLM_TIMEOUT_MS,
    maxRetries: 0, // Retries are managed below so concurrency remains predictable.
  })
  : null;

const MAX_PENDING_REQUESTS = 50;
let activeRequests = 0;
const pendingRequests = [];

function drainQueue() {
  while (activeRequests < env.LLM_MAX_CONCURRENCY && pendingRequests.length > 0) {
    const item = pendingRequests.shift();
    activeRequests += 1;
    Promise.resolve()
      .then(item.task)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeRequests -= 1;
        drainQueue();
      });
  }
}

function enqueue(task) {
  return new Promise((resolve, reject) => {
    if (pendingRequests.length >= MAX_PENDING_REQUESTS) {
      reject(new ApiError(429, "LLM_QUEUE_FULL", "AI processing is busy. Please retry shortly."));
      return;
    }
    pendingRequests.push({ task, resolve, reject });
    drainQueue();
  });
}

function isRetryable(error) {
  const status = error?.status ?? error?.response?.status;
  return status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function isLLMAvailable() {
  return Boolean(client);
}

/** OpenAI-compatible client configured for Groq through validated environment values. */
export async function requestJsonCompletion({ systemPrompt, userPrompt, temperature = 0.1 }) {
  if (!client) {
    throw new ApiError(503, "LLM_NOT_CONFIGURED", "AI extraction is unavailable; the local fallback will be used.");
  }

  return enqueue(async () => {
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        const completion = await client.chat.completions.create({
          model: env.LLM_MODEL,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        const content = completion.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("The LLM returned an empty response.");
        }
        return content;
      } catch (error) {
        if (attempt < 2 && isRetryable(error)) {
          const delayMs = 500 * (2 ** attempt);
          logger.warn({ status: error.status, attempt: attempt + 1, delayMs }, "Retrying transient LLM request failure.");
          await wait(delayMs);
          continue;
        }
        throw error;
      }
    }
    throw new Error("LLM request failed after retries.");
  });
}
