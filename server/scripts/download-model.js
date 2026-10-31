import dotenv from "dotenv";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Model download is a build-time task, not an API startup task. Do not import
// the full application env validator here: the build must not need MongoDB or
// JWT secrets just to download model artifacts.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

function readBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid EMBEDDINGS_ENABLED value '${value}'. Use true or false.`);
}

const embeddingsEnabled = readBoolean(process.env.EMBEDDINGS_ENABLED, true);
const modelId = process.env.EMBEDDINGS_MODEL?.trim() || "Xenova/all-MiniLM-L6-v2";
const modelsDirectory = fileURLToPath(new URL("../models/", import.meta.url));

if (!embeddingsEnabled) {
  console.info("[CampusLink model build] EMBEDDINGS_ENABLED=false; skipping model download.");
  process.exit(0);
}

if (modelId !== "Xenova/all-MiniLM-L6-v2") {
  console.warn(`[CampusLink model build] Configured model '${modelId}'. The matching pipeline currently expects 384-dimensional all-MiniLM-L6-v2 vectors.`);
}

await mkdir(modelsDirectory, { recursive: true });
const { env: transformersEnv, pipeline } = await import("@huggingface/transformers");
transformersEnv.cacheDir = modelsDirectory;
transformersEnv.allowLocalModels = true;
transformersEnv.allowRemoteModels = true;

console.info(`[CampusLink model build] Downloading '${modelId}' into '${modelsDirectory}'.`);
const extractor = await pipeline("feature-extraction", modelId, {
  dtype: "q8",
  cache_dir: modelsDirectory,
});

try {
  const test = await extractor("CampusLink model download verification", {
    pooling: "mean",
    normalize: true,
  });
  const output = test.tolist();
  const vector = Array.isArray(output?.[0]) ? output[0] : output;
  if (!Array.isArray(vector) || vector.length !== 384) {
    throw new Error(`Expected a 384-dimensional model output, received ${vector?.length ?? 0}.`);
  }
  console.info(`[CampusLink model build] Model verified: ${vector.length} dimensions.`);
} finally {
  await extractor.dispose?.();
}
