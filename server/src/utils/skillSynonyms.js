/** Canonical skill names and common resume variants (80+ entries). */
export const SKILL_SYNONYMS = Object.freeze({
  "javascript": ["js", "ecmascript"],
  "typescript": ["ts"],
  "python": ["py"],
  "java": ["java se", "core java"],
  "c": ["c language"],
  "c++": ["cpp", "c plus plus"],
  "c#": ["c sharp", "csharp"],
  "go": ["golang"],
  "rust": ["rust lang"],
  "php": ["php scripting"],
  "ruby": ["ruby lang"],
  "kotlin": ["kt"],
  "swift": ["swift lang"],
  "sql": ["structured query language"],
  "html": ["html5"],
  "css": ["css3"],
  "react": ["reactjs", "react.js"],
  "next.js": ["nextjs", "next js"],
  "angular": ["angularjs", "angular.js"],
  "vue.js": ["vue", "vuejs"],
  "node.js": ["nodejs", "node js"],
  "express.js": ["express", "expressjs"],
  "spring boot": ["springboot"],
  "django": ["django framework"],
  "flask": ["flask framework"],
  "fastapi": ["fast api"],
  "tailwind css": ["tailwind", "tailwindcss"],
  "bootstrap": ["bootstrap css"],
  "redux": ["redux toolkit", "rtk"],
  "graphql": ["graph ql"],
  "rest api": ["restful api", "rest apis"],
  "mongodb": ["mongo db"],
  "mongoose": ["mongoose odm"],
  "postgresql": ["postgres", "psql"],
  "mysql": ["my sql"],
  "sqlite": ["sql lite"],
  "redis": ["redis cache"],
  "firebase": ["google firebase"],
  "supabase": ["supabase db"],
  "git": ["git version control"],
  "github": ["github actions"],
  "gitlab": ["gitlab ci"],
  "docker": ["containerization"],
  "kubernetes": ["k8s"],
  "linux": ["linux os"],
  "bash": ["shell scripting", "bash scripting"],
  "powershell": ["power shell"],
  "aws": ["amazon web services"],
  "azure": ["microsoft azure"],
  "google cloud": ["gcp", "google cloud platform"],
  "vercel": ["vercel deployment"],
  "render": ["render deployment"],
  "netlify": ["netlify deployment"],
  "machine learning": ["ml"],
  "deep learning": ["dl"],
  "artificial intelligence": ["ai"],
  "natural language processing": ["nlp"],
  "computer vision": ["cv"],
  "generative ai": ["genai", "gen ai"],
  "large language models": ["llm", "llms"],
  "retrieval augmented generation": ["rag"],
  "tensorflow": ["tf"],
  "pytorch": ["torch"],
  "scikit-learn": ["sklearn", "scikit learn"],
  "pandas": ["python pandas"],
  "numpy": ["np"],
  "matplotlib": ["pyplot"],
  "seaborn": ["sns"],
  "opencv": ["open cv"],
  "keras": ["tf keras"],
  "xgboost": ["extreme gradient boosting"],
  "random forest": ["random forests"],
  "linear regression": ["ols regression"],
  "logistic regression": ["logit regression"],
  "natural language toolkit": ["nltk"],
  "spacy": ["spa cy"],
  "transformers": ["hugging face transformers"],
  "data analysis": ["data analytics"],
  "data visualization": ["data viz"],
  "statistics": ["statistical analysis"],
  "excel": ["microsoft excel", "ms excel"],
  "power bi": ["powerbi"],
  "tableau": ["tableau desktop"],
  "figma": ["figma design"],
  "jest": ["jest testing"],
  "vitest": ["vite test"],
  "cypress": ["cypress testing"],
  "playwright": ["playwright testing"],
  "selenium": ["selenium webdriver"],
  "postman": ["postman api"],
  "junit": ["junit testing"],
  "agile": ["agile methodology"],
  "scrum": ["scrum framework"],
  "problem solving": ["analytical problem solving"],
  "data structures": ["dsa", "data structure"],
  "algorithms": ["algorithm design"],
  "object oriented programming": ["oop", "oops"],
  "operating systems": ["os concepts"],
  "computer networks": ["networking"],
  "database management systems": ["dbms"],
  "cybersecurity": ["cyber security", "information security"],
  "jwt": ["json web token", "json web tokens"],
  "oauth": ["oauth 2.0", "oauth2"],
  "web sockets": ["websocket", "websockets"],
  "message queues": ["mq", "messaging queues"],
  "microservices": ["microservice architecture"],
  "ci/cd": ["continuous integration", "continuous deployment"],
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsSkill(text, candidate) {
  const escaped = escapeRegex(candidate.toLowerCase().trim());
  if (!escaped) return false;
  const expression = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return expression.test(text);
}

export function normalizeSkill(value) {
  const normalized = String(value ?? "").toLowerCase().trim().replace(/\s+/g, " ");
  for (const [canonical, aliases] of Object.entries(SKILL_SYNONYMS)) {
    if (normalized === canonical || aliases.some((alias) => normalized === alias.toLowerCase())) {
      return canonical;
    }
  }
  return normalized;
}

export function extractSkillsFromText(text) {
  const normalizedText = String(text ?? "").toLowerCase().replace(/\s+/g, " ");
  const skills = [];
  for (const [canonical, aliases] of Object.entries(SKILL_SYNONYMS)) {
    if ([canonical, ...aliases].some((candidate) => containsSkill(normalizedText, candidate))) {
      skills.push(canonical);
    }
  }
  return skills;
}

/** Replace known aliases inside free text with their canonical skill names.
 * Longer aliases are handled first so a short alias cannot consume part of a phrase.
 */
export function canonicalizeSkillText(value) {
  let text = String(value ?? "").toLowerCase().replace(/\s+/g, " ");
  const replacements = Object.entries(SKILL_SYNONYMS)
    .flatMap(([canonical, aliases]) => aliases.map((alias) => ({ canonical, alias })))
    .sort((left, right) => right.alias.length - left.alias.length);

  for (const { canonical, alias } of replacements) {
    const escaped = escapeRegex(alias.toLowerCase().trim()).replace(/\\\s+/g, "\\s+");
    if (!escaped) continue;
    const expression = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "gi");
    text = text.replace(expression, (_match, before, after) => `${before}${canonical}${after}`);
  }

  return text.replace(/\s+/g, " ").trim();
}
