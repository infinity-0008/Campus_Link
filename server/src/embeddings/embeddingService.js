import { env } from "../config/env.js";
import { runTask, getEmbeddingStatus, setEmbeddingStatus } from "../workers/pool.js";
import { logger } from "../utils/logger.js";

function compactText(parts) {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
}

function createProfileEmbeddingInput(profile) {
  const items = [];
  const uniqueSkills = new Set([
    ...(profile.skills ?? []),
    ...(profile.resume?.parsedSkills ?? []),
  ].map((skill) => String(skill).trim()).filter(Boolean));

  for (const skill of uniqueSkills) items.push({ kind: "skill", text: skill });
  for (const project of profile.projects ?? []) {
    const text = compactText([project.title, project.description, ...(project.techStack ?? [])]);
    if (text) items.push({ kind: "project", text });
  }
  for (const experience of profile.experience ?? []) {
    const text = compactText([experience.role, experience.company, experience.description]);
    if (text) items.push({ kind: "experience", text });
  }

  const extracted = profile.resume?.aiExtraction;
  for (const project of extracted?.projects ?? []) {
    const text = compactText([project.title, project.description, ...(project.techStack ?? [])]);
    if (text && !items.some((item) => item.kind === "project" && item.text === text)) {
      items.push({ kind: "project", text });
    }
  }
  for (const experience of extracted?.experience ?? []) {
    const text = compactText([experience.role, experience.company, experience.description]);
    if (text && !items.some((item) => item.kind === "experience" && item.text === text)) {
      items.push({ kind: "experience", text });
    }
  }

  const documentText = compactText([
    profile.resume?.parsedText,
    ...uniqueSkills,
    ...(profile.projects ?? []).flatMap((project) => [project.title, project.description, ...(project.techStack ?? [])]),
    ...(profile.experience ?? []).flatMap((experience) => [experience.role, experience.company, experience.description]),
  ]);

  return { items, documentText };
}

export async function embedStudentProfile(profile) {
  if (!env.EMBEDDINGS_ENABLED) {
    setEmbeddingStatus("fallback");
    return null;
  }

  try {
    const payload = createProfileEmbeddingInput(profile);
    if (!payload.documentText && payload.items.length === 0) return null;
    const result = await runTask("embedding", "embedProfile", payload);
    if (!Array.isArray(result.doc) || result.doc.length !== 384) {
      throw new Error("Embedding worker returned an invalid document vector.");
    }
    setEmbeddingStatus("ready");
    return result;
  } catch (error) {
    setEmbeddingStatus("fallback");
    logger.warn({ err: error }, "Profile embedding failed; saved profile will use the classical matching fallback.");
    return null;
  }
}

export function getEmbeddingServiceStatus() {
  return getEmbeddingStatus();
}
