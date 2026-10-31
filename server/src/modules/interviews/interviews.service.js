import mongoose from "mongoose";
import Application from "../../models/Application.js";
import Interview from "../../models/Interview.js";
import Job from "../../models/Job.js";
import { APPLICATION_STATUSES, USER_ROLES, USER_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, buildPaginationMeta } from "../../utils/pagination.js";
import { logger } from "../../utils/logger.js";
import { createNotifications } from "../notifications/notifications.service.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { ACTIVE_INTERVIEW_STATUSES, intervalsOverlap } from "./interviews.rules.js";

const MAX_DURATION_MINS = 1440;

function assertObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `INVALID_${label.toUpperCase()}_ID`, `A valid ${label} id is required.`);
  }
}

function buildInterviewNotifications(interview, job, type, actorName = "The recruitment team") {
  const dateLabel = new Date(interview.scheduledAt).toISOString();
  const messages = {
    INTERVIEW_SCHEDULED: `${actorName} scheduled your interview for ${job.title} at ${dateLabel}.`,
    INTERVIEW_RESCHEDULED: `Your interview for ${job.title} has been rescheduled to ${dateLabel}.`,
    INTERVIEW_CANCELLED: `Your interview for ${job.title} has been cancelled.`,
    INTERVIEW_COMPLETED: `Your interview for ${job.title} has been marked completed.`,
  };
  const titles = {
    INTERVIEW_SCHEDULED: `Interview scheduled: ${job.title}`,
    INTERVIEW_RESCHEDULED: `Interview rescheduled: ${job.title}`,
    INTERVIEW_CANCELLED: `Interview cancelled: ${job.title}`,
    INTERVIEW_COMPLETED: `Interview completed: ${job.title}`,
  };
  const studentMessage = messages[type];
  const recruiterMessage = type === "INTERVIEW_SCHEDULED"
    ? `An interview with the applicant has been scheduled for ${dateLabel}.`
    : type === "INTERVIEW_RESCHEDULED"
      ? `An interview for ${job.title} has been rescheduled to ${dateLabel}.`
      : type === "INTERVIEW_CANCELLED"
        ? `An interview for ${job.title} has been cancelled.`
        : `An interview for ${job.title} has been marked completed.`;

  return [
    {
      user: interview.student,
      type,
      title: titles[type],
      message: studentMessage,
      link: `/student/interviews`,
    },
    {
      user: interview.recruiter,
      type,
      title: titles[type],
      message: recruiterMessage,
      link: `/recruiter/interviews`,
    },
  ];
}

async function writeSideEffects(tasks, context) {
  const results = await Promise.allSettled(tasks);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({ err: result.reason, ...context, sideEffectIndex: index }, "An interview notification or audit record could not be written.");
    }
  });
}

async function requireManagedJob(jobId, user, session) {
  const query = Job.findById(jobId).select("recruiter title company status");
  if (session) query.session(session);
  const job = await query.lean();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");

  if (user.role === USER_ROLES.ADMIN) return job;
  if (user.role !== USER_ROLES.RECRUITER) {
    throw new ApiError(403, "FORBIDDEN", "Only the job's recruiter or a placement administrator can manage interviews.");
  }
  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, "RECRUITER_NOT_APPROVED", "Your recruiter account must be approved before managing interviews.");
  }
  if (String(job.recruiter) !== String(user._id)) {
    throw new ApiError(403, "FORBIDDEN", "Recruiters can manage interviews only for their own jobs.");
  }
  return job;
}

async function assertNoRecruiterConflict({ recruiterId, scheduledAt, durationMins, excludeInterviewId = null, session }) {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMins * 60_000);
  // Model limits interview duration to 24 hours, so an interview starting earlier
  // than this lower bound cannot overlap the proposed interval.
  const earliestPossibleStart = new Date(start.getTime() - MAX_DURATION_MINS * 60_000);
  const query = {
    recruiter: recruiterId,
    status: { $in: ACTIVE_INTERVIEW_STATUSES },
    scheduledAt: { $gte: earliestPossibleStart, $lt: end },
  };
  if (excludeInterviewId) query._id = { $ne: excludeInterviewId };

  const find = Interview.find(query).select("scheduledAt durationMins job student");
  if (session) find.session(session);
  const possibleConflicts = await find.lean();
  const conflict = possibleConflicts.find((item) => intervalsOverlap(
    start,
    durationMins,
    item.scheduledAt,
    item.durationMins,
  ));

  if (conflict) {
    throw new ApiError(409, "RECRUITER_INTERVIEW_CONFLICT", "The recruiter already has another interview during this time. Choose a different time slot.", {
      conflictingInterviewId: String(conflict._id),
    });
  }
}

export async function scheduleInterview(user, input, ip = null) {
  assertObjectId(input.applicationId, "application");
  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt.getTime() <= Date.now()) {
    throw new ApiError(400, "INTERVIEW_TIME_IN_PAST", "Interview must be scheduled in the future.");
  }

  const session = await mongoose.startSession();
  let interview;
  let job;
  try {
    await session.withTransaction(async () => {
      const application = await Application.findById(input.applicationId).session(session).lean();
      if (!application) throw new ApiError(404, "APPLICATION_NOT_FOUND", "The requested application could not be found.");

      job = await requireManagedJob(application.job, user, session);
      if (application.status !== APPLICATION_STATUSES.SHORTLISTED) {
        throw new ApiError(409, "APPLICATION_NOT_SHORTLISTED", "Only shortlisted applications can be scheduled for an interview.", {
          currentStatus: application.status,
        });
      }

      const activeInterview = await Interview.findOne({
        application: application._id,
        status: { $in: ACTIVE_INTERVIEW_STATUSES },
      }).session(session).lean();
      if (activeInterview) {
        throw new ApiError(409, "ACTIVE_INTERVIEW_EXISTS", "This application already has an active interview. Reschedule or cancel it instead.");
      }

      await assertNoRecruiterConflict({
        recruiterId: job.recruiter,
        scheduledAt,
        durationMins: input.durationMins,
        session,
      });

      const updatedApplication = await Application.findOneAndUpdate(
        { _id: application._id, status: APPLICATION_STATUSES.SHORTLISTED },
        {
          $set: { status: APPLICATION_STATUSES.INTERVIEW_SCHEDULED },
          $push: { statusHistory: {
            from: APPLICATION_STATUSES.SHORTLISTED,
            to: APPLICATION_STATUSES.INTERVIEW_SCHEDULED,
            by: user._id,
            note: "Interview scheduled.",
            at: new Date(),
          } },
        },
        { new: true, runValidators: true, session },
      );
      if (!updatedApplication) {
        throw new ApiError(409, "APPLICATION_STATUS_CONFLICT", "The application changed while the interview was being scheduled. Refresh and try again.");
      }

      const created = await Interview.create([{
        application: application._id,
        job: job._id,
        student: application.student,
        recruiter: job.recruiter,
        scheduledAt,
        durationMins: input.durationMins,
        mode: input.mode,
        location: input.location ?? null,
        link: input.link ?? null,
        status: "scheduled",
        notes: input.notes ?? "",
      }], { session });
      interview = created[0].toObject();
    });
  } finally {
    await session.endSession();
  }

  await writeSideEffects([
    createNotifications(buildInterviewNotifications(interview, job, "INTERVIEW_SCHEDULED", user.name)),
    writeAuditLog({
      actor: user._id,
      actorRole: user.role,
      action: "INTERVIEW_SCHEDULED",
      targetType: "Interview",
      targetId: interview._id,
      meta: { applicationId: String(interview.application), jobId: String(job._id), scheduledAt: interview.scheduledAt, durationMins: interview.durationMins },
      ip,
    }),
  ], { interviewId: String(interview._id) });

  return interview;
}

async function getScopedInterviewQuery(user) {
  if (user.role === USER_ROLES.ADMIN) return {};
  if (user.role === USER_ROLES.STUDENT) return { student: user._id };
  if (user.role === USER_ROLES.RECRUITER) {
    if (user.status !== USER_STATUSES.ACTIVE) {
      throw new ApiError(403, "RECRUITER_NOT_APPROVED", "Your recruiter account must be approved before accessing interview management.");
    }
    return { recruiter: user._id };
  }
  throw new ApiError(403, "FORBIDDEN", "You do not have permission to access interviews.");
}

async function listInterviews(user, filters, requireRange = false) {
  const scoped = await getScopedInterviewQuery(user);
  const query = { ...scoped };
  if (filters.from && filters.to) query.scheduledAt = { $gte: new Date(filters.from), $lt: new Date(filters.to) };
  else if (requireRange) throw new ApiError(400, "CALENDAR_RANGE_REQUIRED", "Provide both from and to date-times.");
  if (filters.status) query.status = filters.status;

  const { page, limit, skip } = getPagination(filters);
  const [data, total] = await Promise.all([
    Interview.find(query)
      .populate({ path: "job", select: "title company location type" })
      .populate({ path: "student", select: "name email" })
      .populate({ path: "recruiter", select: "name email" })
      .sort({ scheduledAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Interview.countDocuments(query),
  ]);
  return { data, meta: buildPaginationMeta({ page, limit, total }) };
}

export async function listMyInterviews(user, filters) {
  return listInterviews(user, filters, false);
}

export async function listInterviewCalendar(user, filters) {
  return listInterviews(user, filters, true);
}

export async function updateInterview(interviewId, user, input, ip = null) {
  assertObjectId(interviewId, "interview");
  const session = await mongoose.startSession();
  let updatedInterview;
  let job;
  let application;
  let eventType;
  try {
    await session.withTransaction(async () => {
      const interview = await Interview.findById(interviewId).session(session).lean();
      if (!interview) throw new ApiError(404, "INTERVIEW_NOT_FOUND", "The requested interview could not be found.");

      if (user.role !== USER_ROLES.ADMIN) {
        if (user.role !== USER_ROLES.RECRUITER || user.status !== USER_STATUSES.ACTIVE || String(interview.recruiter) !== String(user._id)) {
          throw new ApiError(403, "FORBIDDEN", "You can manage only interviews for your own jobs.");
        }
      }
      job = await Job.findById(interview.job).select("title company recruiter").session(session).lean();
      application = await Application.findById(interview.application).session(session).lean();
      if (!job || !application) throw new ApiError(404, "INTERVIEW_LINKED_RECORD_NOT_FOUND", "The interview's job or application could not be found.");

      if (!ACTIVE_INTERVIEW_STATUSES.includes(interview.status)) {
        throw new ApiError(409, "INTERVIEW_NOT_ACTIVE", `A ${interview.status} interview cannot be ${input.action}d.`);
      }

      if (input.action === "reschedule") {
        const scheduledAt = new Date(input.scheduledAt);
        const duration = input.durationMins ?? interview.durationMins;
        const nextMode = input.mode ?? interview.mode;
        const nextLocation = input.location !== undefined ? input.location : interview.location;
        const nextLink = input.link !== undefined ? input.link : interview.link;
        if (scheduledAt.getTime() <= Date.now()) {
          throw new ApiError(400, "INTERVIEW_TIME_IN_PAST", "Interview must be rescheduled into the future.");
        }
        if (nextMode === "online" && !nextLink) {
          throw new ApiError(400, "INTERVIEW_LINK_REQUIRED", "A meeting link is required for online interviews.");
        }
        if (nextMode === "onsite" && !nextLocation) {
          throw new ApiError(400, "INTERVIEW_LOCATION_REQUIRED", "A location is required for onsite interviews.");
        }
        await assertNoRecruiterConflict({
          recruiterId: interview.recruiter,
          scheduledAt,
          durationMins: duration,
          excludeInterviewId: interview._id,
          session,
        });

        updatedInterview = await Interview.findOneAndUpdate(
          { _id: interview._id, status: interview.status },
          { $set: {
            scheduledAt,
            durationMins: duration,
            mode: nextMode,
            location: nextMode === "onsite" ? nextLocation : null,
            link: nextMode === "online" ? nextLink : null,
            notes: input.notes !== undefined ? input.notes : interview.notes,
            status: "rescheduled",
          } },
          { new: true, runValidators: true, session },
        ).lean();
        if (!updatedInterview) throw new ApiError(409, "INTERVIEW_UPDATE_CONFLICT", "The interview changed concurrently. Refresh and retry.");
        eventType = "INTERVIEW_RESCHEDULED";
      } else if (input.action === "cancel") {
        updatedInterview = await Interview.findOneAndUpdate(
          { _id: interview._id, status: interview.status },
          { $set: { status: "cancelled", notes: input.notes !== undefined ? input.notes : interview.notes } },
          { new: true, runValidators: true, session },
        ).lean();
        if (!updatedInterview) throw new ApiError(409, "INTERVIEW_UPDATE_CONFLICT", "The interview changed concurrently. Refresh and retry.");

        if (application.status === APPLICATION_STATUSES.INTERVIEW_SCHEDULED) {
          const changed = await Application.findOneAndUpdate(
            { _id: application._id, status: APPLICATION_STATUSES.INTERVIEW_SCHEDULED },
            {
              $set: { status: APPLICATION_STATUSES.SHORTLISTED },
              $push: { statusHistory: {
                from: APPLICATION_STATUSES.INTERVIEW_SCHEDULED,
                to: APPLICATION_STATUSES.SHORTLISTED,
                by: user._id,
                note: "Interview cancelled; application returned to shortlisted.",
                at: new Date(),
              } },
            },
            { new: true, runValidators: true, session },
          );
          if (!changed) throw new ApiError(409, "APPLICATION_STATUS_CONFLICT", "The application changed while the interview was being cancelled.");
        }
        eventType = "INTERVIEW_CANCELLED";
      } else {
        updatedInterview = await Interview.findOneAndUpdate(
          { _id: interview._id, status: interview.status },
          { $set: { status: "completed", notes: input.notes !== undefined ? input.notes : interview.notes } },
          { new: true, runValidators: true, session },
        ).lean();
        if (!updatedInterview) throw new ApiError(409, "INTERVIEW_UPDATE_CONFLICT", "The interview changed concurrently. Refresh and retry.");
        // Application status intentionally remains interview_scheduled. The recruiter
        // must explicitly record selected/rejected after reviewing the interview outcome.
        eventType = "INTERVIEW_COMPLETED";
      }
    });
  } finally {
    await session.endSession();
  }

  await writeSideEffects([
    createNotifications(buildInterviewNotifications(updatedInterview, job, eventType, user.name)),
    writeAuditLog({
      actor: user._id,
      actorRole: user.role,
      action: eventType,
      targetType: "Interview",
      targetId: updatedInterview._id,
      meta: { applicationId: String(updatedInterview.application), jobId: String(updatedInterview.job), action: input.action },
      ip,
    }),
  ], { interviewId: String(updatedInterview._id), action: input.action });

  return updatedInterview;
}
