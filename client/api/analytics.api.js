import { api } from "./axios.js";
export const analyticsApi = {
  overview: (params) => api.get("/analytics/overview", { params }),
  skillsDemand: () => api.get("/analytics/skills-demand"),
  placements: (params) => api.get("/analytics/placements", { params }),
  driveReport: (jobId) => api.get(`/analytics/reports/drive/${jobId}`),
  exportDrive: (jobId) => api.get(`/analytics/reports/drive/${jobId}/export.csv`, { responseType: "blob" }),
  exportOverview: () => api.get("/analytics/reports/overview/export.csv", { responseType: "blob" }),
};
