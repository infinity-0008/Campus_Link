// Pure score calculation shared by the Piscina parse worker and focused unit tests.
// It never accesses MongoDB or invokes an embedding/LLM model.
export { calculateMatchScores } from "../modules/matching/matching.scoring.js";
export { default } from "../modules/matching/matching.scoring.js";
