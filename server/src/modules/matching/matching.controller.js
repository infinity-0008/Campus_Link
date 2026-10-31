import {
  getMatchingComparison,
  getMatchingForPair,
  getRecommendedJobs,
  getStudentJobFit,
} from "./matching.service.js";

export async function fitForCurrentStudent(request, response) {
  const result = await getStudentJobFit(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: result });
}

export async function recommendedJobs(request, response) {
  const result = await getRecommendedJobs(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function matchPair(request, response) {
  const { jobId, studentId } = request.validated.params;
  const result = await getMatchingForPair(jobId, studentId, request.user);
  return response.status(200).json({ success: true, data: result });
}

export async function comparePair(request, response) {
  const { jobId, studentId } = request.validated.params;
  const result = await getMatchingComparison(jobId, studentId, request.user);
  return response.status(200).json({ success: true, data: result });
}
