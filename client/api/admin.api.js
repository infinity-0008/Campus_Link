import { api } from "./axios.js";
export const adminApi = {
  students: (params) => api.get("/admin/students", { params }),
  updateStudent: (id, payload) => api.patch(`/admin/students/${id}`, payload),
  recruiters: (params) => api.get("/admin/recruiters", { params }),
  approveRecruiter: (id) => api.patch(`/admin/recruiters/${id}/approve`),
  drives: (params) => api.get("/admin/drives", { params }),
  auditLogs: (params) => api.get("/admin/audit-logs", { params }),
  exportStudents: () => api.get("/admin/export/students.csv", { responseType: "blob" }),
};
