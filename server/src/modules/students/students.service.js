import StudentProfile from "../../models/StudentProfile.js";
import User from "../../models/User.js";
import Application from "../../models/Application.js";
import Job from "../../models/Job.js";
import mongoose from "mongoose";
import { USER_ROLES, USER_STATUSES } from "../../config/constants.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { embedStudentProfile } from "../../embeddings/embeddingService.js";
import { extractResumeStructured } from "../../ai/tasks/extractResume.js";
import { runTask } from "../../workers/pool.js";
import {
  deleteResumeFile,
  openResumeDownloadStream,
  readResumeBuffer,
  storeResumeBuffer,
} from "../../config/gridfs.js";
import { validateResumeFile } from "../../middleware/upload.js";

function profileForResponse(profile) {
  const data = profile?.toObject ? profile.toObject() : { ...profile };
  delete data.embeddings;
  if (data.resume) delete data.resume.parsedText;
  return data;
}

async function refreshEmbeddings(profile) {
  const embeddings = await embedStudentProfile(profile);
  profile.embeddings = embeddings ?? undefined;
  profile.markModified("embeddings");
}

function setResumeFailure(profile, message) {
  profile.resume.parseStatus = "failed";
  profile.resume.parseError = message;
  profile.resume.parsedText = "";
  profile.resume.parsedSkills = [];
  profile.resume.aiExtraction = undefined;
  profile.embeddings = undefined;
}

function toParseError(error, action = "parse") {
  if (error?.code === "WORKER_TASK_TIMEOUT") {
    return new ApiError(422, "RESUME_PARSE_TIMEOUT", "Resume processing timed out. Try a simpler PDF.", {
      parseStatus: "failed",
      parseError: "Resume processing timed out. Try a simpler PDF.",
    });
  }
  if (error?.code === "RESUME_TEXT_EMPTY") {
    return new ApiError(422, "RESUME_TEXT_NOT_EXTRACTABLE", error.message, {
      parseStatus: "failed",
      parseError: error.message,
    });
  }
  const message = action === "reparse"
    ? "The stored PDF could not be parsed. Upload a new, text-readable PDF and try again."
    : "The PDF could not be parsed. Upload a valid, text-readable PDF and try again.";
  return new ApiError(422, action === "reparse" ? "RESUME_REPARSE_FAILED" : "RESUME_PARSE_FAILED", message, {
    parseStatus: "failed",
    parseError: message,
  });
}

export async function getStudentProfile(userId) {
  const profile = await StudentProfile.findOne({ user: userId });
  if (!profile) {
    throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
  }
  return profileForResponse(profile);
}

export async function updateStudentProfile(userId, input) {
  const profile = await StudentProfile.findOne({ user: userId }).select("+embeddings");
  if (!profile) {
    throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
  }

  profile.set(input);
  await refreshEmbeddings(profile);
  await profile.save();
  return profileForResponse(profile);
}

async function persistParsedResume(profile, text) {
  const parsedText = String(text);
  const result = await extractResumeStructured(parsedText);
  const extractedSkills = result.extraction.skills ?? [];

  profile.resume.parsedText = parsedText;
  profile.resume.parsedSkills = [...new Set(extractedSkills.map((skill) => String(skill).trim()).filter(Boolean))];
  profile.resume.parseStatus = "ok";
  profile.resume.parseError = null;
  profile.resume.aiExtraction = {
    ...result.extraction,
    model: result.model,
    promptVersion: result.promptVersion,
    fallbackUsed: result.fallbackUsed,
  };

  await refreshEmbeddings(profile);
  await profile.save();
  return profileForResponse(profile);
}

export async function uploadStudentResume(userId, file) {
  validateResumeFile(file);

  const profile = await StudentProfile.findOne({ user: userId }).select("+embeddings");
  if (!profile) {
    throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
  }

  const oldFileId = profile.resume?.fileId;
  const safeFileName = file.originalname.replace(/[\\/\r\n\u0000]/g, "_").slice(0, 180);
  const fileId = await storeResumeBuffer(file.buffer, safeFileName, { userId: userId.toString() });

  let parsed;
  try {
    // The PDF parser executes in the Piscina parse pool, not on Express's event loop.
    parsed = await runTask("parse", "parseResume", { buffer: file.buffer });
  } catch (error) {
    profile.resume.fileId = fileId;
    profile.resume.fileName = safeFileName;
    profile.resume.uploadedAt = new Date();
    setResumeFailure(profile, error.code === "RESUME_TEXT_EMPTY"
      ? error.message
      : "The PDF could not be parsed. Upload a valid, text-readable PDF and try again.");
    try {
      await profile.save();
    } catch (saveError) {
      await deleteResumeFile(fileId).catch(() => undefined);
      throw saveError;
    }
    if (oldFileId) await deleteResumeFile(oldFileId).catch((deleteError) => {
      logger.warn({ err: deleteError, oldFileId: oldFileId.toString() }, "Could not remove the replaced resume from GridFS.");
    });
    logger.warn({ err: error, userId: userId.toString() }, "Resume PDF parsing failed.");
    throw toParseError(error);
  }

  profile.resume.fileId = fileId;
  profile.resume.fileName = safeFileName;
  profile.resume.uploadedAt = new Date();
  try {
    const updatedProfile = await persistParsedResume(profile, parsed.text);
    if (oldFileId) await deleteResumeFile(oldFileId).catch((error) => {
      logger.warn({ err: error, oldFileId: oldFileId.toString() }, "Could not remove the replaced resume from GridFS.");
    });
    return { profile: updatedProfile, pages: parsed.pages };
  } catch (error) {
    // If the profile write fails, preserve the previous resume and remove the new GridFS file.
    await deleteResumeFile(fileId).catch((deleteError) => {
      logger.error({ err: deleteError, fileId: fileId.toString() }, "Failed to clean up an uncommitted resume upload.");
    });
    throw error;
  }
}

export async function reparseStudentResume(userId) {
  const profile = await StudentProfile.findOne({ user: userId }).select("+embeddings");
  if (!profile) {
    throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The student profile could not be found.");
  }
  if (!profile.resume?.fileId) {
    throw new ApiError(404, "RESUME_NOT_FOUND", "Upload a resume before requesting a re-parse.");
  }

  const buffer = await readResumeBuffer(profile.resume.fileId);
  let parsed;
  try {
    parsed = await runTask("parse", "parseResume", { buffer });
  } catch (error) {
    setResumeFailure(profile, error.code === "RESUME_TEXT_EMPTY"
      ? error.message
      : "The stored PDF could not be parsed. Upload a new, text-readable PDF and try again.");
    await profile.save();
    logger.warn({ err: error, userId: userId.toString() }, "Resume re-parsing failed.");
    throw toParseError(error, "reparse");
  }

  const updatedProfile = await persistParsedResume(profile, parsed.text);
  return { profile: updatedProfile, pages: parsed.pages };
}

export async function getResumeDownload(userId) {
  const profile = await StudentProfile.findOne({ user: userId }).select("resume.fileId resume.fileName").lean();
  if (!profile?.resume?.fileId) {
    throw new ApiError(404, "RESUME_NOT_FOUND", "No resume has been uploaded.");
  }
  return {
    stream: openResumeDownloadStream(profile.resume.fileId),
    fileName: profile.resume.fileName || "resume.pdf",
  };
}


async function assertCanViewApplicantStudent(studentId, requestingUser) {
  if (!mongoose.isValidObjectId(studentId)) {
    throw new ApiError(400, "INVALID_STUDENT_ID", "A valid student id is required.");
  }
  if (requestingUser.role === USER_ROLES.ADMIN) return;
  if (requestingUser.role !== USER_ROLES.RECRUITER) {
    throw new ApiError(403, "FORBIDDEN", "You cannot view this student record.");
  }
  if (requestingUser.status !== USER_STATUSES.ACTIVE) {
    throw new ApiError(403, "RECRUITER_NOT_APPROVED", "Your recruiter account must be approved before viewing applicants.");
  }
  const recruiterJobs = await Job.find({ recruiter: requestingUser._id }).select("_id").lean();
  const jobIds = recruiterJobs.map((job) => job._id);
  const isApplicant = jobIds.length > 0 && await Application.exists({
    student: studentId,
    job: { $in: jobIds },
  });
  if (!isApplicant) {
    throw new ApiError(403, "FORBIDDEN", "Recruiters can view only students who applied to their jobs.");
  }
}

export async function getStudentRecord(studentId, requestingUser) {
  await assertCanViewApplicantStudent(studentId, requestingUser);
  const [profile, account] = await Promise.all([
    StudentProfile.findOne({ user: studentId }),
    User.findById(studentId).select("name email createdAt"),
  ]);
  if (!profile || !account) throw new ApiError(404, "STUDENT_PROFILE_NOT_FOUND", "The requested student profile could not be found.");
  return {
    student: { id: String(account._id), name: account.name, email: account.email, createdAt: account.createdAt },
    profile: profileForResponse(profile),
  };
}

export async function getApplicantResumeDownload(studentId, requestingUser) {
  await assertCanViewApplicantStudent(studentId, requestingUser);
  const profile = await StudentProfile.findOne({ user: studentId }).select("resume.fileId resume.fileName").lean();
  if (!profile?.resume?.fileId) throw new ApiError(404, "RESUME_NOT_FOUND", "This student has not uploaded a resume.");
  return {
    stream: openResumeDownloadStream(profile.resume.fileId),
    fileName: profile.resume.fileName || "resume.pdf",
  };
}
