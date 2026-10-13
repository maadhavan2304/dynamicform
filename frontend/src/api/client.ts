import axios, { AxiosError } from "axios";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(err);
  },
);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data?.detail;
    if (typeof d === "string") return d;
    if (d?.message) return d.message;
    if (Array.isArray(d)) return d.map((x) => x.msg).join("; ");
    if (!err.response) return "Cannot reach the server. Check that the API is running.";
  }
  return "Something went wrong. Please try again.";
}

/** Field-level errors from a 422 submission response, keyed by field id. */
export function fieldErrors(err: unknown): Record<string, string> | null {
  if (axios.isAxiosError(err) && err.response?.status === 422) {
    const e = err.response.data?.detail?.errors;
    if (e && typeof e === "object") return e;
  }
  return null;
}

export function httpStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined;
}

/** Authenticated file download (the API needs the bearer token, so plain links won't work). */
export async function downloadFile(url: string, filename: string, params?: Record<string, any>) {
  const res = await api.get(url, { params, responseType: "blob" });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
