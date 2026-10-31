import { pipeline } from "node:stream/promises";
import {
  getStudentProfile,
  updateStudentProfile,
  uploadStudentResume,
  reparseStudentResume,
  getResumeDownload,
  getStudentRecord,
  getApplicantResumeDownload,
} from "./students.service.js";

export async function getMyProfile(request, response) {
  const profile = await getStudentProfile(request.user._id);
  return response.status(200).json({ success: true, data: { profile } });
}

export async function updateMyProfile(request, response) {
  const profile = await updateStudentProfile(request.user._id, request.validated.body);
  return response.status(200).json({ success: true, data: { profile } });
}

export async function uploadMyResume(request, response) {
  const result = await uploadStudentResume(request.user._id, request.file);
  return response.status(200).json({
    success: true,
    data: {
      profile: result.profile,
      pages: result.pages,
      message: "Resume uploaded and processed successfully.",
    },
  });
}

export async function reparseMyResume(request, response) {
  const result = await reparseStudentResume(request.user._id);
  return response.status(200).json({
    success: true,
    data: {
      profile: result.profile,
      pages: result.pages,
      message: "Resume re-parsed successfully.",
    },
  });
}

export async function downloadMyResume(request, response, next) {
  const result = await getResumeDownload(request.user._id);
  const safeName = result.fileName.replace(/[\r\n"\\]/g, "_");
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  try {
    await pipeline(result.stream, response);
  } catch (error) {
    if (!response.headersSent) return next(error);
    response.destroy(error);
  }
}


export async function getStudentById(request, response) {
  const result = await getStudentRecord(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: result });
}

export async function downloadApplicantResume(request, response, next) {
  const result = await getApplicantResumeDownload(request.validated.params.id, request.user);
  const safeName = result.fileName.replace(/[\r\n"\\]/g, "_");
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  try {
    await pipeline(result.stream, response);
  } catch (error) {
    if (!response.headersSent) return next(error);
    response.destroy(error);
  }
}
