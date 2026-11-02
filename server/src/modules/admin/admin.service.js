import mongoose from "mongoose";
import User from "../../models/User.js";
import StudentProfile from "../../models/StudentProfile.js";
import Job from "../../models/Job.js";
import Application from "../../models/Application.js";
import Interview from "../../models/Interview.js";
import AuditLog from "../../models/AuditLog.js";
import Notification from "../../models/Notification.js";
import { USER_ROLES, USER_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { getPagination, buildPaginationMeta } from "../../utils/pagination.js";

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortDirection(order) {
  return order === "asc" ? 1 : -1;
}

function assertObjectId(value, label) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `INVALID_${label.toUpperCase()}_ID`, `A valid ${label} id is required.`);
  }
}

export async function listStudents(filters) {
  const { page, limit, skip } = getPagination(filters);
  const match = { role: USER_ROLES.STUDENT };
  if (filters.status) match.status = filters.status;

  const profileMatch = {};
  if (filters.course) profileMatch["profile.course"] = new RegExp(`^${escapeRegex(filters.course)}$`, "i");
  if (filters.specialization) profileMatch["profile.specialization"] = new RegExp(`^${escapeRegex(filters.specialization)}$`, "i");
  if (filters.branch) profileMatch["profile.branch"] = new RegExp(`^${escapeRegex(filters.branch)}$`, "i");
  if (filters.gradYear !== undefined) profileMatch["profile.gradYear"] = filters.gradYear;
  if (filters.minCgpa !== undefined || filters.maxCgpa !== undefined) {
    profileMatch["profile.cgpa"] = {};
    if (filters.minCgpa !== undefined) profileMatch["profile.cgpa"].$gte = filters.minCgpa;
    if (filters.maxCgpa !== undefined) profileMatch["profile.cgpa"].$lte = filters.maxCgpa;
  }
  if (filters.q) {
    const expression = new RegExp(escapeRegex(filters.q), "i");
    profileMatch.$or = [
      { name: expression },
      { email: expression },
      { "profile.rollNo": expression },
      { "profile.course": expression },
      { "profile.specialization": expression },
      { "profile.branch": expression },
      { "profile.skills": expression },
    ];
  }

  const sortField = {
    name: "name",
    cgpa: "profile.cgpa",
    gradYear: "profile.gradYear",
    createdAt: "createdAt",
  }[filters.sort] ?? "createdAt";

  const [result] = await User.aggregate([
    { $match: match },
    { $lookup: { from: "studentprofiles", localField: "_id", foreignField: "user", as: "profile" } },
    { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
    ...(Object.keys(profileMatch).length ? [{ $match: profileMatch }] : []),
    { $sort: { [sortField]: sortDirection(filters.order), _id: 1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
              email: 1,
              status: 1,
              createdAt: 1,
              lastLoginAt: 1,
              profile: {
                id: "$profile._id",
                rollNo: "$profile.rollNo",
                course: "$profile.course",
                specialization: "$profile.specialization",
                branch: "$profile.branch",
                cgpa: "$profile.cgpa",
                cgpaSemester: "$profile.cgpaSemester",
                gradYear: "$profile.gradYear",
                backlogs: "$profile.backlogs",
                phone: "$profile.phone",
                skills: "$profile.skills",
                resume: {
                  fileName: "$profile.resume.fileName",
                  uploadedAt: "$profile.resume.uploadedAt",
                  parseStatus: "$profile.resume.parseStatus",
                  parsedSkills: "$profile.resume.parsedSkills",
                },
              },
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const data = result?.data ?? [];
  const total = result?.total?.[0]?.count ?? 0;
  return { data, meta: buildPaginationMeta({ page, limit, total }) };
}

export async function updateStudent(studentId, input, actor, ip = null) {
  assertObjectId(studentId, "student");
  const session = await mongoose.startSession();
  let updatedAccount;
  let updatedProfile;
  const changedFields = Object.keys(input);

  try {
    await session.withTransaction(async () => {
      const account = await User.findOne({ _id: studentId, role: USER_ROLES.STUDENT }).session(session);
      if (!account) throw new ApiError(404, "STUDENT_NOT_FOUND", "The requested student could not be found.");
      const profile = await StudentProfile.findOne({ user: account._id }).session(session);
      if (!profile) throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student's profile could not be found.");

      if (input.name !== undefined) account.name = input.name;
      if (input.status !== undefined) account.status = input.status;
      await account.save({ session });

      const profileFields = ["rollNo", "course", "specialization", "branch", "cgpa", "cgpaSemester", "gradYear", "backlogs", "phone", "skills"];
      for (const field of profileFields) {
        if (input[field] !== undefined) profile[field] = input[field];
      }
      await profile.save({ session });

      await AuditLog.create([{
        actor: actor._id,
        actorRole: actor.role,
        action: input.status === USER_STATUSES.SUSPENDED ? "STUDENT_SUSPENDED" : input.status === USER_STATUSES.ACTIVE ? "STUDENT_REACTIVATED" : "STUDENT_UPDATED",
        targetType: "User",
        targetId: account._id,
        meta: { changedFields },
        ip,
      }], { session });

      updatedAccount = account.toObject();
      updatedProfile = profile.toObject();
    });
  } finally {
    await session.endSession();
  }

  delete updatedAccount.passwordHash;
  delete updatedAccount.__v;
  delete updatedProfile.embeddings;
  if (updatedProfile.resume) {
    delete updatedProfile.resume.parsedText;
    delete updatedProfile.resume.fileId;
  }
  return { user: updatedAccount, profile: updatedProfile };
}

export async function listRecruiters(filters) {
  const { page, limit, skip } = getPagination(filters);
  const match = { role: USER_ROLES.RECRUITER };
  if (filters.status) match.status = filters.status;
  const sortField = filters.sort === "company" ? "profile.company" : filters.sort === "name" ? "name" : "createdAt";
  const pipeline = [
    { $match: match },
    { $lookup: { from: "recruiterprofiles", localField: "_id", foreignField: "user", as: "profile" } },
    { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
  ];
  if (filters.q) {
    const expression = new RegExp(escapeRegex(filters.q), "i");
    pipeline.push({ $match: { $or: [
      { name: expression }, { email: expression }, { "profile.company": expression }, { "profile.designation": expression },
    ] } });
  }
  pipeline.push(
    { $sort: { [sortField]: sortDirection(filters.order), _id: 1 } },
    { $facet: {
      data: [
        { $skip: skip }, { $limit: limit },
        { $project: {
          name: 1, email: 1, status: 1, createdAt: 1, lastLoginAt: 1,
          profile: { company: "$profile.company", designation: "$profile.designation", website: "$profile.website" },
        } },
      ],
      total: [{ $count: "count" }],
    } },
  );
  const [result] = await User.aggregate(pipeline);
  const total = result?.total?.[0]?.count ?? 0;
  return { data: result?.data ?? [], meta: buildPaginationMeta({ page, limit, total }) };
}

export async function approveRecruiter(recruiterId, actor, ip = null) {
  assertObjectId(recruiterId, "recruiter");
  const session = await mongoose.startSession();
  let approved;
  try {
    await session.withTransaction(async () => {
      const recruiter = await User.findOne({ _id: recruiterId, role: USER_ROLES.RECRUITER }).session(session);
      if (!recruiter) throw new ApiError(404, "RECRUITER_NOT_FOUND", "The requested recruiter could not be found.");
      if (recruiter.status !== USER_STATUSES.PENDING) {
        throw new ApiError(409, "RECRUITER_NOT_PENDING", `Only pending recruiters can be approved. Current status: ${recruiter.status}.`);
      }
      recruiter.status = USER_STATUSES.ACTIVE;
      await recruiter.save({ session });

      await AuditLog.create([{
        actor: actor._id,
        actorRole: actor.role,
        action: "RECRUITER_APPROVED",
        targetType: "User",
        targetId: recruiter._id,
        meta: { recruiterEmail: recruiter.email },
        ip,
      }], { session });
      await Notification.create([{
        user: recruiter._id,
        type: "RECRUITER_APPROVED",
        title: "Recruiter account approved",
        message: "Your CampusLink recruiter account has been approved. You can now publish recruitment opportunities.",
        link: "/recruiter/dashboard",
      }], { session });
      approved = recruiter.toObject();
    });
  } finally {
    await session.endSession();
  }
  delete approved.passwordHash;
  delete approved.__v;
  return approved;
}

export async function listDrives(filters) {
  const { page, limit, skip } = getPagination(filters);
  const pipeline = [];
  if (filters.status) pipeline.push({ $match: { status: filters.status } });
  pipeline.push(
    { $lookup: { from: "users", localField: "recruiter", foreignField: "_id", as: "recruiterAccount" } },
    { $unwind: { path: "$recruiterAccount", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "applications", let: { driveId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$job", "$$driveId"] } } },
      { $group: { _id: null, applicantCount: { $sum: 1 }, selectedCount: { $sum: { $cond: [{ $eq: ["$status", "selected"] }, 1, 0] } } } },
    ], as: "applicationStats" } },
    { $lookup: { from: "interviews", let: { driveId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$job", "$$driveId"] } } },
      { $count: "interviewCount" },
    ], as: "interviewStats" } },
  );
  if (filters.q) {
    const expression = new RegExp(escapeRegex(filters.q), "i");
    pipeline.push({ $match: { $or: [
      { title: expression }, { company: expression }, { location: expression },
      { "recruiterAccount.name": expression }, { "recruiterAccount.email": expression },
    ] } });
  }
  const sortField = filters.sort ?? "createdAt";
  pipeline.push(
    { $addFields: {
      applicantCount: { $ifNull: [{ $arrayElemAt: ["$applicationStats.applicantCount", 0] }, 0] },
      selectedCount: { $ifNull: [{ $arrayElemAt: ["$applicationStats.selectedCount", 0] }, 0] },
      interviewCount: { $ifNull: [{ $arrayElemAt: ["$interviewStats.interviewCount", 0] }, 0] },
    } },
    { $sort: { [sortField]: sortDirection(filters.order), _id: 1 } },
    { $facet: {
      data: [
        { $skip: skip }, { $limit: limit },
        { $project: {
          title: 1, company: 1, location: 1, type: 1, status: 1, deadline: 1, driveDate: 1, createdAt: 1,
          recruiter: { id: "$recruiterAccount._id", name: "$recruiterAccount.name", email: "$recruiterAccount.email" },
          applicantCount: 1, selectedCount: 1, interviewCount: 1,
        } },
      ],
      total: [{ $count: "count" }],
    } },
  );
  const [result] = await Job.aggregate(pipeline);
  const total = result?.total?.[0]?.count ?? 0;
  return { data: result?.data ?? [], meta: buildPaginationMeta({ page, limit, total }) };
}

export async function listAuditLogs(filters) {
  const { page, limit, skip } = getPagination(filters);
  const pipeline = [
    { $lookup: { from: "users", localField: "actor", foreignField: "_id", as: "actorAccount" } },
    { $unwind: { path: "$actorAccount", preserveNullAndEmptyArrays: true } },
  ];
  const match = {};
  if (filters.actor) match.actor = new mongoose.Types.ObjectId(filters.actor);
  if (filters.action) match.action = filters.action;
  if (filters.targetType) match.targetType = filters.targetType;
  if (filters.from || filters.to) {
    match.createdAt = {};
    if (filters.from) match.createdAt.$gte = new Date(filters.from);
    if (filters.to) match.createdAt.$lt = new Date(filters.to);
  }
  if (filters.q) {
    const expression = new RegExp(escapeRegex(filters.q), "i");
    const matchingActors = await User.find({ $or: [{ name: expression }, { email: expression }] }).distinct("_id");
    match.$or = [
      { action: expression },
      { targetType: expression },
      { "actorAccount.name": expression },
      { "actorAccount.email": expression },
      ...(matchingActors.length ? [{ actor: { $in: matchingActors } }] : []),
    ];
  }
  if (Object.keys(match).length) pipeline.push({ $match: match });
  pipeline.push(
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: {
      data: [
        { $skip: skip }, { $limit: limit },
        { $project: {
          actor: { id: "$actorAccount._id", name: "$actorAccount.name", email: "$actorAccount.email" },
          actorRole: 1, action: 1, targetType: 1, targetId: 1, meta: 1, ip: 1, createdAt: 1,
        } },
      ],
      total: [{ $count: "count" }],
    } },
  );
  const [result] = await AuditLog.aggregate(pipeline);
  const total = result?.total?.[0]?.count ?? 0;
  return { data: result?.data ?? [], meta: buildPaginationMeta({ page, limit, total }) };
}

export async function createStudentExportCursor() {
  const cursor = User.aggregate([
    { $match: { role: USER_ROLES.STUDENT } },
    { $lookup: { from: "studentprofiles", localField: "_id", foreignField: "user", as: "profile" } },
    { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $project: {
        name: 1,
        email: 1,
        status: 1,
        createdAt: 1,
        rollNo: "$profile.rollNo",
        branch: "$profile.branch",
        cgpa: "$profile.cgpa",
        gradYear: "$profile.gradYear",
        backlogs: "$profile.backlogs",
        phone: "$profile.phone",
        skills: "$profile.skills",
        resumeParseStatus: "$profile.resume.parseStatus",
      },
    },
  ]).cursor();
  return cursor;
}
