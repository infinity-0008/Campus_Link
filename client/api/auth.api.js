import { api } from "./axios.js";
export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  register: (payload) => api.post("/auth/register", payload),
  me: async () => {
    const result = await api.get("/auth/me");
    return result?.user ?? result;
  },
};
