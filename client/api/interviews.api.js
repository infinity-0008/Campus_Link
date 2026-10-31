import { api } from "./axios.js";
export const interviewsApi = {
  mine: (params) => api.get("/interviews/me", { params }),
  calendar: (params) => api.get("/interviews", { params }),
  create: async (payload) => (await api.post("/interviews", payload)).interview,
  update: async (id, payload) => (await api.patch(`/interviews/${id}`, payload)).interview,
};
