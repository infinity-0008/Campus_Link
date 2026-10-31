import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { USER_ROLES, USER_STATUSES, JOB_STATUSES, APPLICATION_STATUSES } from "../src/config/constants.js";
import {
  User,
  StudentProfile,
  RecruiterProfile,
  Job,
  Application,
  Interview,
  Notification,
  AuditLog,
} from "../src/models/index.js";
import { storeResumeBuffer } from "../src/config/gridfs.js";
import { warmupEmbeddingPool, shutdownWorkerPools } from "../src/workers/pool.js";
import { embedStudentProfile } from "../src/embeddings/embeddingService.js";
import { embedJobContent } from "../src/embeddings/jobEmbeddingService.js";
import { scoreProfileAgainstJob } from "../src/modules/matching/matching.service.js";
import { evaluateEligibility } from "../src/modules/eligibility/eligibility.service.js";
import { logger } from "../src/utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESUME_DIRECTORY = path.resolve(__dirname, "../seed/resumes");
const DEMO_PASSWORD = process.env.CAMPUSLINK_DEMO_PASSWORD || "CampusLink@Demo2026";
const PROMPT_VERSION = "1.0.0";

const addDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const subtractDays = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const recruiterSpecs = [
  { name: "Neha Kapoor", email: "recruiter.nexa@techcorp.example.com", company: "TechCorp Solutions", designation: "University Relations Lead", website: "https://example.com/techcorp", status: USER_STATUSES.ACTIVE },
  { name: "Arjun Mehta", email: "recruiter.vertex@vertexlabs.example.com", company: "Vertex Labs", designation: "Talent Acquisition Manager", website: "https://example.com/vertex", status: USER_STATUSES.ACTIVE },
  { name: "Sara Khan", email: "recruiter.orbit@orbitdata.example.com", company: "Orbit Data Systems", designation: "Campus Hiring Partner", website: "https://example.com/orbit", status: USER_STATUSES.ACTIVE },
  { name: "Pending Recruiter", email: "recruiter.pending@novasystems.example.com", company: "Nova Systems", designation: "Recruitment Coordinator", website: "https://example.com/nova", status: USER_STATUSES.PENDING },
];

const studentNames = [
  "Aanya Sharma", "Rohan Verma", "Isha Gupta", "Kabir Singh", "Meera Nair",
  "Dev Patel", "Ananya Rao", "Vivaan Joshi", "Sana Ali", "Aditya Das",
  "Priya Menon", "Arnav Khanna", "Diya Iyer", "Reyansh Sinha", "Mira Dasgupta",
  "Kunal Bhat", "Tara Kapoor", "Yash Malhotra", "Zoya Hussain", "Nikhil Reddy",
  "Riya Chawla", "Aarav Kulkarni", "Simran Gill", "Dhruv Shah", "Anvi Bose",
];

const branchCycle = ["CSE", "IT", "ECE", "MECH"];
const cgpaValues = [8.8, 7.5, 9.1, 6.8, 8.0, 7.2, 8.6, 6.4, 9.3, 7.9, 6.2, 8.4, 7.6, 9.0, 7.1, 8.2, 6.5, 9.4, 7.8, 8.7, 6.9, 7.3, 8.9, 7.7, 8.1];
const graduationYears = [2026, 2027, 2026, 2028, 2027, 2026, 2027, 2028, 2026, 2027, 2028, 2026, 2027, 2026, 2028, 2027, 2026, 2028, 2027, 2026, 2028, 2027, 2026, 2028, 2027];
const backlogValues = [0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0, 1, 0, 1, 0, 2, 0, 0, 1, 0, 1, 0, 2, 0];

const skillSets = [
  ["Python", "Machine Learning", "TensorFlow", "SQL", "JavaScript", "React"],
  ["JavaScript", "Node.js", "Express", "MongoDB", "React", "REST APIs"],
  ["Java", "Data Structures", "Algorithms", "Spring Boot", "SQL", "Docker"],
  ["Python", "C++", "IoT", "Embedded Systems", "MQTT", "Linux"],
  ["Python", "SQL", "Pandas", "Statistics", "Tableau", "Data Analysis"],
  ["HTML", "CSS", "JavaScript", "React", "Figma", "Accessibility"],
  ["Python", "Data Analysis", "Pandas", "SQL", "Git", "Machine Learning"],
  ["Java", "Spring Boot", "REST APIs", "Postman", "MySQL", "Git"],
  ["C++", "Embedded Systems", "Linux", "Computer Networks", "Python"],
  ["React", "TypeScript", "JavaScript", "CSS", "Accessibility", "Git"],
];

const resumeSpecs = new Map([
  [0, {
    filename: "student-01-aanya-sharma.pdf",
    skills: ["Python", "ML", "DL", "TensorFlow", "SQL", "JavaScript", "React"],
    projects: [
      { title: "Neural Network Classifier", description: "Built a neural network classifier for image categories using Python and TensorFlow. Prepared datasets, trained models and evaluated precision and recall.", techStack: ["Python", "TensorFlow", "Neural Networks"] },
      { title: "Placement Insights Dashboard", description: "Developed a React dashboard with REST API integration and SQL-backed analytics.", techStack: ["React", "REST APIs", "SQL"] },
    ],
    experience: [{ company: "Campus Innovation Lab", role: "Student Developer", description: "Worked on model experimentation, API integration and technical documentation.", startDate: new Date(Date.UTC(2025, 5, 1)), endDate: null }],
  }],
  [1, { filename: "student-02-rohan-verma.pdf", skills: ["JavaScript", "Node.js", "Express", "MongoDB", "React", "REST APIs", "Docker"], projects: [{ title: "Campus Marketplace", description: "Built a full-stack marketplace using React, Node.js, Express and MongoDB.", techStack: ["React", "Node.js", "MongoDB"] }] }],
  [2, { filename: "student-03-isha-gupta.pdf", skills: ["Java", "Data Structures", "Algorithms", "Spring Boot", "SQL", "Docker", "AWS"], projects: [{ title: "Library Service", description: "Created a Spring Boot REST service with SQL persistence and automated tests.", techStack: ["Java", "Spring Boot", "SQL"] }] }],
  [3, { filename: "student-04-kabir-singh.pdf", skills: ["Python", "C++", "IoT", "Embedded Systems", "MQTT", "Linux"], projects: [{ title: "Smart Greenhouse", description: "Connected environmental sensors to a microcontroller and published telemetry over MQTT.", techStack: ["C++", "IoT", "MQTT"] }] }],
  [4, {
    filename: "student-05-meera-nair.pdf",
    skills: ["Python", "SQL", "Pandas", "Statistics", "Tableau", "Excel", "Data Analysis"],
    projects: [
      { title: "Retail Demand Analysis", description: "Cleaned retail records with Pandas, queried sales data using SQL and visualized trends in Tableau.", techStack: ["Python", "Pandas", "SQL", "Tableau"] },
      { title: "Neural Network Demand Prediction", description: "Built neural networks to forecast seasonal demand from historical retail data and compared predicted patterns with observed sales.", techStack: ["Python", "Neural Networks", "Statistics"] },
    ],
    experience: [{ company: "Campus Research Group", role: "Data Analyst Volunteer", description: "Prepared reproducible notebooks and charts.", startDate: new Date(Date.UTC(2025, 5, 1)), endDate: null }],
  }],
  [5, { filename: "student-06-dev-patel.pdf", skills: ["HTML", "CSS", "JavaScript", "React", "Figma", "Accessibility", "Responsive Design"], projects: [{ title: "Accessible Student Portal", description: "Implemented responsive React views, keyboard navigation and semantic HTML.", techStack: ["React", "HTML", "CSS"] }] }],
]);

const jobSpecs = [
  {
    recruiterIndex: 0, company: "TechCorp Solutions", title: "Graduate Software Engineer",
    description: "Build and maintain web services and user-facing applications. Work with JavaScript, React, Node.js, REST APIs, MongoDB, testing and Git in a collaborative engineering team.",
    location: "Bengaluru, India", type: "full_time", requiredSkills: ["JavaScript", "React", "Node.js", "REST APIs", "MongoDB"],
    eligibility: { branches: ["CSE", "IT"], minCgpa: 6.5, gradYear: 2026, maxBacklogs: 1 }, status: JOB_STATUSES.OPEN, salaryRange: { min: 800000, max: 1200000, currency: "INR" }, deadlineDays: 30, driveDays: 45,
  },
  {
    recruiterIndex: 1, company: "Vertex Labs", title: "Data Analyst Intern",
    description: "Analyze operational datasets, write SQL queries, clean data with Python and Pandas, apply statistical methods and communicate results through Tableau dashboards.",
    location: "Pune, India", type: "internship", requiredSkills: ["Python", "SQL", "Pandas", "Statistics", "Tableau"],
    eligibility: { branches: [], minCgpa: 6.0, gradYear: 2027, maxBacklogs: 2 }, status: JOB_STATUSES.OPEN, salaryRange: { min: 20000, max: 35000, currency: "INR" }, deadlineDays: 24, driveDays: 38,
  },
  {
    recruiterIndex: 2, company: "Orbit Data Systems", title: "Frontend Developer",
    description: "Create accessible responsive web interfaces using HTML, CSS and JavaScript. Build reusable React components, translate Figma designs and integrate REST APIs.",
    location: "Hyderabad, India", type: "full_time", requiredSkills: ["HTML", "CSS", "JavaScript", "React", "Accessibility"],
    eligibility: { branches: ["CSE", "IT"], minCgpa: 6.0, gradYear: null, maxBacklogs: 2 }, status: JOB_STATUSES.OPEN, salaryRange: { min: 650000, max: 950000, currency: "INR" }, deadlineDays: 28, driveDays: 42,
  },
  {
    recruiterIndex: 0, company: "TechCorp Solutions", title: "AI / Machine Learning Intern",
    description: "Experiment with machine learning models, prepare datasets, evaluate classifiers and document model performance using Python, TensorFlow and data analysis techniques.",
    location: "Remote, India", type: "internship", requiredSkills: ["Python", "Machine Learning", "TensorFlow", "Data Analysis", "SQL"],
    eligibility: { branches: ["CSE", "IT", "ECE"], minCgpa: 7.0, gradYear: null, maxBacklogs: 0 }, status: JOB_STATUSES.OPEN, salaryRange: { min: 25000, max: 40000, currency: "INR" }, deadlineDays: 20, driveDays: 35,
  },
  {
    recruiterIndex: 1, company: "Vertex Labs", title: "Backend Developer",
    description: "Design secure backend APIs with Node.js and Express, persist application data in MongoDB, validate requests, use Git and write integration tests for REST APIs.",
    location: "Noida, India", type: "full_time", requiredSkills: ["Node.js", "Express", "MongoDB", "REST APIs", "Git"],
    eligibility: { branches: ["CSE", "IT"], minCgpa: 6.0, gradYear: null, maxBacklogs: 2 }, status: JOB_STATUSES.OPEN, salaryRange: { min: 700000, max: 1100000, currency: "INR" }, deadlineDays: 32, driveDays: 48,
  },
  {
    recruiterIndex: 2, company: "Orbit Data Systems", title: "Product Analytics Associate",
    description: "Support product decisions with SQL, spreadsheets, business analysis, KPI reporting and clear written communication.",
    location: "Mumbai, India", type: "full_time", requiredSkills: ["SQL", "Excel", "Analytics", "Communication"],
    eligibility: { branches: [], minCgpa: 6.0, gradYear: 2027, maxBacklogs: 2 }, status: JOB_STATUSES.DRAFT, salaryRange: { min: 600000, max: 850000, currency: "INR" }, deadlineDays: 50, driveDays: 65,
  },
  {
    recruiterIndex: 0, company: "TechCorp Solutions", title: "Cloud Engineering Intern",
    description: "Learn cloud infrastructure, containerization and continuous integration. Work with AWS, Docker, Linux and CI/CD pipelines under mentor guidance.",
    location: "Bengaluru, India", type: "internship", requiredSkills: ["AWS", "Docker", "Linux", "CI/CD"],
    eligibility: { branches: ["CSE", "IT", "ECE"], minCgpa: 6.5, gradYear: 2027, maxBacklogs: 1 }, status: JOB_STATUSES.DRAFT, salaryRange: { min: 22000, max: 32000, currency: "INR" }, deadlineDays: 60, driveDays: 75,
  },
  {
    recruiterIndex: 1, company: "Vertex Labs", title: "QA Automation Trainee",
    description: "Validate web applications, design test cases, test REST APIs with Postman and develop JavaScript automation scripts. This demonstration opening is closed.",
    location: "Pune, India", type: "full_time", requiredSkills: ["Manual Testing", "API Testing", "Postman", "JavaScript"],
    eligibility: { branches: [], minCgpa: 6.0, gradYear: null, maxBacklogs: 2 }, status: JOB_STATUSES.CLOSED, salaryRange: { min: 450000, max: 650000, currency: "INR" }, deadlineDays: -12, driveDays: -5,
  },
];

function buildExperience(index) {
  if (index % 3 === 1 || index % 3 === 2) {
    return [{
      company: index % 2 === 0 ? "Campus Innovation Lab" : "Student Technology Cell",
      role: index % 2 === 0 ? "Student Developer" : "Technical Project Member",
      description: "Contributed to a semester project, reviewed implementation choices and documented technical outcomes.",
      startDate: new Date(Date.UTC(2025, 5, 1)),
      endDate: null,
    }];
  }
  return [];
}

function buildProjects(name, skills, index) {
  return [{
    title: index % 2 === 0 ? `${skills[0]} Portfolio Project` : `${name.split(" ")[0]}'s Campus Project`,
    description: `Designed and implemented a practical project using ${skills.slice(0, 3).join(", ")}. Focused on clear requirements, validation and reproducible results.`,
    techStack: skills.slice(0, 3),
  }];
}

function summaryForMatch(match) {
  const matched = match.matchedSkills ?? [];
  const missing = match.missingSkills ?? [];
  const total = matched.length + missing.length;
  const text = total
    ? `The computed match score is ${match.score}/100. The saved ${match.method} evidence identifies ${matched.length} of ${total} required skills; recruiters should review the candidate's submitted profile and resume before making a decision.`
    : `The computed match score is ${match.score}/100. No required skills were configured, so the recruiter should review the stored profile and resume directly.`;
  const gapAdvice = missing.length
    ? `Potential skill gaps to review: ${missing.join(", ")}. The student can strengthen these areas with relevant projects and learning evidence.`
    : "No required-skill gaps were identified by the selected matching method.";
  return { text, gapAdvice, model: null, promptVersion: PROMPT_VERSION, fallbackUsed: true, generatedAt: new Date() };
}

async function clearDemoData() {
  await Promise.all([
    Application.deleteMany({}),
    Interview.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    Job.deleteMany({}),
    StudentProfile.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    User.deleteMany({}),
  ]);

  const db = mongoose.connection.db;
  for (const collectionName of ["resumes.files", "resumes.chunks"]) {
    const exists = await db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
    if (exists) await db.collection(collectionName).deleteMany({});
  }
}

async function createUsers(passwordHash) {
  const admin = await User.create({
    name: "CampusLink Placement Admin",
    email: "admin@campuslink.example.com",
    passwordHash,
    role: USER_ROLES.ADMIN,
    status: USER_STATUSES.ACTIVE,
  });

  const recruiters = [];
  for (const spec of recruiterSpecs) {
    const user = await User.create({
      name: spec.name,
      email: spec.email,
      passwordHash,
      role: USER_ROLES.RECRUITER,
      status: spec.status,
    });
    await RecruiterProfile.create({
      user: user._id,
      company: spec.company,
      designation: spec.designation,
      website: spec.website,
    });
    recruiters.push(user);
  }

  const students = [];
  for (let index = 0; index < studentNames.length; index += 1) {
    const name = studentNames[index];
    const user = await User.create({
      name,
      email: `student${String(index + 1).padStart(2, "0")}@campuslink.example.com`,
      passwordHash,
      role: USER_ROLES.STUDENT,
      status: USER_STATUSES.ACTIVE,
      lastLoginAt: index % 4 === 0 ? subtractDays(index + 1) : null,
    });
    students.push(user);
  }
  return { admin, recruiters, students };
}

async function createStudentProfiles(students) {
  const profiles = [];
  for (let index = 0; index < students.length; index += 1) {
    const user = students[index];
    const resumeSpec = resumeSpecs.get(index);
    const skills = resumeSpec?.skills ?? skillSets[index % skillSets.length];
    const projects = resumeSpec?.projects ?? buildProjects(user.name, skills, index);
    const experiences = resumeSpec?.experience ?? buildExperience(index);
    const profileData = {
      user: user._id,
      rollNo: `CL${String(2026 + (index % 2)).slice(-2)}${String(index + 1).padStart(4, "0")}`,
      branch: branchCycle[index % branchCycle.length],
      cgpa: cgpaValues[index],
      gradYear: graduationYears[index],
      backlogs: backlogValues[index],
      phone: null,
      skills,
      projects,
      experience: experiences,
      resume: { parseStatus: "none", parsedText: "", parsedSkills: [] },
    };

    if (resumeSpec) {
      const filePath = path.join(RESUME_DIRECTORY, resumeSpec.filename);
      const buffer = await fs.readFile(filePath);
      const fileId = await storeResumeBuffer(buffer, resumeSpec.filename, {
        userId: String(user._id),
        source: "campuslink-demo-seed",
      });
      const parsedText = resumeTextFor(resumeSpec, user.name, profileData);
      profileData.resume = {
        fileId,
        fileName: resumeSpec.filename,
        uploadedAt: new Date(),
        parsedText,
        parsedSkills: resumeSpec.skills,
        parseStatus: "ok",
        parseError: null,
        aiExtraction: {
          skills: resumeSpec.skills,
          projects: resumeSpec.projects,
          experience: experiences.map((item) => ({
            company: item.company,
            role: item.role,
            description: item.description,
            startDate: item.startDate?.toISOString() ?? null,
            endDate: item.endDate?.toISOString() ?? null,
          })),
          education: [{ degree: "B.Tech", branch: profileData.branch, gradYear: profileData.gradYear }],
          model: null,
          promptVersion: "1.0.0",
          fallbackUsed: true,
        },
      };
    }

    const profile = await StudentProfile.create(profileData);
    const embeddings = await embedStudentProfile(profile.toObject());
    if (!embeddings || embeddings.doc?.length !== 384) {
      throw new Error(`Could not compute a 384-dimensional resume/profile embedding for ${user.email}. Check the local model download.`);
    }
    profile.embeddings = embeddings;
    await profile.save();
    profiles.push(profile);
  }
  return profiles;
}

function resumeTextFor(resumeSpec, name, profile) {
  const projectLines = resumeSpec.projects.map((project) => `${project.title}: ${project.description} Technologies: ${project.techStack.join(", ")}.`).join(" ");
  const experienceLines = (profile.experience ?? []).map((item) => `${item.role} at ${item.company}. ${item.description}`).join(" ");
  return `${name}. ${profile.branch} student. CGPA ${profile.cgpa}. Graduation year ${profile.gradYear}. Skills: ${resumeSpec.skills.join(", ")}. ${projectLines} ${experienceLines}`.trim();
}

async function createJobs(recruiters) {
  const jobs = [];
  for (const spec of jobSpecs) {
    const job = await Job.create({
      recruiter: recruiters[spec.recruiterIndex]._id,
      company: spec.company,
      title: spec.title,
      description: spec.description,
      location: spec.location,
      type: spec.type,
      salaryRange: spec.salaryRange,
      requiredSkills: spec.requiredSkills,
      eligibility: spec.eligibility,
      status: spec.status,
      deadline: addDays(spec.deadlineDays),
      driveDate: addDays(spec.driveDays),
    });
    const embeddings = await embedJobContent(job.toObject());
    if (!embeddings || embeddings.doc?.length !== 384) {
      throw new Error(`Could not compute job embeddings for '${job.title}'. Check the local model download.`);
    }
    job.embeddings = embeddings;
    await job.save();
    jobs.push(job);
  }
  return jobs;
}

function makeStatusHistory(status, studentId, recruiterId, createdAt) {
  const flows = {
    [APPLICATION_STATUSES.APPLIED]: [APPLICATION_STATUSES.APPLIED],
    [APPLICATION_STATUSES.SHORTLISTED]: [APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.SHORTLISTED],
    [APPLICATION_STATUSES.INTERVIEW_SCHEDULED]: [APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.SHORTLISTED, APPLICATION_STATUSES.INTERVIEW_SCHEDULED],
    [APPLICATION_STATUSES.SELECTED]: [APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.SHORTLISTED, APPLICATION_STATUSES.INTERVIEW_SCHEDULED, APPLICATION_STATUSES.SELECTED],
    [APPLICATION_STATUSES.REJECTED]: [APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.REJECTED],
  };
  let previous = null;
  return flows[status].map((next, index) => {
    const entry = {
      from: previous,
      to: next,
      by: index === 0 ? studentId : recruiterId,
      note: index === 0 ? "Application submitted in the CampusLink demo dataset." : `Demo workflow transition to ${next}.`,
      at: new Date(createdAt.getTime() + index * 60 * 60 * 1000),
    };
    previous = next;
    return entry;
  });
}

async function createApplications(students, profiles, recruiters, jobs) {
  const openJobs = jobs.filter((job) => job.status === JOB_STATUSES.OPEN);
  const eligiblePairs = [];
  for (const job of openJobs) {
    for (let index = 0; index < profiles.length; index += 1) {
      const eligibility = evaluateEligibility({ studentProfile: profiles[index].toObject(), job: job.toObject(), now: new Date() });
      if (eligibility.eligible) eligiblePairs.push({ job, student: students[index], profile: profiles[index] });
    }
  }

  if (eligiblePairs.length < 15) {
    throw new Error(`Seed data produced only ${eligiblePairs.length} eligible student/job pairs; at least 15 are required.`);
  }

  const selectedPairs = [];
  const seen = new Set();
  // Put two differently worded AI/ML resumes against the same job first so the
  // demo can visibly compare exact keyword, synonym-aware TF-IDF and embeddings.
  for (const studentIndex of [0, 4]) {
    const pair = eligiblePairs.find((item) => (
      String(item.job._id) === String(jobs[3]._id)
      && String(item.student._id) === String(students[studentIndex]._id)
    ));
    if (!pair) throw new Error(`The semantic-matching demo student ${studentIndex + 1} is not eligible for the AI/ML demonstration job.`);
    selectedPairs.push(pair);
    seen.add(`${pair.job._id}:${pair.student._id}`);
  }
  for (const pair of eligiblePairs) {
    const key = `${pair.job._id}:${pair.student._id}`;
    if (seen.has(key)) continue;
    selectedPairs.push(pair);
    seen.add(key);
    if (selectedPairs.length === 15) break;
  }

  const statuses = [
    APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.APPLIED, APPLICATION_STATUSES.APPLIED,
    APPLICATION_STATUSES.SHORTLISTED, APPLICATION_STATUSES.SHORTLISTED, APPLICATION_STATUSES.SHORTLISTED,
    APPLICATION_STATUSES.INTERVIEW_SCHEDULED, APPLICATION_STATUSES.INTERVIEW_SCHEDULED, APPLICATION_STATUSES.INTERVIEW_SCHEDULED,
    APPLICATION_STATUSES.SELECTED, APPLICATION_STATUSES.SELECTED, APPLICATION_STATUSES.SELECTED,
    APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.REJECTED,
  ];

  const applications = [];
  for (let index = 0; index < selectedPairs.length; index += 1) {
    const pair = selectedPairs[index];
    const status = statuses[index];
    const recruiterId = pair.job.recruiter;
    const recruiter = recruiters.find((item) => String(item._id) === String(recruiterId));
    const match = await scoreProfileAgainstJob(pair.profile.toObject(), pair.job.toObject());
    const createdAt = subtractDays(15 - index);
    const application = await Application.create({
      job: pair.job._id,
      student: pair.student._id,
      status,
      matchScore: match.score,
      matchBreakdown: {
        method: match.method,
        fallbackUsed: match.fallbackUsed,
        breakdown: match.breakdown,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        skillGaps: match.skillGaps,
        comparison: match.comparison,
        comparisonDetails: match.comparisonDetails,
        embeddingsOnlySkills: match.embeddingsOnlySkills,
        summary: match.summary,
      },
      eligibilitySnapshot: { eligible: true, failures: [] },
      statusHistory: makeStatusHistory(status, pair.student._id, recruiterId, createdAt),
      resumeVersion: pair.profile.resume?.fileId ?? null,
      aiSummary: summaryForMatch(match),
      createdAt,
      updatedAt: new Date(),
    });
    applications.push({ application, student: pair.student, recruiter, job: pair.job, profile: pair.profile });
  }
  return applications;
}

async function createInterviews(applicationRecords) {
  const interviewRecords = applicationRecords.filter(({ application }) => application.status === APPLICATION_STATUSES.INTERVIEW_SCHEDULED).slice(0, 2);
  const selectedRecord = applicationRecords.find(({ application }) => application.status === APPLICATION_STATUSES.SELECTED);
  if (selectedRecord) interviewRecords.push(selectedRecord);
  const interviews = [];

  for (let index = 0; index < interviewRecords.length; index += 1) {
    const record = interviewRecords[index];
    const completed = record.application.status === APPLICATION_STATUSES.SELECTED;
    const scheduledAt = completed ? subtractDays(2) : addDays(3 + index);
    const interview = await Interview.create({
      application: record.application._id,
      job: record.job._id,
      student: record.student._id,
      recruiter: record.recruiter._id,
      scheduledAt,
      durationMins: 45,
      mode: index % 2 === 0 ? "online" : "onsite",
      location: index % 2 === 0 ? null : "CampusLink Demo Interview Room",
      link: index % 2 === 0 ? "https://example.com/campuslink-demo-interview" : null,
      status: completed ? "completed" : "scheduled",
      notes: completed ? "Demo interview marked completed." : "Demo interview scheduled; confirm details with the candidate.",
    });
    interviews.push(interview);
  }
  if (interviews.length !== 3) throw new Error(`Expected exactly 3 demo interviews, created ${interviews.length}.`);
  return interviews;
}

async function createNotificationsAndAudit({ admin, recruiters, students, jobs, applications, interviews }) {
  const notifications = [];
  for (const record of applications.slice(0, 10)) {
    notifications.push({
      user: record.recruiter._id,
      type: "NEW_APPLICATION",
      title: `New application: ${record.job.title}`,
      message: `${record.student.name} has applied for ${record.job.title} at ${record.job.company}.`,
      link: `/recruiter/jobs/${record.job._id}/applicants`,
      read: false,
    });
  }
  for (const record of applications.filter(({ application }) => application.status !== APPLICATION_STATUSES.APPLIED).slice(0, 8)) {
    notifications.push({
      user: record.student._id,
      type: "APPLICATION_STATUS_CHANGED",
      title: `Application update: ${record.job.title}`,
      message: `Your application status is ${record.application.status.replaceAll("_", " ")}.`,
      link: `/student/applications/${record.application._id}`,
      read: false,
    });
  }
  for (const interview of interviews) {
    notifications.push({
      user: interview.student,
      type: "INTERVIEW_SCHEDULED",
      title: "CampusLink interview update",
      message: `Your interview status is ${interview.status}; scheduled for ${interview.scheduledAt.toISOString()}.`,
      link: "/student/interviews",
      read: false,
    });
    notifications.push({
      user: interview.recruiter,
      type: "INTERVIEW_SCHEDULED",
      title: "Recruitment interview update",
      message: `An interview for ${interview.job} is ${interview.status}.`,
      link: "/recruiter/interviews",
      read: false,
    });
  }
  await Notification.insertMany(notifications);

  const auditEntries = [
    { actor: admin._id, actorRole: admin.role, action: "RECRUITER_APPROVED", targetType: "User", targetId: recruiters[0]._id, meta: { company: "TechCorp Solutions", demoSeed: true } },
    { actor: admin._id, actorRole: admin.role, action: "RECRUITER_APPROVED", targetType: "User", targetId: recruiters[1]._id, meta: { company: "Vertex Labs", demoSeed: true } },
    { actor: admin._id, actorRole: admin.role, action: "RECRUITER_APPROVED", targetType: "User", targetId: recruiters[2]._id, meta: { company: "Orbit Data Systems", demoSeed: true } },
    { actor: recruiters[0]._id, actorRole: USER_ROLES.RECRUITER, action: "JOB_PUBLISHED", targetType: "Job", targetId: jobs[0]._id, meta: { title: jobs[0].title, demoSeed: true } },
    { actor: recruiters[1]._id, actorRole: USER_ROLES.RECRUITER, action: "JOB_PUBLISHED", targetType: "Job", targetId: jobs[1]._id, meta: { title: jobs[1].title, demoSeed: true } },
    { actor: recruiters[2]._id, actorRole: USER_ROLES.RECRUITER, action: "JOB_PUBLISHED", targetType: "Job", targetId: jobs[2]._id, meta: { title: jobs[2].title, demoSeed: true } },
  ];
  for (const record of applications.slice(0, 12)) {
    auditEntries.push({
      actor: record.student._id,
      actorRole: USER_ROLES.STUDENT,
      action: "APPLICATION_SUBMITTED",
      targetType: "Application",
      targetId: record.application._id,
      meta: { jobId: String(record.job._id), matchScore: record.application.matchScore, demoSeed: true },
    });
  }
  for (const interview of interviews) {
    auditEntries.push({
      actor: interview.recruiter,
      actorRole: USER_ROLES.RECRUITER,
      action: interview.status === "completed" ? "INTERVIEW_COMPLETED" : "INTERVIEW_SCHEDULED",
      targetType: "Interview",
      targetId: interview._id,
      meta: { applicationId: String(interview.application), jobId: String(interview.job), demoSeed: true },
    });
  }
  await AuditLog.insertMany(auditEntries);
}

async function verifySeedCounts() {
  const [userCount, studentCount, recruiterCount, jobCount, applicationCount, interviewCount, notificationCount, auditCount] = await Promise.all([
    User.countDocuments(),
    StudentProfile.countDocuments(),
    RecruiterProfile.countDocuments(),
    Job.countDocuments(),
    Application.countDocuments(),
    Interview.countDocuments(),
    Notification.countDocuments(),
    AuditLog.countDocuments(),
  ]);
  const [adminCount, approvedRecruiterCount, pendingRecruiterCount, resumeCount] = await Promise.all([
    User.countDocuments({ role: USER_ROLES.ADMIN, status: USER_STATUSES.ACTIVE }),
    User.countDocuments({ role: USER_ROLES.RECRUITER, status: USER_STATUSES.ACTIVE }),
    User.countDocuments({ role: USER_ROLES.RECRUITER, status: USER_STATUSES.PENDING }),
    StudentProfile.countDocuments({ "resume.fileId": { $ne: null } }),
  ]);
  const expected = { userCount: 30, studentCount: 25, recruiterCount: 4, jobCount: 8, applicationCount: 15, interviewCount: 3 };
  const actual = { userCount, studentCount, recruiterCount, jobCount, applicationCount, interviewCount };
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) throw new Error(`Seed verification failed: ${key} expected ${value}, received ${actual[key]}.`);
  }
  if (adminCount !== 1 || approvedRecruiterCount !== 3 || pendingRecruiterCount !== 1 || resumeCount !== 6) {
    throw new Error(`Seed verification failed: expected 1 admin, 3 approved recruiters, 1 pending recruiter and 6 resume files; received ${adminCount}, ${approvedRecruiterCount}, ${pendingRecruiterCount}, ${resumeCount}.`);
  }
  if (notificationCount < 1 || auditCount < 1) {
    throw new Error("Seed verification failed: expected notification and audit demo records.");
  }

  const jobStatusRows = await Job.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const jobStatusMap = Object.fromEntries(jobStatusRows.map((row) => [row._id, row.count]));
  if (jobStatusMap[JOB_STATUSES.OPEN] !== 5 || jobStatusMap[JOB_STATUSES.DRAFT] !== 2 || jobStatusMap[JOB_STATUSES.CLOSED] !== 1) {
    throw new Error("Seed verification failed: expected 5 open, 2 draft and 1 closed job.");
  }

  const statusCounts = await Application.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  const requiredStatuses = Object.values(APPLICATION_STATUSES);
  const statusMap = Object.fromEntries(statusCounts.map((row) => [row._id, row.count]));
  for (const status of requiredStatuses) {
    if (statusMap[status] !== 3) {
      throw new Error(`Seed verification failed: expected 3 applications in '${status}' status, received ${statusMap[status] ?? 0}.`);
    }
  }

  // Keep the PS03 semantic-matching demonstration reproducible: Aanya's resume
  // uses the abbreviations ML/DL, while Meera's project describes neural networks.
  const [aanya, meera, semanticJob] = await Promise.all([
    User.findOne({ email: "student01@campuslink.example.com" }).lean(),
    User.findOne({ email: "student05@campuslink.example.com" }).lean(),
    Job.findOne({ title: "AI / Machine Learning Intern" }).lean(),
  ]);
  const [aanyaProfile, meeraProfile] = await Promise.all([
    StudentProfile.findOne({ user: aanya?._id }).lean(),
    StudentProfile.findOne({ user: meera?._id }).lean(),
  ]);
  if (!aanyaProfile?.resume?.parsedText?.includes("ML, DL")
    || aanyaProfile.resume.parsedText.toLowerCase().includes("machine learning")) {
    throw new Error("Seed verification failed: Aanya's demo resume must use ML/DL wording without spelling out machine learning.");
  }
  if (!meeraProfile?.resume?.parsedText?.toLowerCase().includes("built neural networks")) {
    throw new Error("Seed verification failed: Meera's demo resume must contain the differently worded neural-network project.");
  }
  const benchmarkApplications = await Application.countDocuments({
    job: semanticJob?._id,
    student: { $in: [aanya?._id, meera?._id] },
  });
  if (benchmarkApplications !== 2) {
    throw new Error("Seed verification failed: both semantic comparison students must have applied to the same AI/ML job.");
  }

  const [profileVectors, jobVectors] = await Promise.all([
    StudentProfile.find({}).select("+embeddings").lean(),
    Job.find({}).select("+embeddings").lean(),
  ]);
  if (profileVectors.length !== 25 || profileVectors.some((profile) => profile.embeddings?.doc?.length !== 384)) {
    throw new Error("Seed verification failed: all 25 student profiles must have stored 384-dimensional document vectors.");
  }
  if (jobVectors.length !== 8 || jobVectors.some((job) => job.embeddings?.doc?.length !== 384)) {
    throw new Error("Seed verification failed: all 8 jobs must have stored 384-dimensional document vectors.");
  }

  return { ...actual, adminCount, approvedRecruiterCount, pendingRecruiterCount, resumeCount, notificationCount, auditCount, statusCounts: statusMap, jobStatusCounts: jobStatusMap };
}

async function printCredentials(admin, recruiters, students) {
  console.log("\n================ CAMPUSLINK DEMO CREDENTIALS ================");
  console.log(`Shared demo password: ${DEMO_PASSWORD}`);
  console.log(`ADMIN       ${admin.email}`);
  for (const recruiter of recruiters) {
    console.log(`RECRUITER   ${recruiter.email} (${recruiter.status})`);
  }
  for (const student of students) console.log(`STUDENT     ${student.email}`);
  console.log("=============================================================\n");
  console.log("These are synthetic demo accounts. Do not reuse this password outside the local demo environment.");
}

async function main() {
  if (env.NODE_ENV === "production") {
    throw new Error("The demo seed script refuses to run with NODE_ENV=production.");
  }
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Configure server/.env before running npm run seed.");
  }
  if (!env.EMBEDDINGS_ENABLED) {
    throw new Error("EMBEDDINGS_ENABLED must be true for the Phase 9 demo seed. Download the local model first.");
  }
  if (DEMO_PASSWORD.length < 12) {
    throw new Error("CAMPUSLINK_DEMO_PASSWORD must contain at least 12 characters.");
  }

  await connectDB();
  const databaseName = String(mongoose.connection.name ?? "").toLowerCase();
  if (!databaseName.includes("campuslink") && !databaseName.includes("demo")) {
    throw new Error(`Refusing to wipe database '${mongoose.connection.name}'. Use a dedicated CampusLink or demo database name.`);
  }
  const warmup = await warmupEmbeddingPool();
  if (!warmup.ready || warmup.dimensions !== 384) {
    throw new Error("The local all-MiniLM-L6-v2 model is not ready. Run npm run download:model and retry the seed.");
  }

  console.log("Connected to database:", mongoose.connection.name);
  console.log("Clearing existing CampusLink collections and demo resume files...");
  await clearDemoData();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { admin, recruiters, students } = await createUsers(passwordHash);
  console.log("Created 1 admin, 4 recruiter accounts and 25 students.");

  const profiles = await createStudentProfiles(students);
  console.log("Created 25 student profiles with stored local embeddings and 6 GridFS PDF resumes.");

  const jobs = await createJobs(recruiters);
  console.log("Created 8 jobs with stored local embeddings (5 open, 2 draft, 1 closed).");

  const applicationRecords = await createApplications(students, profiles, recruiters, jobs);
  console.log("Created 15 applications with stored match breakdowns and template AI summaries.");

  const interviews = await createInterviews(applicationRecords);
  await createNotificationsAndAudit({ admin, recruiters, students, jobs, applications: applicationRecords, interviews });

  const counts = await verifySeedCounts();
  console.log("\nSeed verification:");
  console.table(counts);
  console.log("Application statuses:", counts.statusCounts);
  await printCredentials(admin, recruiters, students);
}

main()
  .catch((error) => {
    logger.fatal({ err: error }, "CampusLink demo seeding failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownWorkerPools().catch((error) => logger.warn({ err: error }, "Could not shut down seed worker pools cleanly."));
    await disconnectDB().catch((error) => logger.warn({ err: error }, "Could not disconnect seed database cleanly."));
  });
