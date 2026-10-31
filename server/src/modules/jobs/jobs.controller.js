import {
  createJob,
  listJobs,
  getJobById,
  getJobEligibility,
  updateJob,
  publishJob,
  closeJob,
  deleteDraftJob,
  assertCanManageJobs,
} from "./jobs.service.js";
import { suggestJobSkills } from "../../ai/tasks/suggestJobSkills.js";
import { getRecommendedJobs, getStudentJobFit } from "../matching/matching.service.js";

export async function create(request, response) {
  const job = await createJob(request.user, request.validated.body, request.ip);
  return response.status(201).json({ success: true, data: { job } });
}

export async function list(request, response) {
  const result = await listJobs(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function getById(request, response) {
  const job = await getJobById(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: { job } });
}

export async function eligibility(request, response) {
  const result = await getJobEligibility(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: result });
}

export async function update(request, response) {
  const job = await updateJob(request.validated.params.id, request.user, request.validated.body, request.ip);
  return response.status(200).json({ success: true, data: { job } });
}

export async function publish(request, response) {
  const job = await publishJob(request.validated.params.id, request.user, request.ip);
  return response.status(200).json({ success: true, data: { job } });
}

export async function close(request, response) {
  const job = await closeJob(request.validated.params.id, request.user, request.ip);
  return response.status(200).json({ success: true, data: { job } });
}

export async function removeDraft(request, response) {
  const result = await deleteDraftJob(request.validated.params.id, request.user, request.ip);
  return response.status(200).json({ success: true, data: result });
}

export async function suggestSkills(request, response) {
  await assertCanManageJobs(request.user);
  const result = await suggestJobSkills(request.validated.body);
  return response.status(200).json({ success: true, data: result });
}

export async function fit(request, response) {
  const result = await getStudentJobFit(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: result });
}

export async function recommended(request, response) {
  const result = await getRecommendedJobs(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}
