import axios from "axios";
import { clearSession, getToken } from "@/features/auth/session.js";

const publicPaths = ["/", "/login", "/register"];
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && body.success === true && "data" in body) {
      if (body.meta) return { data: body.data, meta: body.meta };
      return body.data;
    }
    return body;
  },
  (error) => {
    const status = error.response?.status ?? null;
    if (status === 401) {
      clearSession();
      if (typeof window !== "undefined" && !publicPaths.includes(window.location.pathname)) {
        window.location.assign("/login");
      }
    }
    const envelope = error.response?.data?.error;
    return Promise.reject({
      status,
      code: envelope?.code ?? (status ? `HTTP_${status}` : "NETWORK_ERROR"),
      message: envelope?.message ?? error.message ?? "Request failed.",
      details: envelope?.details,
    });
  },
);

export async function downloadBlob(url, params) {
  const response = await api.get(url, { params, responseType: "blob" });
  return response;
}
