import { api, downloadBlob } from "./axios.js";
export const studentsApi = {
  me: async () => (await api.get("/students/me")).profile,
  update: async (payload) => (await api.put("/students/me", payload)).profile,
  uploadResume: async (file) => {
    const body = new FormData(); body.append("resume", file);
    return api.post("/students/me/resume", body, { timeout: 120000 });
  },
  reparseResume: () => api.post("/students/me/resume/reparse"),
  resume: () => downloadBlob("/students/me/resume"),
  applicant: (id) => api.get(`/students/${id}`),
  applicantResume: (id) => downloadBlob(`/students/${id}/resume`),
};
