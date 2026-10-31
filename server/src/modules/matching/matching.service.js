import mongoose from "mongoose";
import Job from "../../models/Job.js";
import StudentProfile from "../../models/StudentProfile.js";
import Application from "../../models/Application.js";
import { env } from "../../config/env.js";
import { USER_ROLES, JOB_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, buildPaginationMeta } from "../../utils/pagination.js";
import { logger } from "../../utils/logger.js";
import { runTask, getEmbeddingStatus } from "../../workers/pool.js";
import { evaluateEligibility } from "../eligibility/eligibility.service.js";
import { calculateMatchScores } from "./matching.scoring.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchingPayload(profile, job) {
  return {
    profile: {
      skills: profile.skills ?? [],
      projects: profile.projects ?? [],
      experience: profile.experience ?? [],
      resume: profile.resume ?? {},
      embeddings: profile.embeddings ?? null,
    },
    job: {
      requiredSkills: job.requiredSkills ?? [],
      description: job.description ?? "",
      embeddings: job.embeddings ?? null,
    },
    threshold: env.SKILL_MATCH_THRESHOLD,
    // Matching uses only stored vectors. It never asks the embedding model to
    // create vectors at request/ranking time.
    allowEmbeddings: env.EMBEDDINGS_ENABLED && getEmbeddingStatus() === "ready",
  };
}

async function scoreOne(profile, job) {
  const payload = matchingPayload(profile, job);
  try {
    return await runTask("parse", "matchScore", payload);
  } catch (error) {
    logger.warn({ err: error, jobId: String(job._id ?? "") }, "Matching worker failed; running the stored-data TF-IDF fallback.");
    return calculateMatchScores({ ...payload, allowEmbeddings: false });
  }
}


/** Reuse the exact stored-data matching path when a student submits an application. */
export async function scoreProfileAgainstJob(profile, job) {
  return scoreOne(profile, job);
}

async function scoreBatch(profiles, jobs) {
  const pairs = jobs.map((job) => matchingPayload(profiles, job));
  try {
    return await runTask("parse", "matchScoreBatch", { pairs });
  } catch (error) {
    logger.warn({ err: error, batchSize: pairs.length }, "Matching batch worker failed; using the classical scoring fallback.");
    return pairs.map((payload) => calculateMatchScores({ ...payload, allowEmbeddings: false }));
  }
}

async function getProfileWithVectors(studentId) {
  const profile = await StudentProfile.findOne({ user: studentId }).select("+embeddings").lean();
  if (!profile) {
    throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
  }
  return profile;
}

async function getJobWithVectors(jobId) {
  if (!mongoose.isValidObjectId(jobId)) {
    throw new ApiError(400, "INVALID_JOB_ID", "A valid job id is required.");
  }
  const job = await Job.findById(jobId).select("+embeddings").lean();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");
  return job;
}

async function assertCanViewPair({ job, studentId, user }) {
  if (user.role === USER_ROLES.ADMIN) return;

  if (user.role === USER_ROLES.STUDENT) {
    if (String(user._id) !== String(studentId)) {
      throw new ApiError(403, "FORBIDDEN", "Students can view matching results only for their own profile.");
    }
    if (job.status !== JOB_STATUSES.OPEN) {
      throw new ApiError(404, "JOB_NOT_FOUND", "The requested open job could not be found.");
    }
    return;
  }

  if (user.role === USER_ROLES.RECRUITER) {
    if (String(job.recruiter) !== String(user._id)) {
      throw new ApiError(403, "FORBIDDEN", "Recruiters can view matching results only for their own jobs.");
    }
    const application = await Application.exists({ job: job._id, student: studentId });
    if (!application) {
      throw new ApiError(403, "FORBIDDEN", "Recruiters can inspect only students who applied to their jobs.");
    }
    return;
  }

  throw new ApiError(403, "FORBIDDEN", "You do not have permission to view this matching result.");
}

export async function getStudentJobFit(jobId, user) {
  const [job, profile] = await Promise.all([
    getJobWithVectors(jobId),
    getProfileWithVectors(user._id),
  ]);
  if (job.status !== JOB_STATUSES.OPEN) {
    throw new ApiError(404, "JOB_NOT_FOUND", "The requested open job could not be found.");
  }
  const match = await scoreOne(profile, job);
  return {
    jobId: String(job._id),
    eligibility: evaluateEligibility({ studentProfile: profile, job }),
    matching: match,
  };
}

export async function getMatchingForPair(jobId, studentId, user) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new ApiError(400, "INVALID_STUDENT_ID", "A valid student id is required.");
  }
  const job = await getJobWithVectors(jobId);
  await assertCanViewPair({ job, studentId, user });
  const profile = await getProfileWithVectors(studentId);
  return {
    jobId: String(job._id),
    studentId: String(studentId),
    ...await scoreOne(profile, job),
  };
}

export async function getMatchingComparison(jobId, studentId, user) {
  const result = await getMatchingForPair(jobId, studentId, user);
  return {
    jobId: result.jobId,
    studentId: result.studentId,
    methods: result.comparisonDetails,
    embeddingsOnlySkills: result.embeddingsOnlySkills,
    selectedMethod: result.method,
    selectedScore: result.score,
  };
}

function buildRecommendedQuery(filters) {
  const conditions = [{ status: JOB_STATUSES.OPEN }];
  const now = new Date();
  conditions.push({ $or: [{ deadline: null }, { deadline: { $exists: false } }, { deadline: { $gt: now } }] });
  if (filters.q) {
    const expression = new RegExp(escapeRegex(filters.q), "i");
    conditions.push({ $or: [
      { title: expression }, { description: expression }, { company: expression }, { requiredSkills: expression },
    ] });
  }
  if (filters.company) conditions.push({ company: new RegExp(escapeRegex(filters.company), "i") });
  if (filters.location) conditions.push({ location: new RegExp(escapeRegex(filters.location), "i") });
  if (filters.type) conditions.push({ type: filters.type });
  return { $and: conditions };
}

function jobForRecommendation(job) {
  const { embeddings, __v, ...publicJob } = job;
  return publicJob;
}

export async function getRecommendedJobs(user, filters) {
  const profile = await getProfileWithVectors(user._id);
  const { page, limit, skip } = getPagination(filters);
  const query = buildRecommendedQuery(filters);
  const cursor = Job.find(query)
    .select("company title description location type salaryRange requiredSkills eligibility status deadline driveDate recruiter createdAt updatedAt +embeddings")
    .sort({ createdAt: -1 })
    .lean()
    .cursor({ batchSize: 25 });

  const ranked = [];
  let batch = [];
  const processBatch = async (jobs) => {
    if (jobs.length === 0) return;
    const matches = await scoreBatch(profile, jobs);
    jobs.forEach((job, index) => {
      const match = matches[index];
      ranked.push({
        job: jobForRecommendation(job),
        matchScore: match.score,
        matchMethod: match.method,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        eligibilityResult: evaluateEligibility({ studentProfile: profile, job }),
      });
    });
  };

  try {
    for await (const job of cursor) {
      batch.push(job);
      if (batch.length >= 25) {
        await processBatch(batch);
        batch = [];
      }
    }
    await processBatch(batch);
  } finally {
    await cursor.close().catch(() => undefined);
  }

  ranked.sort((left, right) => right.matchScore - left.matchScore || Number(right.eligibilityResult.eligible) - Number(left.eligibilityResult.eligible));
  const total = ranked.length;
  return {
    data: ranked.slice(skip, skip + limit),
    meta: buildPaginationMeta({ page, limit, total }),
  };
}
