import mongoose from "mongoose";
import Application from "../../models/Application.js";
import Job from "../../models/Job.js";
import StudentProfile from "../../models/StudentProfile.js";
import User from "../../models/User.js";
import Interview from "../../models/Interview.js";
import { APPLICATION_STATUSES, APPLICATION_TRANSITIONS, USER_ROLES, USER_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, buildPaginationMeta } from "../../utils/pagination.js";
import { logger } from "../../utils/logger.js";
import { evaluateEligibility } from "../eligibility/eligibility.service.js";
import { scoreProfileAgainstJob } from "../matching/matching.service.js";
import { enqueueApplicationSummary } from "./aiSummaryQueue.js";
import { createNotification, createNotifications } from "../notifications/notifications.service.js";
import { writeAuditLog, writeAuditLogs } from "../audit/audit.service.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `INVALID_${label.toUpperCase()}_ID`, `A valid ${label} id is required.`);
  }
}

async function requireManagedJob(jobId, user) {
  assertObjectId(jobId, "job");
  const job = await Job.findById(jobId).select("recruiter title company status").lean();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");

  if (user.role === USER_ROLES.ADMIN) return job;
  if (user.role !== USER_ROLES.RECRUITER) {
    throw new ApiError(403, "FORBIDDEN", "Only the job's recruiter or a placement administrator can manage its applications.");
  }
  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, "RECRUITER_NOT_APPROVED", "Your recruiter account must be approved before managing applicants.");
  }
  if (String(job.recruiter) !== String(user._id)) {
    throw new ApiError(403, "FORBIDDEN", "Recruiters can access applicants only for their own jobs.");
  }
  return job;
}

async function writeSideEffects(tasks, context) {
  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({ err: result.reason, ...context, sideEffectIndex: index }, "An application notification or audit record could not be written.");
    }
  });
}

function buildStatusNotification(application, job, status) {
  const labels = {
    [APPLICATION_STATUSES.SHORTLISTED]: "shortlisted",
    [APPLICATION_STATUSES.INTERVIEW_SCHEDULED]: "scheduled for an interview",
    [APPLICATION_STATUSES.SELECTED]: "selected",
    [APPLICATION_STATUSES.REJECTED]: "not selected",
    [APPLICATION_STATUSES.APPLIED]: "received",
  };
  return {
    user: application.student,
    type: "APPLICATION_STATUS_CHANGED",
    title: `Application update: ${job.title}`,
    message: `Your application to ${job.company} has been ${labels[status] ?? status}.`,
    link: `/student/applications/${application._id}`,
  };
}

export async function applyToJob(jobId, user, ip = null) {
  assertObjectId(jobId, "job");
  const [job, profile] = await Promise.all([
    Job.findById(jobId).select("+embeddings").lean(),
    StudentProfile.findOne({ user: user._id }).select("+embeddings").lean(),
  ]);

  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");
  if (!profile) throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "Complete your student profile before applying.");
  if (await Application.exists({ job: job._id, student: user._id })) {
    throw new ApiError(409, "DUPLICATE_APPLICATION", "You have already applied to this job.");
  }

  // Eligibility is recalculated here; the browser's earlier fit result is never trusted.
  const eligibility = evaluateEligibility({ studentProfile: profile, job, now: new Date() });
  if (!eligibility.eligible) {
    throw new ApiError(422, "APPLICATION_INELIGIBLE", "You do not meet this job's current eligibility requirements.", {
      failures: eligibility.failures,
    });
  }

  const match = await scoreProfileAgainstJob(profile, job);
  let application;
  try {
    application = await Application.create({
      job: job._id,
      student: user._id,
      status: APPLICATION_STATUSES.APPLIED,
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
      statusHistory: [{
        from: null,
        to: APPLICATION_STATUSES.APPLIED,
        by: user._id,
        note: "Application submitted.",
        at: new Date(),
      }],
      resumeVersion: profile.resume?.fileId ?? null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "DUPLICATE_APPLICATION", "You have already applied to this job.");
    }
    throw error;
  }

  // Side effects must not delay or roll back the successfully persisted application.
  await writeSideEffects([
    createNotification({
      user: job.recruiter,
      type: "NEW_APPLICATION",
      title: `New application: ${job.title}`,
      message: `${user.name} has applied for ${job.title} at ${job.company}.`,
      link: `/recruiter/jobs/${job._id}/applicants`,
    }),
    writeAuditLog({
      actor: user._id,
      actorRole: user.role,
      action: "APPLICATION_SUBMITTED",
      targetType: "Application",
      targetId: application._id,
      meta: { jobId: String(job._id), matchScore: match.score },
      ip,
    }),
  ], { applicationId: String(application._id), jobId: String(job._id) });

  enqueueApplicationSummary(application._id);
  return {
    application,
    aiSummaryStatus: "queued",
  };
}

export async function listMyApplications(user, filters) {
  const { page, limit, skip } = getPagination(filters);
  const query = { student: user._id };
  if (filters.status) query.status = filters.status;
  const sort = filters.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
  const [applications, total] = await Promise.all([
    Application.find(query)
      .select("job status matchScore matchBreakdown eligibilitySnapshot statusHistory resumeVersion aiSummary createdAt updatedAt")
      .populate({ path: "job", select: "company title description location type status deadline driveDate" })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Application.countDocuments(query),
  ]);
  return { data: applications, meta: buildPaginationMeta({ page, limit, total }) };
}

async function buildApplicantQuery(jobId, filters) {
  const query = { job: jobId };
  if (filters.status) query.status = filters.status;
  if (filters.minScore !== undefined) query.matchScore = { $gte: filters.minScore };

  if (filters.q) {
    const expression = new RegExp(escapeRegex(filters.q), "i");
    const [users, profiles] = await Promise.all([
      User.find({ role: USER_ROLES.STUDENT, $or: [{ name: expression }, { email: expression }] }).select("_id").lean(),
      StudentProfile.find({ $or: [
        { rollNo: expression },
        { branch: expression },
        { skills: expression },
        { "resume.parsedSkills": expression },
      ] }).select("user").lean(),
    ]);
    const studentIds = [...new Set([
      ...users.map((item) => String(item._id)),
      ...profiles.map((item) => String(item.user)),
    ])];
    if (!studentIds.length) return { _id: { $exists: false } };
    query.student = { $in: studentIds };
  }
  return query;
}

async function attachCandidateDetails(applications) {
  const studentIds = [...new Set(applications.map((item) => String(item.student?._id ?? item.student)).filter(Boolean))];
  const profiles = await StudentProfile.find({ user: { $in: studentIds } })
    .select("user rollNo branch cgpa gradYear backlogs skills projects experience resume.fileName resume.uploadedAt resume.parseStatus resume.parsedSkills")
    .lean();
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));

  return applications.map((application) => {
    const account = application.student && typeof application.student === "object" ? application.student : null;
    const profile = account ? profileByUser.get(String(account._id)) : null;
    return {
      ...application,
      student: account ? {
        id: String(account._id),
        name: account.name,
        email: account.email,
        createdAt: account.createdAt,
        profile: profile ?? null,
      } : null,
    };
  });
}

export async function listApplicantsForJob(jobId, user, filters) {
  await requireManagedJob(jobId, user);
  const { page, limit, skip } = getPagination(filters);
  const query = await buildApplicantQuery(jobId, filters);
  const sort = filters.sort === "date" ? { createdAt: -1 } : { matchScore: -1, createdAt: -1 };
  const [applications, total] = await Promise.all([
    Application.find(query)
      .select("job student status matchScore matchBreakdown eligibilitySnapshot aiSummary createdAt updatedAt")
      .populate({ path: "student", select: "name email createdAt" })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Application.countDocuments(query),
  ]);
  const data = await attachCandidateDetails(applications);
  return { data, meta: buildPaginationMeta({ page, limit, total }) };
}

export async function changeApplicationStatus(applicationId, user, { status, note = "" }, ip = null) {
  assertObjectId(applicationId, "application");
  const application = await Application.findById(applicationId).lean();
  if (!application) throw new ApiError(404, "APPLICATION_NOT_FOUND", "The requested application could not be found.");
  const job = await requireManagedJob(application.job, user);

  // Interview scheduling is owned by POST /api/interviews. This prevents a
  // recruiter from setting interview_scheduled without creating a real appointment.
  if (status === APPLICATION_STATUSES.INTERVIEW_SCHEDULED && application.status === APPLICATION_STATUSES.SHORTLISTED) {
    throw new ApiError(409, "USE_INTERVIEW_SCHEDULING", "Schedule an interview through POST /api/interviews to update this application status.");
  }

  const allowed = APPLICATION_TRANSITIONS[application.status] ?? [];
  if (!allowed.includes(status)) {
    throw new ApiError(409, "INVALID_APPLICATION_STATUS_TRANSITION", `Cannot move an application from '${application.status}' to '${status}'.`, {
      currentStatus: application.status,
      requestedStatus: status,
      allowedNextStatuses: allowed,
    });
  }
  if (application.status === APPLICATION_STATUSES.INTERVIEW_SCHEDULED && status === APPLICATION_STATUSES.SHORTLISTED) {
    const [cancelledInterview, activeInterview] = await Promise.all([
      Interview.exists({ application: application._id, status: "cancelled" }),
      Interview.exists({ application: application._id, status: { $in: ["scheduled", "rescheduled"] } }),
    ]);
    if (!cancelledInterview || activeInterview) {
      throw new ApiError(409, "INTERVIEW_NOT_CANCELLED", "An application can return to shortlisted only after its active interview has been cancelled.");
    }
  }

  const changedAt = new Date();
  const updated = await Application.findOneAndUpdate(
    { _id: application._id, status: application.status },
    {
      $set: { status },
      $push: { statusHistory: { from: application.status, to: status, by: user._id, note, at: changedAt } },
    },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw new ApiError(409, "APPLICATION_STATUS_CONFLICT", "The application status changed concurrently. Refresh and try again.");
  }

  await writeSideEffects([
    createNotification(buildStatusNotification(application, job, status)),
    writeAuditLog({
      actor: user._id,
      actorRole: user.role,
      action: "APPLICATION_STATUS_CHANGED",
      targetType: "Application",
      targetId: application._id,
      meta: { jobId: String(job._id), from: application.status, to: status, note },
      ip,
    }),
  ], { applicationId: String(application._id), jobId: String(job._id) });

  return updated;
}

export async function bulkShortlistApplicants(jobId, user, { applicationIds, note = "" }, ip = null) {
  const job = await requireManagedJob(jobId, user);
  const ids = applicationIds.map(String);
  const applications = await Application.find({ job: jobId, _id: { $in: ids } }).lean();
  if (applications.length !== ids.length) {
    throw new ApiError(404, "APPLICATIONS_NOT_FOUND", "One or more selected applications do not belong to this job or no longer exist.");
  }

  const invalid = applications.filter((application) => !APPLICATION_TRANSITIONS[application.status]?.includes(APPLICATION_STATUSES.SHORTLISTED));
  if (invalid.length) {
    throw new ApiError(409, "BULK_SHORTLIST_INVALID_STATE", "All selected applications must currently be in the applied state.", {
      invalidApplications: invalid.map((item) => ({ id: String(item._id), status: item.status })),
    });
  }

  const changedAt = new Date();
  const result = await Application.bulkWrite(applications.map((application) => ({
    updateOne: {
      filter: { _id: application._id, status: application.status },
      update: {
        $set: { status: APPLICATION_STATUSES.SHORTLISTED },
        $push: { statusHistory: {
          from: application.status,
          to: APPLICATION_STATUSES.SHORTLISTED,
          by: user._id,
          note,
          at: changedAt,
        } },
      },
    },
  })));

  if (result.modifiedCount !== applications.length) {
    throw new ApiError(409, "BULK_SHORTLIST_CONFLICT", "At least one application changed concurrently. Refresh the applicant list and retry.");
  }

  await writeSideEffects([
    createNotifications(applications.map((application) => buildStatusNotification(
      application,
      job,
      APPLICATION_STATUSES.SHORTLISTED,
    ))),
    writeAuditLogs(applications.map((application) => ({
      actor: user._id,
      actorRole: user.role,
      action: "APPLICATION_STATUS_CHANGED",
      targetType: "Application",
      targetId: application._id,
      meta: { jobId: String(job._id), from: application.status, to: APPLICATION_STATUSES.SHORTLISTED, note, bulk: true },
      ip,
    }))),
  ], { jobId: String(job._id), bulkCount: applications.length });

  return {
    jobId: String(job._id),
    shortlistedCount: applications.length,
    applicationIds: ids,
  };
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  // Prevent spreadsheet formula injection in exported candidate-controlled fields.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportApplicantsCsv(jobId, user, filters) {
  const job = await requireManagedJob(jobId, user);
  const query = await buildApplicantQuery(jobId, filters);
  const applications = await Application.find(query)
    .select("student status matchScore matchBreakdown createdAt")
    .populate({ path: "student", select: "name email" })
    .sort(filters.sort === "date" ? { createdAt: -1 } : { matchScore: -1, createdAt: -1 })
    .lean();
  const enriched = await attachCandidateDetails(applications);
  const headers = ["Candidate Name", "Email", "Roll Number", "Branch", "CGPA", "Graduation Year", "Match Score", "Application Status", "Applied At", "Matched Skills", "Missing Skills"];
  const rows = enriched.map((application) => {
    const student = application.student ?? {};
    const profile = student.profile ?? {};
    const breakdown = application.matchBreakdown ?? {};
    return [
      student.name,
      student.email,
      profile.rollNo,
      profile.branch,
      profile.cgpa,
      profile.gradYear,
      application.matchScore,
      application.status,
      application.createdAt?.toISOString?.() ?? application.createdAt,
      (breakdown.matchedSkills ?? []).map((item) => item.required).join("; "),
      (breakdown.missingSkills ?? []).join("; "),
    ].map(csvCell).join(",");
  });
  return {
    fileName: `campuslink-applicants-${String(job._id)}.csv`,
    csv: [headers.map(csvCell).join(","), ...rows].join("\r\n"),
  };
}

export async function getApplicationAiSummary(applicationId, user) {
  assertObjectId(applicationId, "application");
  const application = await Application.findById(applicationId).lean();
  if (!application) throw new ApiError(404, "APPLICATION_NOT_FOUND", "The requested application could not be found.");
  await requireManagedJob(application.job, user);

  if (!application.aiSummary?.generatedAt) {
    return { available: false, status: "pending", message: "The AI-assisted summary is still being generated." };
  }
  return {
    available: true,
    status: "ready",
    text: application.aiSummary.text,
    gapAdvice: application.aiSummary.gapAdvice ?? "",
    model: application.aiSummary.model,
    promptVersion: application.aiSummary.promptVersion,
    fallbackUsed: application.aiSummary.fallbackUsed,
    generatedAt: application.aiSummary.generatedAt,
  };
}
