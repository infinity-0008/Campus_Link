import { api } from "./axios.js";
export const applicationsApi = {
  apply: (jobId) => api.post(`/jobs/${jobId}/apply`, {}),
  mine: (params) => api.get("/applications/me", { params }),
  updateStatus: (id, payload) => api.patch(`/applications/${id}/status`, payload),
  summary: (id) => api.get(`/applications/${id}/ai-summary`),
  match: (jobId, studentId) => api.get(`/matching/${jobId}/${studentId}`),
  compare: (jobId, studentId) => api.get(`/matching/${jobId}/${studentId}/compare`),
};
