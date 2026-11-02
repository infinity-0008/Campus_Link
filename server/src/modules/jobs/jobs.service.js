import mongoose from "mongoose";
import Job from "../../models/Job.js";
import StudentProfile from "../../models/StudentProfile.js";
import RecruiterProfile from "../../models/RecruiterProfile.js";
import { USER_ROLES, USER_STATUSES, JOB_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, buildPaginationMeta } from "../../utils/pagination.js";
import { normalizeSkill } from "../../utils/skillSynonyms.js";
import { evaluateEligibility } from "../eligibility/eligibility.service.js";
import { embedJobContent } from "../../embeddings/jobEmbeddingService.js";
import { writeAuditLog } from "../audit/audit.service.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueSkills(skills = []) {
  return [...new Set(skills.map(normalizeSkill).map((skill) => skill.trim()).filter(Boolean))];
}

function jobForResponse(job) {
  const value = job?.toObject ? job.toObject() : { ...job };
  delete value.embeddings;
  return value;
}

async function requireApprovedRecruiter(user) {
  if (user.role !== USER_ROLES.RECRUITER) return;
  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, "RECRUITER_NOT_APPROVED", "Your recruiter account must be approved by a placement administrator before managing jobs.");
  }
  const profile = await RecruiterProfile.findOne({ user: user._id }).lean();
  if (!profile) {
    throw new ApiError(404, "RECRUITER_PROFILE_NOT_FOUND", "The recruiter profile could not be found.");
  }
}

async function requireJobAccess(job, user, { allowAdmin = true } = {}) {
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");
  if (allowAdmin && user.role === USER_ROLES.ADMIN) return;
  if (user.role !== USER_ROLES.RECRUITER) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to manage this job.");
  }
  if (job.recruiter.toString() !== user._id.toString()) {
    throw new ApiError(403, "FORBIDDEN", "Recruiters can manage only their own jobs.");
  }
  await requireApprovedRecruiter(user);
}

async function refreshJobEmbeddings(job) {
  const embeddings = await embedJobContent(job);
  job.embeddings = embeddings ?? undefined;
  job.markModified("embeddings");
}

function addTextSearch(conditions, value, fields) {
  if (!value) return;
  const expression = new RegExp(escapeRegex(value), "i");
  conditions.push({ $or: fields.map((field) => ({ [field]: expression })) });
}

function studentEligibilityQuery(profile, now) {
  const branchConditions = [
    { "eligibility.branches": { $exists: false } },
    { "eligibility.branches": { $size: 0 } },
    ...(profile.branch ? [{ "eligibility.branches": new RegExp(`^${escapeRegex(profile.branch)}$`, "i") }] : []),
    ...(profile.specialization ? [{ "eligibility.branches": new RegExp(`^${escapeRegex(profile.specialization)}$`, "i") }] : []),
  ];

  const conditions = [{ $or: branchConditions }];

  if (profile.course) {
    conditions.push({
      $or: [
        { "eligibility.courses": { $exists: false } },
        { "eligibility.courses": { $size: 0 } },
        { "eligibility.courses": new RegExp(`^${escapeRegex(profile.course)}$`, "i") },
      ],
    });
  }

  if (profile.cgpa === null || profile.cgpa === undefined) {
    conditions.push({ $or: [{ "eligibility.minCgpa": null }, { "eligibility.minCgpa": { $exists: false } }] });
  } else {
    conditions.push({ $or: [{ "eligibility.minCgpa": null }, { "eligibility.minCgpa": { $lte: profile.cgpa } }] });
  }

  if (profile.gradYear === null || profile.gradYear === undefined) {
    conditions.push({ $or: [{ "eligibility.gradYear": null }, { "eligibility.gradYear": { $exists: false } }] });
  } else {
    conditions.push({ $or: [{ "eligibility.gradYear": null }, { "eligibility.gradYear": profile.gradYear }] });
  }

  conditions.push({
    $or: [
      { "eligibility.maxBacklogs": { $gte: profile.backlogs ?? 0 } },
      { "eligibility.maxBacklogs": { $exists: false } },
    ],
  });
  conditions.push({ $or: [{ deadline: null }, { deadline: { $exists: false } }, { deadline: { $gt: now } }] });
  return conditions;
}

function buildJobListConditions({ user, filters, studentProfile }) {
  const conditions = [];

  if (filters.mine === "true" && user.role !== USER_ROLES.RECRUITER) {
    throw new ApiError(400, "MINE_FILTER_RECRUITER_ONLY", "The mine=true filter is available only to recruiter accounts.");
  }

  if (user.role === USER_ROLES.STUDENT) {
    conditions.push({ status: JOB_STATUSES.OPEN });
    if (filters.status) conditions.push({ status: filters.status });
  } else if (user.role === USER_ROLES.RECRUITER) {
    if (filters.mine === "true") {
      conditions.push({ recruiter: user._id });
      if (filters.status) conditions.push({ status: filters.status });
    } else if (filters.status && filters.status !== JOB_STATUSES.OPEN) {
      conditions.push({ recruiter: user._id, status: filters.status });
    } else if (filters.status === JOB_STATUSES.OPEN) {
      conditions.push({ status: JOB_STATUSES.OPEN });
    } else {
      // Recruiters may browse open opportunities and manage every state of their own jobs.
      conditions.push({ $or: [{ status: JOB_STATUSES.OPEN }, { recruiter: user._id }] });
    }
  } else if (filters.status) {
    conditions.push({ status: filters.status });
  }

  addTextSearch(conditions, filters.q, ["title", "description", "company", "requiredSkills"]);
  // The API's `role` filter maps to the job title because the PS03 Job model has no
  // separate role field. This preserves the specified query parameter without adding a schema field.
  addTextSearch(conditions, filters.role, ["title"]);
  addTextSearch(conditions, filters.company, ["company"]);
  addTextSearch(conditions, filters.location, ["location"]);
  if (filters.type) conditions.push({ type: filters.type });

  if (filters.eligible === "true" && user.role === USER_ROLES.STUDENT) {
    conditions.push(...studentEligibilityQuery(studentProfile, new Date()));
  }

  return conditions.length ? { $and: conditions } : {};
}

function sortForJobs(sort) {
  if (sort === "deadline") return { deadline: 1, createdAt: -1 };
  if (sort === "company") return { company: 1, createdAt: -1 };
  if (sort === "title") return { title: 1, createdAt: -1 };
  return { createdAt: -1 };
}

export async function createJob(user, input, ip = null) {
  await requireApprovedRecruiter(user);
  const job = new Job({
    ...input,
    recruiter: user._id,
    requiredSkills: uniqueSkills(input.requiredSkills),
    status: JOB_STATUSES.DRAFT,
  });
  await refreshJobEmbeddings(job);
  await job.save();
  await writeAuditLog({ actor: user._id, actorRole: user.role, action: "JOB_CREATED", targetType: "Job", targetId: job._id, meta: { title: job.title, company: job.company }, ip });
  return jobForResponse(job);
}

export async function listJobs(user, filters) {
  if (filters.eligible === "true" && user.role !== USER_ROLES.STUDENT) {
    throw new ApiError(400, "ELIGIBILITY_FILTER_STUDENT_ONLY", "The eligible=true filter is available only to student accounts.");
  }

  let studentProfile = null;
  if (user.role === USER_ROLES.STUDENT) {
    studentProfile = await StudentProfile.findOne({ user: user._id }).lean();
    if (!studentProfile) {
      throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "Complete your student profile before browsing eligible jobs.");
    }
  }

  const { page, limit, skip } = getPagination(filters);
  const query = buildJobListConditions({ user, filters, studentProfile });
  const [jobs, total] = await Promise.all([
    Job.find(query)
      .select("-__v")
      .sort(sortForJobs(filters.sort))
      .skip(skip)
      .limit(limit)
      .lean(),
    Job.countDocuments(query),
  ]);

  const data = user.role === USER_ROLES.STUDENT
    ? jobs.map((job) => ({
      ...job,
      eligibilityResult: evaluateEligibility({ studentProfile, job }),
    }))
    : jobs;

  return { data, meta: buildPaginationMeta({ page, limit, total }) };
}

export async function getJobById(jobId, user) {
  let query;
  if (user.role === USER_ROLES.ADMIN) {
    query = { _id: jobId };
  } else if (user.role === USER_ROLES.RECRUITER) {
    query = { _id: jobId, $or: [{ status: JOB_STATUSES.OPEN }, { recruiter: user._id }] };
  } else {
    query = { _id: jobId, status: JOB_STATUSES.OPEN };
  }

  const job = await Job.findOne(query).lean();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");

  if (user.role === USER_ROLES.STUDENT) {
    const profile = await StudentProfile.findOne({ user: user._id }).lean();
    if (!profile) throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
    return { ...job, eligibilityResult: evaluateEligibility({ studentProfile: profile, job }) };
  }
  return job;
}

export async function getJobEligibility(jobId, user) {
  const [job, studentProfile] = await Promise.all([
    Job.findOne({ _id: jobId, status: JOB_STATUSES.OPEN }).lean(),
    StudentProfile.findOne({ user: user._id }).lean(),
  ]);
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested open job could not be found.");
  if (!studentProfile) throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
  return evaluateEligibility({ studentProfile, job });
}

export async function updateJob(jobId, user, input, ip = null) {
  const job = await Job.findById(jobId).select("+embeddings");
  await requireJobAccess(job, user);
  if (job.status === JOB_STATUSES.CLOSED && user.role !== USER_ROLES.ADMIN) {
    throw new ApiError(409, "JOB_ALREADY_CLOSED", "Recruiters cannot edit closed jobs.");
  }

  const update = { ...input };
  if (Object.hasOwn(update, "requiredSkills")) update.requiredSkills = uniqueSkills(update.requiredSkills);
  job.set(update);
  await refreshJobEmbeddings(job);
  await job.save();
  await writeAuditLog({ actor: user._id, actorRole: user.role, action: "JOB_UPDATED", targetType: "Job", targetId: job._id, meta: { changedFields: Object.keys(input) }, ip });
  return jobForResponse(job);
}

export async function publishJob(jobId, user, ip = null) {
  const job = await Job.findById(jobId).select("+embeddings");
  await requireJobAccess(job, user);
  if (job.status !== JOB_STATUSES.DRAFT) {
    throw new ApiError(409, "INVALID_JOB_STATUS_TRANSITION", "Only draft jobs can be published.");
  }
  if (job.deadline && job.deadline.getTime() <= Date.now()) {
    throw new ApiError(400, "JOB_DEADLINE_PASSED", "A job with a past application deadline cannot be published.");
  }

  await refreshJobEmbeddings(job);
  job.status = JOB_STATUSES.OPEN;
  await job.save();
  await writeAuditLog({ actor: user._id, actorRole: user.role, action: "JOB_PUBLISHED", targetType: "Job", targetId: job._id, meta: { title: job.title, company: job.company }, ip });
  return jobForResponse(job);
}

export async function closeJob(jobId, user, ip = null) {
  const job = await Job.findById(jobId);
  await requireJobAccess(job, user);
  if (job.status !== JOB_STATUSES.OPEN) {
    throw new ApiError(409, "INVALID_JOB_STATUS_TRANSITION", "Only open jobs can be closed.");
  }
  job.status = JOB_STATUSES.CLOSED;
  await job.save();
  await writeAuditLog({ actor: user._id, actorRole: user.role, action: "JOB_CLOSED", targetType: "Job", targetId: job._id, meta: { title: job.title, company: job.company }, ip });
  return jobForResponse(job);
}

export async function deleteDraftJob(jobId, user, ip = null) {
  const job = await Job.findById(jobId);
  await requireJobAccess(job, user);
  if (job.status !== JOB_STATUSES.DRAFT) {
    throw new ApiError(409, "ONLY_DRAFT_JOBS_CAN_BE_DELETED", "Only draft jobs can be deleted.");
  }
  await Job.deleteOne({ _id: job._id });
  await writeAuditLog({ actor: user._id, actorRole: user.role, action: "JOB_DELETED", targetType: "Job", targetId: job._id, meta: { title: job.title, company: job.company }, ip });
  return { id: job._id.toString(), deleted: true };
}

export async function assertCanManageJobs(user) {
  if (user.role === USER_ROLES.RECRUITER) await requireApprovedRecruiter(user);
  if (![USER_ROLES.RECRUITER, USER_ROLES.ADMIN].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to manage jobs.");
  }
}

export function isValidMongoId(value) {
  return mongoose.isValidObjectId(value);
}
