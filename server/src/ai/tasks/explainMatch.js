import { env } from "../../config/env.js";
import { sanitizeResumeText } from "../sanitize.js";
import { logger } from "../../utils/logger.js";
import { requestJsonCompletion, isLLMAvailable } from "../llmClient.js";
import { explainMatchSchema } from "../schemas/explainMatch.js";
import { EXPLAIN_MATCH_PROMPT_VERSION, explainMatchSystemPrompt } from "../prompts/explainMatch.js";

function fallbackExplanation(facts = {}) {
  const score = Number.isFinite(Number(facts.score)) ? Math.round(Number(facts.score)) : 0;
  const matched = Array.isArray(facts.matchedSkills) ? facts.matchedSkills : [];
  const missing = Array.isArray(facts.missingSkills) ? facts.missingSkills : [];
  const total = matched.length + missing.length;
  const summary = total > 0
    ? `The computed match score is ${score}/100. The stored matching evidence identifies ${matched.length} of ${total} required skills; this score is an aid for review, not a hiring decision.`
    : `The computed match score is ${score}/100. No required skills were configured, so review the saved matching breakdown and candidate materials directly.`;
  const gapAdvice = missing.length
    ? `Potential skill gaps to review: ${missing.join(", ")}. The candidate can strengthen their profile with relevant projects or learning evidence for these areas.`
    : "No required-skill gaps were identified by the selected matching method. The recruiter should still review the candidate's submitted profile and resume.";
  return { summary, gapAdvice };
}

function factsOnly(application) {
  const breakdown = application.matchBreakdown ?? {};
  return {
    score: application.matchScore,
    method: breakdown.method ?? null,
    breakdown: breakdown.breakdown ?? {},
    comparison: breakdown.comparison ?? {},
    matchedSkills: (breakdown.matchedSkills ?? []).map((item) => ({
      required: sanitizeResumeText(item.required),
      via: sanitizeResumeText(item.via),
      similarity: item.similarity,
    })),
    missingSkills: (breakdown.missingSkills ?? []).map(sanitizeResumeText),
  };
}

export async function explainMatch(application) {
  const facts = factsOnly(application);
  const fallback = fallbackExplanation(facts);

  if (!env.AI_ENABLED || !isLLMAvailable()) {
    return {
      ...fallback,
      model: null,
      promptVersion: EXPLAIN_MATCH_PROMPT_VERSION,
      fallbackUsed: true,
    };
  }

  try {
    const content = await requestJsonCompletion({
      systemPrompt: explainMatchSystemPrompt,
      userPrompt: `Explain only these computed matching facts. Return JSON only.\n\n<COMPUTED_MATCH_FACTS>\n${JSON.stringify(facts)}\n</COMPUTED_MATCH_FACTS>`,
      temperature: 0.1,
    });
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const validated = explainMatchSchema.parse(JSON.parse(cleaned));
    return {
      ...validated,
      model: env.LLM_MODEL,
      promptVersion: EXPLAIN_MATCH_PROMPT_VERSION,
      fallbackUsed: false,
    };
  } catch (error) {
    logger.warn({ err: error }, "Match explanation failed; storing the deterministic template fallback.");
    return {
      ...fallback,
      model: env.LLM_MODEL || null,
      promptVersion: EXPLAIN_MATCH_PROMPT_VERSION,
      fallbackUsed: true,
    };
  }
}
