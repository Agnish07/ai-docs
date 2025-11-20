// frontend/src/api.js
import axios from "axios";
import { auth } from "./firebase";

/**
 * API client
 * - baseURL: VITE_API_URL if provided.
 *   Otherwise: if running on localhost, point to http://localhost:8000/api/v1
 *   else use relative '/api/v1' so Vite proxy or production paths work.
 * - timeout: 20s
 * - interceptors add auth token when available and normalize network errors
 */

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

// attach firebase token if logged in
api.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      // don't block requests if token fetch fails — log and continue
      // console.warn("Failed to attach auth token", err);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// friendly error for network issues and consistent error shape
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // If it's a network error (no response)
    if (error.isAxiosError && !error.response) {
      // create a clearer error to surface to UI
      const netErr = new Error("Network Error: failed to reach API server");
      netErr.code = "NETWORK_ERROR";
      netErr.original = error;
      return Promise.reject(netErr);
    }
    // else forward backend error
    return Promise.reject(error);
  }
);

/* ---- API helpers ---- */

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

// saveItem: use PATCH (non-breaking) since other code uses patch
async function saveItem(projectId, itemId, payload) {
  // try PATCH first, fallback to PUT if server expects it
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

// exportProject: returns a Blob and suggested filename helper
async function exportProject(projectId, format = "docx") {
  const path =
    format === "pptx"
      ? `/projects/${projectId}/export/pptx`
      : `/projects/${projectId}/export/docx`;

  const response = await api.get(path, { responseType: "arraybuffer" });
  // return a blob and content-disposition filename if present
  const blob = new Blob([response.data], {
    type:
      format === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  // parse filename from headers (if backend sends Content-Disposition)
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
