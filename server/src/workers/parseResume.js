import { PDFParse } from "pdf-parse";
import natural from "natural";
import { extractSkillsFromText } from "../utils/skillSynonyms.js";
import { calculateMatchScores } from "./matchScore.js";

async function parsePdf(bufferLike) {
  const buffer = Buffer.from(bufferLike);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = String(result?.text ?? "").replace(/\u0000/g, " ").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) {
      const error = new Error("The PDF does not contain extractable text.");
      error.code = "RESUME_TEXT_EMPTY";
      throw error;
    }
    return { text, pages: Number(result?.total ?? result?.pages?.length ?? 0) };
  } finally {
    await parser.destroy();
  }
}

function calculateTfIdf({ documents = [], query = "" }) {
  if (!Array.isArray(documents) || documents.some((document) => typeof document !== "string")) {
    throw new TypeError("documents must be an array of strings.");
  }
  const tfidf = new natural.TfIdf();
  documents.forEach((document) => tfidf.addDocument(document));
  const queryTerms = [...new Set(String(query).toLowerCase().match(/[a-z0-9+#.]+/g) ?? [])];
  return documents.map((_document, index) => {
    let score = 0;
    for (const term of queryTerms) score += tfidf.tfidf(term, index);
    return { index, score };
  });
}

export default async function parseWorker({ taskName, payload = {} }) {
  if (taskName === "parseResume") return parsePdf(payload.buffer);
  if (taskName === "tfidf") return calculateTfIdf(payload);
  if (taskName === "extractSkills") return extractSkillsFromText(payload.text ?? "");
  if (taskName === "matchScore") return calculateMatchScores(payload);
  if (taskName === "matchScoreBatch") return (payload.pairs ?? []).map((pair) => calculateMatchScores(pair));
  throw new Error(`Unknown parse worker task: ${taskName}`);
}
