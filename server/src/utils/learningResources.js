import { normalizeSkill } from "./skillSynonyms.js";

/** Curated, free learning material for commonly requested placement skills. */
export const LEARNING_RESOURCES = Object.freeze({
  javascript: [
    { title: "JavaScript Guide", provider: "MDN", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
    { title: "JavaScript Algorithms and Data Structures", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures-v8/" },
  ],
  typescript: [{ title: "TypeScript Handbook", provider: "TypeScript", url: "https://www.typescriptlang.org/docs/handbook/intro.html" }],
  python: [
    { title: "Python Tutorial", provider: "Python.org", url: "https://docs.python.org/3/tutorial/" },
    { title: "Python for Everybody", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/scientific-computing-with-python/" },
  ],
  java: [{ title: "Java Tutorials", provider: "Dev.java", url: "https://dev.java/learn/" }],
  "c++": [{ title: "Learn C++", provider: "LearnCpp", url: "https://www.learncpp.com/" }],
  html: [{ title: "HTML Learning Area", provider: "MDN", url: "https://developer.mozilla.org/en-US/docs/Learn/HTML" }],
  css: [{ title: "CSS Learning Area", provider: "MDN", url: "https://developer.mozilla.org/en-US/docs/Learn/CSS" }],
  react: [
    { title: "Quick Start", provider: "React", url: "https://react.dev/learn" },
    { title: "Thinking in React", provider: "React", url: "https://react.dev/learn/thinking-in-react" },
  ],
  "node.js": [{ title: "Node.js Learn", provider: "Node.js", url: "https://nodejs.org/en/learn" }],
  "express.js": [{ title: "Express Getting Started", provider: "Express", url: "https://expressjs.com/en/starter/installing.html" }],
  mongodb: [
    { title: "MongoDB University", provider: "MongoDB", url: "https://learn.mongodb.com/" },
    { title: "MongoDB Manual", provider: "MongoDB", url: "https://www.mongodb.com/docs/manual/" },
  ],
  sql: [{ title: "SQL Tutorial", provider: "SQLBolt", url: "https://sqlbolt.com/" }],
  git: [
    { title: "Pro Git Book", provider: "Git", url: "https://git-scm.com/book/en/v2" },
    { title: "GitHub Skills", provider: "GitHub", url: "https://skills.github.com/" },
  ],
  docker: [{ title: "Docker Get Started", provider: "Docker", url: "https://docs.docker.com/get-started/" }],
  kubernetes: [{ title: "Kubernetes Basics", provider: "Kubernetes", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/" }],
  "machine learning": [
    { title: "Machine Learning Crash Course", provider: "Google", url: "https://developers.google.com/machine-learning/crash-course" },
    { title: "Intro to Machine Learning", provider: "Kaggle", url: "https://www.kaggle.com/learn/intro-to-machine-learning" },
  ],
  "deep learning": [{ title: "Practical Deep Learning", provider: "fast.ai", url: "https://course.fast.ai/" }],
  "artificial intelligence": [{ title: "AI for Everyone", provider: "DeepLearning.AI", url: "https://www.deeplearning.ai/courses/ai-for-everyone/" }],
  tensorflow: [{ title: "TensorFlow Tutorials", provider: "TensorFlow", url: "https://www.tensorflow.org/tutorials" }],
  pytorch: [{ title: "Learn the Basics", provider: "PyTorch", url: "https://pytorch.org/tutorials/beginner/basics/intro.html" }],
  "scikit-learn": [{ title: "scikit-learn Tutorials", provider: "scikit-learn", url: "https://scikit-learn.org/stable/tutorial/index.html" }],
  pandas: [{ title: "10 Minutes to pandas", provider: "pandas", url: "https://pandas.pydata.org/docs/user_guide/10min.html" }],
  numpy: [{ title: "NumPy Quickstart", provider: "NumPy", url: "https://numpy.org/doc/stable/user/quickstart.html" }],
  "data structures": [{ title: "Data Structures and Algorithms", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/coding-interview-prep/" }],
  algorithms: [{ title: "Algorithms, Part I", provider: "Princeton", url: "https://algs4.cs.princeton.edu/home/" }],
  "computer networks": [{ title: "Computer Networking", provider: "Cloudflare Learning", url: "https://www.cloudflare.com/learning/network-layer/what-is-a-computer-network/" }],
  "operating systems": [{ title: "Operating Systems: Three Easy Pieces", provider: "OSTEP", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/" }],
  dbms: [{ title: "Database Systems", provider: "CMU", url: "https://15445.courses.cs.cmu.edu/" }],
  "natural language processing": [{ title: "NLP Course", provider: "Hugging Face", url: "https://huggingface.co/learn/nlp-course" }],
  "large language models": [{ title: "Hugging Face LLM Course", provider: "Hugging Face", url: "https://huggingface.co/learn/llm-course" }],
  statistics: [{ title: "OpenIntro Statistics", provider: "OpenIntro", url: "https://www.openintro.org/book/os/" }],
  "data analysis": [{ title: "Data Analysis with Python", provider: "freeCodeCamp", url: "https://www.freecodecamp.org/learn/data-analysis-with-python/" }],
  "data visualization": [{ title: "Data Visualization", provider: "Observable", url: "https://observablehq.com/learning" }],
  aws: [{ title: "AWS Skill Builder", provider: "AWS", url: "https://skillbuilder.aws/" }],
  azure: [{ title: "Azure Fundamentals", provider: "Microsoft Learn", url: "https://learn.microsoft.com/en-us/training/azure/" }],
  linux: [{ title: "Introduction to Linux", provider: "Linux Foundation", url: "https://training.linuxfoundation.org/training/introduction-to-linux/" }],
  cybersecurity: [{ title: "Introduction to Cybersecurity", provider: "Cisco Networking Academy", url: "https://www.netacad.com/courses/introduction-to-cybersecurity" }],
  "rest api": [{ title: "HTTP and API Guides", provider: "MDN", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP" }],
  "problem solving": [{ title: "Problem Solving", provider: "HackerRank", url: "https://www.hackerrank.com/domains/algorithms" }],
});

export function getLearningResourcesForSkill(skill) {
  return (LEARNING_RESOURCES[normalizeSkill(skill)] ?? []).slice(0, 2);
}
