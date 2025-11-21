// frontend/src/api.js
import axios from "axios";
import { auth } from "./firebase";

const inferredBase =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8000/api/v1"
    : "/api/v1");

const api = axios.create({
  baseURL: inferredBase,
  withCredentials: false,
  timeout: 20000,
});

async function fetchIdToken() {
  try {
    if (auth?.currentUser) return await auth.currentUser.getIdToken();
    if (typeof window !== "undefined" && typeof window.getIdToken === "function") {
      return await window.getIdToken();
    }
  } catch (e) {
    return null;
  }
  return null;
}

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await fetchIdToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {}
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.isAxiosError && !error.response) {
      const netErr = new Error("Network Error: failed to reach API server");
      netErr.code = "NETWORK_ERROR";
      netErr.original = error;
      return Promise.reject(netErr);
    }
    return Promise.reject(error);
  }
);

async function generateItem(projectId, itemId) {
  const res = await api.post(`/projects/${projectId}/items/${itemId}/generate`);
  return res.data;
}

async function refineItem(projectId, itemId, refinement_prompt) {
  const res = await api.post(`/projects/${projectId}/items/${itemId}/refine`, {
    refinement_prompt,
  });
  return res.data;
}

async function saveItem(projectId, itemId, payload) {
  try {
    const res = await api.patch(`/projects/${projectId}/items/${itemId}`, payload);
    return res.data;
  } catch (err) {
    if (err?.response?.status === 405 || err?.response?.status === 404) {
      const res = await api.put(`/projects/${projectId}/items/${itemId}`, payload);
      return res.data;
    }
    throw err;
  }
}

async function exportProject(projectId, format = "docx") {
  const path =
    format === "pptx"
      ? `/projects/${projectId}/export/pptx`
      : `/projects/${projectId}/export/docx`;

  const response = await api.get(path, { responseType: "arraybuffer" });
  const blob = new Blob([response.data], {
    type:
      format === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  let filename = `project-${projectId}.${format}`;
  const cd = response.headers?.["content-disposition"] || response.headers?.["Content-Disposition"];
  if (cd) {
    const m = /filename\*?=(?:UTF-8'')?["']?([^;"']+)/i.exec(cd);
    if (m && m[1]) filename = decodeURIComponent(m[1]);
  }

  return { blob, filename };
}

export default api;
export { generateItem, refineItem, saveItem, exportProject };
