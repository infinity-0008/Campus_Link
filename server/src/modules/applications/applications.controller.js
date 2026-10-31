import {
  applyToJob,
  listMyApplications,
  listApplicantsForJob,
  changeApplicationStatus,
  bulkShortlistApplicants,
  exportApplicantsCsv,
  getApplicationAiSummary,
} from "./applications.service.js";

export async function apply(request, response) {
  const result = await applyToJob(request.validated.params.id, request.user, request.ip);
  return response.status(201).json({ success: true, data: result });
}

export async function listMine(request, response) {
  const result = await listMyApplications(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function listForJob(request, response) {
  const result = await listApplicantsForJob(request.validated.params.id, request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function changeStatus(request, response) {
  const application = await changeApplicationStatus(
    request.validated.params.id,
    request.user,
    request.validated.body,
    request.ip,
  );
  return response.status(200).json({ success: true, data: { application } });
}

export async function bulkShortlist(request, response) {
  const result = await bulkShortlistApplicants(
    request.validated.params.id,
    request.user,
    request.validated.body,
    request.ip,
  );
  return response.status(200).json({ success: true, data: result });
}

export async function exportForJob(request, response) {
  const result = await exportApplicantsCsv(request.validated.params.id, request.user, request.validated.query);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
  return response.status(200).send(result.csv);
}

export async function aiSummary(request, response) {
  const result = await getApplicationAiSummary(request.validated.params.id, request.user);
  return response.status(200).json({ success: true, data: result });
}
