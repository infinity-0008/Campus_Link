import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { chunkText } from "../utils/chunking.js";
import { averageVectors, roundVector } from "../utils/vectorMath.js";

let extractorPromise;
const MODEL_DIRECTORY = fileURLToPath(new URL("../../models/", import.meta.url));

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { env: transformersEnv, pipeline } = await import("@huggingface/transformers");
      transformersEnv.cacheDir = MODEL_DIRECTORY;
      transformersEnv.allowLocalModels = true;
      transformersEnv.allowRemoteModels = false;
      return pipeline("feature-extraction", env.EMBEDDINGS_MODEL, {
        dtype: "q8",
        cache_dir: MODEL_DIRECTORY,
        local_files_only: true,
      });
    })().catch((error) => {
      extractorPromise = undefined;
      throw error;
    });
  }
  return extractorPromise;
}

/** Embed several texts in bounded batches, averaging chunk vectors per source text. */
async function vectorsForTexts(extractor, texts) {
  const groups = texts.map((text) => chunkText(text, 200));
  const flattened = [];
  const groupIndexes = [];

  groups.forEach((chunks, groupIndex) => {
    for (const chunk of chunks) {
      flattened.push(chunk);
      groupIndexes.push(groupIndex);
    }
  });

  const vectorsByGroup = groups.map(() => []);
  for (let index = 0; index < flattened.length; index += 8) {
    const batch = flattened.slice(index, index + 8);
    const tensor = await extractor(batch, {
      pooling: "mean",
      normalize: true,
      truncation: true,
    });
    const output = tensor.tolist();

    output.forEach((vector, offset) => {
      const groupIndex = groupIndexes[index + offset];
      vectorsByGroup[groupIndex].push(vector);
    });
  }

  return vectorsByGroup.map((vectors) => {
    const averaged = averageVectors(vectors);
    if (!averaged) return null;
    if (averaged.length !== 384) {
      throw new Error(`Expected a 384-dimensional embedding, received ${averaged.length}.`);
    }
    return roundVector(averaged, 4);
  });
}

async function embedProfile(payload) {
  const extractor = await getExtractor();
  const sourceItems = (payload.items ?? []).filter((item) => typeof item.text === "string" && item.text.trim());
  const texts = [...sourceItems.map((item) => item.text), payload.documentText ?? ""];
  const vectors = await vectorsForTexts(extractor, texts);
  const doc = vectors.at(-1) ?? null;
  const items = sourceItems.flatMap((item, index) => (
    vectors[index] ? [{ kind: item.kind, text: item.text, vector: vectors[index] }] : []
  ));

  return {
    model: env.EMBEDDINGS_MODEL,
    version: "1",
    items,
    doc,
    updatedAt: new Date().toISOString(),
  };
}

export default async function embeddingWorker({ taskName, payload = {} }) {
  if (taskName === "warmup") {
    const extractor = await getExtractor();
    const vectors = await vectorsForTexts(extractor, ["CampusLink local embedding warm-up"]);
    const vector = vectors[0];
    if (!Array.isArray(vector) || vector.length !== 384) {
      throw new Error(`Embedding model returned ${vector?.length ?? 0} dimensions; expected 384.`);
    }
    return { ready: true, dimensions: vector.length, model: env.EMBEDDINGS_MODEL };
  }
  if (taskName === "embedProfile") return embedProfile(payload);
  if (taskName === "embedTexts") {
    const extractor = await getExtractor();
    return vectorsForTexts(extractor, payload.texts ?? []);
  }
  throw new Error(`Unknown embedding worker task: ${taskName}`);
}
