import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { extractSkillsFromText, normalizeSkill } from "../../utils/skillSynonyms.js";
import { requestJsonCompletion, isLLMAvailable } from "../llmClient.js";
import { suggestJobSkillsSchema } from "../schemas/suggestJobSkills.js";
import { SUGGEST_JOB_SKILLS_PROMPT_VERSION, suggestJobSkillsSystemPrompt } from "../prompts/suggestJobSkills.js";

function uniqueSkills(skills) {
  return [...new Set(skills.map(normalizeSkill).map((skill) => skill.trim()).filter(Boolean))];
}

function parseJsonResponse(content) {
  const cleaned = content.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

function fallbackSkills(description, existingSkills = []) {
  return uniqueSkills([
    ...extractSkillsFromText(description),
    ...existingSkills,
  ]);
}

/** Suggest skills for recruiter review; this function never publishes or saves a job. */
export async function suggestJobSkills({ description, existingSkills = [] }) {
  const fallback = fallbackSkills(description, existingSkills);
  if (!env.AI_ENABLED || !isLLMAvailable()) {
    return {
      skills: fallback,
      model: null,
      promptVersion: SUGGEST_JOB_SKILLS_PROMPT_VERSION,
      fallbackUsed: true,
    };
  }

  try {
    const content = await requestJsonCompletion({
      systemPrompt: suggestJobSkillsSystemPrompt,
      userPrompt: `Extract relevant skills from the job description below. Return JSON only.\n\n<JOB_DESCRIPTION_DATA>\n${description}\n</JOB_DESCRIPTION_DATA>`,
      temperature: 0.1,
    });
    const validated = suggestJobSkillsSchema.parse(parseJsonResponse(content));
    return {
      skills: uniqueSkills([...validated.skills, ...fallback]),
      model: env.LLM_MODEL,
      promptVersion: SUGGEST_JOB_SKILLS_PROMPT_VERSION,
      fallbackUsed: false,
    };
  } catch (error) {
    logger.warn({ err: error }, "Job skill suggestion failed; using the local synonym fallback.");
    return {
      skills: fallback,
      model: env.LLM_MODEL || null,
      promptVersion: SUGGEST_JOB_SKILLS_PROMPT_VERSION,
      fallbackUsed: true,
    };
  }
}
