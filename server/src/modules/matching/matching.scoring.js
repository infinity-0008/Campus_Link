import natural from "natural";
import { cosineSimilarity } from "../../utils/vectorMath.js";
import {
  SKILL_SYNONYMS,
  canonicalizeSkillText,
  extractSkillsFromText,
  normalizeSkill,
} from "../../utils/skillSynonyms.js";
import { getLearningResourcesForSkill } from "../../utils/learningResources.js";

const EMBEDDING_COSINE_FLOOR = 0.2;
const EMBEDDING_COSINE_CEILING = 0.8;
const tokenizer = new natural.WordTokenizer();

function clean(value) {
  return String(value ?? "").trim();
}

function joinText(parts) {
  return parts.map(clean).filter(Boolean).join(" ");
}

function projectText(project) {
  return joinText([project?.title, project?.description, ...(project?.techStack ?? [])]);
}

function experienceText(experience) {
  return joinText([experience?.role, experience?.company, experience?.description]);
}

function profileTexts(profile) {
  const projects = (profile.projects ?? []).map(projectText).filter(Boolean);
  const experiences = (profile.experience ?? []).map(experienceText).filter(Boolean);
  const skills = (profile.skills ?? []).map(clean).filter(Boolean);
  const parsedSkills = (profile.resume?.parsedSkills ?? []).map(clean).filter(Boolean);
  const resumeText = clean(profile.resume?.parsedText);
  const rawCorpus = joinText([...skills, resumeText, ...projects, ...experiences]);
  const tfidfCorpus = canonicalizeSkillText(joinText([
    ...skills,
    ...parsedSkills,
    resumeText,
    ...projects,
    ...experiences,
  ]));
  return { projects, experiences, skills, parsedSkills, resumeText, rawCorpus, tfidfCorpus };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExactPhrase(text, phrase) {
  const normalizedPhrase = clean(phrase).toLowerCase();
  if (!normalizedPhrase || !text) return false;
  const expression = normalizedPhrase.split(/\s+/u).map(escapeRegex).join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${expression}([^a-z0-9]|$)`, "i").test(text);
}

function findPhrase(text, phrases) {
  const sourceText = clean(text);
  if (!sourceText) return null;
  for (const phrase of phrases) {
    const expression = new RegExp(`(^|[^a-z0-9])${clean(phrase).toLowerCase().split(/\s+/u).map(escapeRegex).join("\\s+")}([^a-z0-9]|$)`, "i");
    const match = expression.exec(sourceText);
    if (match) return match[0].trim();
  }
  return null;
}

function evidenceForSkill(skill, sourceTexts) {
  const canonical = normalizeSkill(skill);
  const aliases = [canonical, ...(SKILL_SYNONYMS[canonical] ?? [])];
  for (const source of sourceTexts) {
    const mention = findPhrase(source.text, aliases);
    if (mention) return `${source.label}: ${mention}`.slice(0, 240);
  }
  return `Resume skill: ${skill}`.slice(0, 240);
}

function buildSkillEvidence(profile, texts) {
  const evidence = new Map();
  const add = (skill, via) => {
    const canonical = normalizeSkill(skill);
    if (canonical && !evidence.has(canonical)) evidence.set(canonical, via);
  };

  for (const skill of texts.skills) add(skill, `Profile skill: ${skill}`);
  for (const skill of texts.parsedSkills) add(skill, `Parsed resume skill: ${skill}`);

  const sources = [];
  if (texts.resumeText) sources.push({ label: "Resume", text: texts.resumeText });
  texts.projects.forEach((text, index) => sources.push({ label: `Project ${index + 1}`, text }));
  texts.experiences.forEach((text, index) => sources.push({ label: `Experience ${index + 1}`, text }));

  for (const source of sources) {
    for (const skill of extractSkillsFromText(source.text)) {
      add(skill, evidenceForSkill(skill, [source]));
    }
  }

  // Retain evidence from structured profile content even when the source has no
  // canonical alias occurrence that can be quoted directly.
  for (const project of profile.projects ?? []) {
    const text = projectText(project);
    for (const skill of extractSkillsFromText(text)) add(skill, `Project: ${clean(project.title) || text}`.slice(0, 240));
  }
  for (const experience of profile.experience ?? []) {
    const text = experienceText(experience);
    for (const skill of extractSkillsFromText(text)) add(skill, `Experience: ${clean(experience.role) || text}`.slice(0, 240));
  }

  return evidence;
}

function tfidfCosine(leftText, rightText) {
  const left = clean(leftText);
  const right = clean(rightText);
  if (!left || !right) return 0;

  const terms = [...new Set([
    ...(tokenizer.tokenize(left.toLowerCase()) ?? []),
    ...(tokenizer.tokenize(right.toLowerCase()) ?? []),
  ])];
  if (terms.length === 0) return 0;

  const tfidf = new natural.TfIdf();
  tfidf.addDocument(left);
  tfidf.addDocument(right);
  const leftVector = terms.map((term) => tfidf.tfidf(term, 0));
  const rightVector = terms.map((term) => tfidf.tfidf(term, 1));
  try {
    return Math.max(0, Math.min(1, cosineSimilarity(leftVector, rightVector)));
  } catch {
    return 0;
  }
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function asPercent(value) {
  return Math.max(0, Math.min(100, Math.round((value * 100) + 1e-8)));
}

function normalizeEmbeddingCosine(value) {
  const scaled = (value - EMBEDDING_COSINE_FLOOR) / (EMBEDDING_COSINE_CEILING - EMBEDDING_COSINE_FLOOR);
  return Math.max(0, Math.min(1, scaled));
}

function buildKeywordMethod(profile, job, texts) {
  const requiredSkills = (job.requiredSkills ?? []).map(clean).filter(Boolean);
  const corpus = texts.rawCorpus.toLowerCase();
  const matchedSkills = [];
  const missingSkills = [];

  for (const required of requiredSkills) {
    if (hasExactPhrase(corpus, required)) {
      matchedSkills.push({ required: normalizeSkill(required), via: evidenceForSkill(required, [
        { label: "Profile", text: joinText(texts.skills) },
        { label: "Resume", text: texts.resumeText },
        ...texts.projects.map((text, index) => ({ label: `Project ${index + 1}`, text })),
        ...texts.experiences.map((text, index) => ({ label: `Experience ${index + 1}`, text })),
      ]), similarity: 1 });
    } else {
      missingSkills.push(normalizeSkill(required));
    }
  }

  const coverage = requiredSkills.length ? matchedSkills.length / requiredSkills.length : 0;
  return {
    score: asPercent(coverage),
    breakdown: { skillCoverage: round(coverage), weights: { skill: 1 } },
    matchedSkills,
    missingSkills,
  };
}

function buildTfidfMethod(profile, job, texts, evidence) {
  const requiredSkills = (job.requiredSkills ?? []).map(clean).filter(Boolean);
  const normalizedRequired = requiredSkills.map(normalizeSkill);
  const matchedSkills = [];
  const missingSkills = [];

  for (let index = 0; index < requiredSkills.length; index += 1) {
    const required = requiredSkills[index];
    const canonical = normalizedRequired[index];
    const via = evidence.get(canonical);
    if (via) matchedSkills.push({ required: canonical, via, similarity: 1 });
    else missingSkills.push(canonical);
  }

  const skillCoverage = requiredSkills.length ? matchedSkills.length / requiredSkills.length : 0;
  const jobText = canonicalizeSkillText(joinText([job.description, ...requiredSkills]));
  const docSimilarity = tfidfCosine(texts.tfidfCorpus, jobText);
  const projectItems = [...texts.projects, ...texts.experiences]
    .map((text) => canonicalizeSkillText(text))
    .filter(Boolean);
  const projectSimilarities = projectItems
    .map((text) => tfidfCosine(text, canonicalizeSkillText(job.description)))
    .sort((left, right) => right - left)
    .slice(0, 3);
  const projectRelevance = mean(projectSimilarities);
  const scoreValue = (skillCoverage * 0.5) + (docSimilarity * 0.35) + (projectRelevance * 0.15);

  return {
    score: asPercent(scoreValue),
    breakdown: {
      skillCoverage: round(skillCoverage),
      docSimilarity: round(docSimilarity),
      projectRelevance: round(projectRelevance),
      weights: { skill: 0.5, doc: 0.35, project: 0.15 },
    },
    matchedSkills,
    missingSkills,
  };
}

function validVector(vector) {
  return Array.isArray(vector) && vector.length === 384 && vector.every(Number.isFinite);
}

function buildEmbeddingMethod(profile, job, texts, evidence, threshold) {
  const resumeEmbeddings = profile.embeddings;
  const jobEmbeddings = job.embeddings;
  if (!validVector(resumeEmbeddings?.doc) || !validVector(jobEmbeddings?.doc)) return null;

  const requiredSkills = (job.requiredSkills ?? []).map(clean).filter(Boolean);
  const matchedSkills = [];
  const missingSkills = [];
  const resumeItems = (resumeEmbeddings.items ?? []).filter((item) => validVector(item.vector));
  const jobSkills = jobEmbeddings.skills ?? [];

  for (const required of requiredSkills) {
    const canonical = normalizeSkill(required);
    const exactEvidence = evidence.get(canonical);
    let bestSimilarity = exactEvidence ? 1 : 0;
    let bestResumeItem = exactEvidence ?? null;
    const jobSkillVector = jobSkills.find((item) => normalizeSkill(item.text) === canonical)?.vector;

    if (validVector(jobSkillVector)) {
      for (const resumeItem of resumeItems) {
        const similarity = cosineSimilarity(jobSkillVector, resumeItem.vector);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestResumeItem = resumeItem.text;
        }
      }
    }

    if (bestSimilarity + 1e-9 >= threshold) {
      matchedSkills.push({
        required: canonical,
        via: String(bestResumeItem ?? "Semantic resume match").slice(0, 240),
        similarity: round(bestSimilarity),
      });
    } else {
      missingSkills.push(canonical);
    }
  }

  const skillCoverage = requiredSkills.length ? matchedSkills.length / requiredSkills.length : 0;
  const rawDocSimilarity = cosineSimilarity(resumeEmbeddings.doc, jobEmbeddings.doc);
  const docSimilarity = normalizeEmbeddingCosine(rawDocSimilarity);
  const projectVectors = resumeItems
    .filter((item) => item.kind === "project" || item.kind === "experience")
    .map((item) => ({ text: item.text, similarity: normalizeEmbeddingCosine(cosineSimilarity(item.vector, jobEmbeddings.doc)) }))
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);
  const projectRelevance = mean(projectVectors.map((item) => item.similarity));
  const scoreValue = (skillCoverage * 0.5) + (docSimilarity * 0.3) + (projectRelevance * 0.2);

  return {
    score: asPercent(scoreValue),
    breakdown: {
      skillCoverage: round(skillCoverage),
      docSimilarity: round(docSimilarity),
      docSimilarityRaw: round(rawDocSimilarity),
      projectRelevance: round(projectRelevance),
      weights: { skill: 0.5, doc: 0.3, project: 0.2 },
    },
    matchedSkills,
    missingSkills,
  };
}

function createSummary(result, totalRequired) {
  if (totalRequired === 0) return "No required skills were configured for this job; review the document and project relevance components.";
  const matched = result.matchedSkills.length;
  const ratio = matched / totalRequired;
  const strength = ratio >= 0.75 ? "Strong match" : ratio >= 0.4 ? "Partial match" : "Limited match";
  const missing = result.missingSkills.length
    ? ` Missing: ${result.missingSkills.join(", ")}.`
    : " No required skills are missing.";
  return `${strength}: ${matched} of ${totalRequired} required skills found.${missing}`;
}

/**
 * Pure scoring operation executed inside a Piscina parse worker.
 * It reads only persisted profile/job text and vectors; it never invokes an embedding model.
 */
export function calculateMatchScores(payload = {}) {
  const profile = payload.profile ?? {};
  const job = payload.job ?? {};
  const threshold = Number.isFinite(Number(payload.threshold)) ? Number(payload.threshold) : 0.55;
  const texts = profileTexts(profile);
  const evidence = buildSkillEvidence(profile, texts);

  const keyword = buildKeywordMethod(profile, job, texts);
  const tfidf = buildTfidfMethod(profile, job, texts, evidence);
  const embeddings = payload.allowEmbeddings === true
    ? buildEmbeddingMethod(profile, job, texts, evidence, threshold)
    : null;

  const chosen = embeddings ?? tfidf;
  const method = embeddings ? "embeddings" : "tfidf-fallback";
  const totalRequired = (job.requiredSkills ?? []).filter((skill) => clean(skill)).length;
  const missingSkills = chosen.missingSkills;

  return {
    score: chosen.score,
    method,
    fallbackUsed: !embeddings,
    breakdown: chosen.breakdown,
    matchedSkills: chosen.matchedSkills,
    missingSkills,
    skillGaps: missingSkills.map((skill) => ({
      skill,
      resources: getLearningResourcesForSkill(skill),
    })),
    comparison: {
      keyword: keyword.score,
      tfidf: tfidf.score,
      embeddings: embeddings?.score ?? null,
    },
    comparisonDetails: {
      keyword: { score: keyword.score, matchedSkills: keyword.matchedSkills, missingSkills: keyword.missingSkills },
      tfidf: { score: tfidf.score, breakdown: tfidf.breakdown, matchedSkills: tfidf.matchedSkills, missingSkills: tfidf.missingSkills },
      embeddings: embeddings
        ? { score: embeddings.score, breakdown: embeddings.breakdown, matchedSkills: embeddings.matchedSkills, missingSkills: embeddings.missingSkills }
        : null,
    },
    embeddingsOnlySkills: embeddings
      ? embeddings.matchedSkills.map((item) => item.required).filter((skill) => !tfidf.matchedSkills.some((item) => item.required === skill))
      : [],
    summary: createSummary(chosen, totalRequired),
  };
}

export default async function matchScoreWorker({ taskName, payload = {} }) {
  if (taskName === "matchScore") return calculateMatchScores(payload);
  if (taskName === "matchScoreBatch") {
    return (payload.pairs ?? []).map((pair) => calculateMatchScores(pair));
  }
  throw new Error(`Unknown matching worker task: ${taskName}`);
}
