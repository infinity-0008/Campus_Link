import { api } from "./axios.js";
export const jobsApi = {
  list: (params) => api.get("/jobs", { params }),
  recommended: (params) => api.get("/jobs/recommended", { params }),
  get: async (id) => (await api.get(`/jobs/${id}`)).job,
  fit: (id) => api.get(`/jobs/${id}/fit`),
  eligibility: (id) => api.get(`/jobs/${id}/eligibility`),
  create: async (payload) => (await api.post("/jobs", payload)).job,
  update: async (id, payload) => (await api.put(`/jobs/${id}`, payload)).job,
  publish: async (id) => (await api.patch(`/jobs/${id}/publish`)).job,
  close: async (id) => (await api.patch(`/jobs/${id}/close`)).job,
  remove: (id) => api.delete(`/jobs/${id}`),
  suggestSkills: (payload) => api.post("/jobs/ai/suggest-skills", payload),
  applicants: (id, params) => api.get(`/jobs/${id}/applications`, { params }),
  bulkShortlist: (id, payload) => api.patch(`/jobs/${id}/applications/bulk-shortlist`, payload),
  exportApplicants: (id, params) => api.get(`/jobs/${id}/applications/export.csv`, { params, responseType: "blob" }),
};
