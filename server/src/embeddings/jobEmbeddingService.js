import { env } from "../config/env.js";
import { runTask, getEmbeddingStatus, setEmbeddingStatus } from "../workers/pool.js";
import { logger } from "../utils/logger.js";

/** Compute and return job vectors at create/update/publish time, never during list reads. */
export async function embedJobContent(job) {
  if (!env.EMBEDDINGS_ENABLED || getEmbeddingStatus() !== "ready") {
    setEmbeddingStatus("fallback");
    return null;
  }

  const skills = [...new Set((job.requiredSkills ?? []).map((skill) => String(skill).trim()).filter(Boolean))];
  const description = String(job.description ?? "").trim();
  if (!description && skills.length === 0) return null;

  try {
    const vectors = await runTask("embedding", "embedTexts", {
      texts: [...skills, description],
    });
    if (!Array.isArray(vectors) || vectors.length !== skills.length + 1) {
      throw new Error("Embedding worker returned an unexpected number of job vectors.");
    }

    const skillVectors = skills.map((text, index) => ({ text, vector: vectors[index] }));
    const doc = vectors.at(-1);
    if (!Array.isArray(doc) || doc.length !== 384 || skillVectors.some((item) => !Array.isArray(item.vector) || item.vector.length !== 384)) {
      throw new Error("Embedding worker returned an invalid 384-dimensional job vector.");
    }

    setEmbeddingStatus("ready");
    return {
      model: env.EMBEDDINGS_MODEL,
      version: "1",
      skills: skillVectors,
      doc,
      updatedAt: new Date(),
    };
  } catch (error) {
    setEmbeddingStatus("fallback");
    logger.warn({ err: error, jobId: job._id?.toString() }, "Job embedding failed; Phase 5 matching will use its classical fallback.");
    return null;
  }
}
