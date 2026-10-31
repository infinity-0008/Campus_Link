/** Split text into word-bounded chunks suitable for the MiniLM context window. */
export function chunkText(text, maxWords = 200) {
  if (typeof text !== "string" || !text.trim()) return [];
  if (!Number.isInteger(maxWords) || maxWords < 1) {
    throw new TypeError("maxWords must be a positive integer.");
  }

  const words = text.trim().split(/\s+/u);
  const chunks = [];
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(" "));
  }
  return chunks;
}
