import {
  scheduleInterview,
  listMyInterviews,
  listInterviewCalendar,
  updateInterview,
} from "./interviews.service.js";

export async function create(request, response) {
  const interview = await scheduleInterview(request.user, request.validated.body, request.ip);
  return response.status(201).json({ success: true, data: { interview } });
}

export async function listMine(request, response) {
  const result = await listMyInterviews(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function calendar(request, response) {
  const result = await listInterviewCalendar(request.user, request.validated.query);
  return response.status(200).json({ success: true, data: result.data, meta: result.meta });
}

export async function update(request, response) {
  const interview = await updateInterview(
    request.validated.params.id,
    request.user,
    request.validated.body,
    request.ip,
  );
  return response.status(200).json({ success: true, data: { interview } });
}
