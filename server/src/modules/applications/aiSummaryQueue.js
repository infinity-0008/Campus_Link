import mongoose from "mongoose";
import Application from "../../models/Application.js";
import { explainMatch } from "../../ai/tasks/explainMatch.js";
import { logger } from "../../utils/logger.js";

// This is an in-process queue for the single-process hackathon deployment.
// The application is persisted before its ID is queued, so the HTTP apply
// request never waits for the LLM. A durable queue can replace this later.
const pendingApplicationIds = [];
let draining = false;

async function processApplication(applicationId) {
  const application = await Application.findById(applicationId);
  if (!application || application.aiSummary?.generatedAt) return;

  const explanation = await explainMatch(application);
  application.aiSummary = {
    text: explanation.summary,
    gapAdvice: explanation.gapAdvice,
    model: explanation.model,
    promptVersion: explanation.promptVersion,
    fallbackUsed: explanation.fallbackUsed,
    generatedAt: new Date(),
  };
  await application.save();
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    while (pendingApplicationIds.length) {
      const applicationId = pendingApplicationIds.shift();
      try {
        await processApplication(applicationId);
      } catch (error) {
        logger.error({ err: error, applicationId }, "Background match explanation could not be saved.");
      }
    }
  } finally {
    draining = false;
    if (pendingApplicationIds.length) setImmediate(() => void drainQueue());
  }
}

export function enqueueApplicationSummary(applicationId) {
  if (!mongoose.isValidObjectId(applicationId)) return;
  pendingApplicationIds.push(String(applicationId));
  setImmediate(() => void drainQueue());
}

export function getPendingSummaryQueueSize() {
  return pendingApplicationIds.length + (draining ? 1 : 0);
}
