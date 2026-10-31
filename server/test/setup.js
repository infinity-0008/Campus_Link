// Keep the regular unit/route tests independent of a developer's real database.
// Integration tests opt into a dedicated database through CAMPUSLINK_TEST_MONGODB_URI.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ||= "campuslink-vitest-only-secret-do-not-use-outside-tests-2026";
process.env.MONGODB_URI = process.env.CAMPUSLINK_TEST_MONGODB_URI || "";
process.env.AI_ENABLED = "false";
process.env.EMBEDDINGS_ENABLED = "false";
process.env.LLM_API_KEY = "";
process.env.LLM_MODEL = "";
