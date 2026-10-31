import mongoose from "mongoose";
import User from "../../models/User.js";
import Job from "../../models/Job.js";
import Application from "../../models/Application.js";
import StudentProfile from "../../models/StudentProfile.js";
import Interview from "../../models/Interview.js";
import { USER_ROLES, USER_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { median } from "../../utils/csv.js";

const APPLICATION_STATUS_VALUES = ["applied", "shortlisted", "interview_scheduled", "selected", "rejected"];

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateMatch({ from, to } = {}, field = "createdAt") {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lt = new Date(to);
  return { [field]: range };
}

async function getJobScope(user) {
  if (user.role === USER_ROLES.ADMIN) return {};
  if (user.role === USER_ROLES.RECRUITER) {
    if (user.status !== USER_STATUSES.ACTIVE) {
      throw new ApiError(403, "RECRUITER_NOT_APPROVED", "Your recruiter account must be approved to view recruitment analytics.");
    }
    return { recruiter: user._id };
  }
  throw new ApiError(403, "FORBIDDEN", "Only recruiters and placement administrators can view analytics.");
}

async function getScopedJob(jobId, user) {
  if (!mongoose.isValidObjectId(jobId)) throw new ApiError(400, "INVALID_JOB_ID", "A valid job id is required.");
  const job = await Job.findById(jobId).select("title company recruiter status driveDate deadline type location").lean();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "The requested job could not be found.");
  if (user.role === USER_ROLES.ADMIN) return job;
  const scope = await getJobScope(user);
  if (String(job.recruiter) !== String(scope.recruiter)) {
    throw new ApiError(403, "FORBIDDEN", "Recruiters can view reports only for their own jobs.");
  }
  return job;
}

async function getScopedJobIds(user) {
  const scope = await getJobScope(user);
  return Job.distinct("_id", scope);
}

function countByStatus(rows) {
  const counts = Object.fromEntries(APPLICATION_STATUS_VALUES.map((status) => [status, 0]));
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

export async function getAnalyticsOverview(user, filters = {}) {
  const jobScope = await getJobScope(user);
  const jobs = await Job.find(jobScope).select("_id status").lean();
  const jobIds = jobs.map((job) => job._id);
  const appMatch = { job: { $in: jobIds }, ...dateMatch(filters) };
  const [statusRows, scoreRows, applicantIds, interviewCount, perJobRows] = await Promise.all([
    jobIds.length ? Application.aggregate([
      { $match: appMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]) : [],
    jobIds.length ? Application.aggregate([
      { $match: { ...appMatch, matchScore: { $ne: null } } },
      { $group: { _id: null, scores: { $push: "$matchScore" }, average: { $avg: "$matchScore" } } },
    ]) : [],
    jobIds.length ? Application.distinct("student", appMatch) : [],
    jobIds.length ? Interview.countDocuments({ job: { $in: jobIds }, ...dateMatch(filters, "scheduledAt") }) : 0,
    jobIds.length ? Job.aggregate([
      { $match: jobScope },
      { $lookup: { from: "applications", let: { driveId: "$_id" }, pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ["$job", "$$driveId"] },
          ...(filters.from ? [{ $gte: ["$createdAt", new Date(filters.from)] }] : []),
          ...(filters.to ? [{ $lt: ["$createdAt", new Date(filters.to)] }] : []),
        ] } } },
        { $group: {
          _id: null,
          applicantCount: { $sum: 1 },
          applied: { $sum: { $cond: [{ $eq: ["$status", "applied"] }, 1, 0] } },
          shortlisted: { $sum: { $cond: [{ $eq: ["$status", "shortlisted"] }, 1, 0] } },
          interviewScheduled: { $sum: { $cond: [{ $eq: ["$status", "interview_scheduled"] }, 1, 0] } },
          selected: { $sum: { $cond: [{ $eq: ["$status", "selected"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        } },
      ], as: "applicationStats" } },
      { $addFields: { stats: { $ifNull: [{ $arrayElemAt: ["$applicationStats", 0] }, {}] } } },
      { $project: {
        _id: 0, jobId: "$_id", company: 1, title: 1, jobStatus: "$status",
        applicantCount: { $ifNull: ["$stats.applicantCount", 0] },
        applied: { $ifNull: ["$stats.applied", 0] },
        shortlisted: { $ifNull: ["$stats.shortlisted", 0] },
        interviewScheduled: { $ifNull: ["$stats.interviewScheduled", 0] },
        selected: { $ifNull: ["$stats.selected", 0] },
        rejected: { $ifNull: ["$stats.rejected", 0] },
      } },
      { $sort: { applicantCount: -1, company: 1, title: 1 } },
    ]) : [],
  ]);

  const applicationCounts = countByStatus(statusRows);
  const totalApplications = Object.values(applicationCounts).reduce((sum, count) => sum + count, 0);
  const scoreValues = scoreRows[0]?.scores ?? [];
  const result = {
    jobs: {
      total: jobs.length,
      open: jobs.filter((job) => job.status === "open").length,
      draft: jobs.filter((job) => job.status === "draft").length,
      closed: jobs.filter((job) => job.status === "closed").length,
    },
    applications: {
      total: totalApplications,
      byStatus: applicationCounts,
      uniqueApplicants: applicantIds.length,
      averageMatchScore: scoreRows[0]?.average == null ? null : Number(scoreRows[0].average.toFixed(2)),
      medianMatchScore: median(scoreValues),
    },
    interviews: { total: interviewCount },
    applicationsPerJob: perJobRows,
  };

  if (user.role === USER_ROLES.ADMIN) {
    const [students, recruiters, activeRecruiters, pendingRecruiters] = await Promise.all([
      User.countDocuments({ role: USER_ROLES.STUDENT }),
      User.countDocuments({ role: USER_ROLES.RECRUITER }),
      User.countDocuments({ role: USER_ROLES.RECRUITER, status: USER_STATUSES.ACTIVE }),
      User.countDocuments({ role: USER_ROLES.RECRUITER, status: USER_STATUSES.PENDING }),
    ]);
    result.accounts = { students, recruiters, activeRecruiters, pendingRecruiters };
  }
  return result;
}

export async function getSkillsDemand(user) {
  const jobScope = await getJobScope(user);
  const jobs = await Job.find(jobScope).select("requiredSkills").lean();
  const jobIds = await Job.distinct("_id", jobScope);
  const applicantIds = jobIds.length ? await Application.distinct("student", { job: { $in: jobIds } }) : [];
  const profiles = applicantIds.length
    ? await StudentProfile.find({ user: { $in: applicantIds } }).select("skills resume.parsedSkills").lean()
    : [];

  const demand = new Map();
  for (const job of jobs) {
    for (const rawSkill of job.requiredSkills ?? []) {
      const skill = String(rawSkill).trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      const current = demand.get(key) ?? { skill, openings: 0 };
      current.openings += 1;
      demand.set(key, current);
    }
  }

  const supply = new Map();
  for (const profile of profiles) {
    const allSkills = [...(profile.skills ?? []), ...(profile.resume?.parsedSkills ?? [])];
    const applicantSkills = new Set(allSkills.map((skill) => String(skill).trim()).filter(Boolean).map((skill) => skill.toLowerCase()));
    for (const key of applicantSkills) supply.set(key, (supply.get(key) ?? 0) + 1);
  }

  const data = [...demand.entries()].map(([key, value]) => ({
    skill: value.skill,
    jobDemandCount: value.openings,
    applicantSupplyCount: supply.get(key) ?? 0,
  })).sort((left, right) => right.jobDemandCount - left.jobDemandCount || left.skill.localeCompare(right.skill));
  return { data, meta: { total: data.length } };
}

export async function getPlacementOutcomes(user, filters = {}) {
  const jobIds = await getScopedJobIds(user);
  if (jobIds.length === 0) return { data: [], meta: { total: 0 } };
  const pipeline = [
    { $match: { job: { $in: jobIds }, ...dateMatch(filters) } },
    { $lookup: { from: "studentprofiles", localField: "student", foreignField: "user", as: "profile" } },
    { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
    { $addFields: { branchLabel: { $ifNull: ["$profile.branch", "Unspecified"] } } },
    { $group: {
      _id: "$branchLabel",
      applicationCount: { $sum: 1 },
      selectedApplications: { $sum: { $cond: [{ $eq: ["$status", "selected"] }, 1, 0] } },
      studentIds: { $addToSet: "$student" },
      selectedStudentIds: { $addToSet: { $cond: [{ $eq: ["$status", "selected"] }, "$student", null] } },
    } },
    { $project: {
      _id: 0,
      branch: "$_id",
      applicationCount: 1,
      selectedApplications: 1,
      uniqueApplicants: { $size: "$studentIds" },
      placedStudents: { $size: { $filter: { input: "$selectedStudentIds", as: "studentId", cond: { $ne: ["$$studentId", null] } } } },
    } },
    { $addFields: {
      selectionRate: { $cond: [{ $gt: ["$applicationCount", 0] }, { $round: [{ $multiply: [{ $divide: ["$selectedApplications", "$applicationCount"] }, 100] }, 2] }, 0] },
      studentPlacementRate: { $cond: [{ $gt: ["$uniqueApplicants", 0] }, { $round: [{ $multiply: [{ $divide: ["$placedStudents", "$uniqueApplicants"] }, 100] }, 2] }, 0] },
    } },
    { $sort: { selectedApplications: -1, branch: 1 } },
  ];
  const data = await Application.aggregate(pipeline);
  return { data, meta: { total: data.length } };
}

export async function getDriveReport(jobId, user) {
  const job = await getScopedJob(jobId, user);
  const baseMatch = { job: job._id };
  const [statusRows, scoreRows, skillRows, missingSkillRows, dailyRows, interviewRows] = await Promise.all([
    Application.aggregate([
      { $match: baseMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Application.aggregate([
      { $match: { ...baseMatch, matchScore: { $ne: null } } },
      { $group: { _id: null, average: { $avg: "$matchScore" }, scores: { $push: "$matchScore" } } },
    ]),
    Application.aggregate([
      { $match: baseMatch },
      { $lookup: { from: "studentprofiles", localField: "student", foreignField: "user", as: "profile" } },
      { $unwind: "$profile" },
      { $addFields: { allSkills: { $setUnion: [
        { $ifNull: ["$profile.skills", []] },
        { $ifNull: ["$profile.resume.parsedSkills", []] },
      ] } } },
      { $unwind: "$allSkills" },
      { $group: { _id: { $toLower: "$allSkills" }, skill: { $first: "$allSkills" }, applicants: { $addToSet: "$student" } } },
      { $addFields: { count: { $size: "$applicants" } } },
      { $sort: { count: -1, skill: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, skill: 1, count: 1 } },
    ]),
    Application.aggregate([
      { $match: baseMatch },
      { $unwind: "$matchBreakdown.missingSkills" },
      { $group: { _id: { $toLower: "$matchBreakdown.missingSkills" }, skill: { $first: "$matchBreakdown.missingSkills" }, count: { $sum: 1 } } },
      { $sort: { count: -1, skill: 1 } },
      { $limit: 10 },
      { $project: { _id: 0, skill: 1, count: 1 } },
    ]),
    Application.aggregate([
      { $match: baseMatch },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]),
    Interview.aggregate([
      { $match: { job: job._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const funnel = countByStatus(statusRows);
  const applicantCount = Object.values(funnel).reduce((sum, count) => sum + count, 0);
  const scores = scoreRows[0]?.scores ?? [];
  const interviewCounts = { scheduled: 0, rescheduled: 0, completed: 0, cancelled: 0 };
  for (const row of interviewRows) interviewCounts[row._id] = row.count;
  const selected = funnel.selected ?? 0;
  const scoreDistribution = [
    { range: "0–19", min: 0, max: 20 },
    { range: "20–39", min: 20, max: 40 },
    { range: "40–59", min: 40, max: 60 },
    { range: "60–79", min: 60, max: 80 },
    { range: "80–100", min: 80, max: 101 },
  ].map(({ range, min, max }) => ({
    range,
    count: scores.filter((score) => score >= min && score < max).length,
  }));

  return {
    job: {
      id: String(job._id), title: job.title, company: job.company, status: job.status,
      driveDate: job.driveDate, deadline: job.deadline, type: job.type, location: job.location,
    },
    applicantCount,
    funnel,
    scoreDistribution,
    matchScores: {
      average: scoreRows[0]?.average == null ? null : Number(scoreRows[0].average.toFixed(2)),
      median: median(scores),
      scoredApplications: scores.length,
    },
    topApplicantSkills: skillRows,
    mostCommonMissingSkills: missingSkillRows,
    interviews: interviewCounts,
    selectionRate: applicantCount ? Number(((selected / applicantCount) * 100).toFixed(2)) : 0,
    applicationsPerDay: dailyRows,
  };
}

function topSkillsFromNestedArrays(nestedArrays, limit = 10) {
  const counts = new Map();
  for (const array of nestedArrays ?? []) {
    const uniqueForApplicant = new Set((array ?? []).map((item) => String(item).trim()).filter(Boolean).map((item) => item.toLowerCase()));
    for (const normalized of uniqueForApplicant) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([skill, count]) => ({ skill, count }))
    .sort((left, right) => right.count - left.count || left.skill.localeCompare(right.skill))
    .slice(0, limit);
}

function applicationsPerDayFromDates(dates = []) {
  const counts = new Map();
  for (const value of dates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) continue;
    const day = date.toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }));
}

function reportExportRow(report) {
  const funnel = report.funnel ?? {};
  const interviews = report.interviews ?? {};
  return {
    jobId: String(report.jobId),
    company: report.company,
    title: report.title,
    status: report.status,
    driveDate: report.driveDate ?? null,
    deadline: report.deadline ?? null,
    type: report.type ?? null,
    location: report.location ?? null,
    applicantCount: report.applicantCount,
    applied: funnel.applied ?? report.applied ?? 0,
    shortlisted: funnel.shortlisted ?? report.shortlisted ?? 0,
    interviewScheduled: funnel.interview_scheduled ?? report.interviewScheduled ?? 0,
    selected: funnel.selected ?? report.selected ?? 0,
    rejected: funnel.rejected ?? report.rejected ?? 0,
    averageMatchScore: report.averageMatchScore ?? report.matchScores?.average ?? null,
    medianMatchScore: report.medianMatchScore ?? report.matchScores?.median ?? null,
    scheduledInterviews: interviews.scheduled ?? report.scheduledInterviews ?? 0,
    rescheduledInterviews: interviews.rescheduled ?? report.rescheduledInterviews ?? 0,
    completedInterviews: interviews.completed ?? report.completedInterviews ?? 0,
    cancelledInterviews: interviews.cancelled ?? report.cancelledInterviews ?? 0,
    selectionRate: report.selectionRate,
    topApplicantSkills: JSON.stringify(report.topApplicantSkills ?? []),
    mostCommonMissingSkills: JSON.stringify(report.mostCommonMissingSkills ?? []),
    scoreDistribution: JSON.stringify(report.scoreDistribution ?? []),
    applicationsPerDay: JSON.stringify(report.applicationsPerDay ?? []),
  };
}

export async function getDriveReportCsvRows(jobId, user) {
  const report = await getDriveReport(jobId, user);
  return [reportExportRow({
    jobId: report.job.id,
    company: report.job.company,
    title: report.job.title,
    status: report.job.status,
    driveDate: report.job.driveDate,
    deadline: report.job.deadline,
    type: report.job.type,
    location: report.job.location,
    applicantCount: report.applicantCount,
    funnel: report.funnel,
    matchScores: report.matchScores,
    interviews: report.interviews,
    selectionRate: report.selectionRate,
    topApplicantSkills: report.topApplicantSkills,
    mostCommonMissingSkills: report.mostCommonMissingSkills,
    scoreDistribution: report.scoreDistribution,
    applicationsPerDay: report.applicationsPerDay,
  })];
}

export async function getOverviewReportCsvRows(user) {
  if (user.role !== USER_ROLES.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "The overview export is available only to placement administrators.");
  }
  const reports = await Job.aggregate([
    { $lookup: { from: "applications", let: { driveId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$job", "$$driveId"] } } },
      { $lookup: { from: "studentprofiles", localField: "student", foreignField: "user", as: "studentProfile" } },
      { $unwind: { path: "$studentProfile", preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: null,
        applicantCount: { $sum: 1 },
        applied: { $sum: { $cond: [{ $eq: ["$status", "applied"] }, 1, 0] } },
        shortlisted: { $sum: { $cond: [{ $eq: ["$status", "shortlisted"] }, 1, 0] } },
        interviewScheduled: { $sum: { $cond: [{ $eq: ["$status", "interview_scheduled"] }, 1, 0] } },
        selected: { $sum: { $cond: [{ $eq: ["$status", "selected"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        averageMatchScore: { $avg: "$matchScore" },
        scores: { $push: "$matchScore" },
        applicantSkills: { $push: { $setUnion: [
          { $ifNull: ["$studentProfile.skills", []] },
          { $ifNull: ["$studentProfile.resume.parsedSkills", []] },
        ] } },
        missingSkills: { $push: { $ifNull: ["$matchBreakdown.missingSkills", []] } },
        applicationDates: { $push: "$createdAt" },
      } },
    ], as: "applicationStats" } },
    { $lookup: { from: "interviews", let: { driveId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$job", "$$driveId"] } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ], as: "interviewStats" } },
    { $addFields: {
      stats: { $ifNull: [{ $arrayElemAt: ["$applicationStats", 0] }, {}] },
    } },
    { $project: {
      _id: 0,
      jobId: "$_id",
      company: 1,
      title: 1,
      status: 1,
      driveDate: 1,
      deadline: 1,
      type: 1,
      location: 1,
      applicantCount: { $ifNull: ["$stats.applicantCount", 0] },
      applied: { $ifNull: ["$stats.applied", 0] },
      shortlisted: { $ifNull: ["$stats.shortlisted", 0] },
      interviewScheduled: { $ifNull: ["$stats.interviewScheduled", 0] },
      selected: { $ifNull: ["$stats.selected", 0] },
      rejected: { $ifNull: ["$stats.rejected", 0] },
      averageMatchScore: "$stats.averageMatchScore",
      scores: { $filter: { input: { $ifNull: ["$stats.scores", []] }, as: "score", cond: { $ne: ["$$score", null] } } },
      applicantSkills: { $ifNull: ["$stats.applicantSkills", []] },
      missingSkills: { $ifNull: ["$stats.missingSkills", []] },
      applicationDates: { $ifNull: ["$stats.applicationDates", []] },
      interviewStats: 1,
    } },
    { $sort: { company: 1, title: 1 } },
  ]);

  return reports.map((report) => {
    const interviewCounts = { scheduled: 0, rescheduled: 0, completed: 0, cancelled: 0 };
    for (const row of report.interviewStats ?? []) interviewCounts[row._id] = row.count;
    return reportExportRow({
      ...report,
      medianMatchScore: median(report.scores ?? []),
      interviews: interviewCounts,
      selectionRate: report.applicantCount ? Number(((report.selected / report.applicantCount) * 100).toFixed(2)) : 0,
      topApplicantSkills: topSkillsFromNestedArrays(report.applicantSkills),
      mostCommonMissingSkills: topSkillsFromNestedArrays(report.missingSkills),
      applicationsPerDay: applicationsPerDayFromDates(report.applicationDates),
    });
  });
}

export async function createStudentExportCursor() {
  return User.aggregate([
    { $match: { role: USER_ROLES.STUDENT } },
    { $lookup: { from: "studentprofiles", localField: "_id", foreignField: "user", as: "profile" } },
    { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
    { $sort: { name: 1, _id: 1 } },
    { $project: {
      name: 1, email: 1, status: 1, createdAt: 1,
      rollNo: "$profile.rollNo", branch: "$profile.branch", cgpa: "$profile.cgpa",
      gradYear: "$profile.gradYear", backlogs: "$profile.backlogs", phone: "$profile.phone",
      skills: "$profile.skills",
      resumeParseStatus: "$profile.resume.parseStatus",
    } },
  ]).cursor({ batchSize: 500 }).exec();
}

