// src/pages/ProjectPage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import OutlinePanel from "../components/OutlinePanel";
import ItemEditor from "../components/ItemEditor";
import RefinementControls from "../components/RefinementControls";
import api from "../api";

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemStruct, setSelectedItemStruct] = useState(null);
  const [loading, setLoading] = useState(false);

  const [exportFormat, setExportFormat] = useState("docx");
  const [exporting, setExporting] = useState(false);

  async function loadProject() {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}`);
      const payload = res.data || {};
      setProject(payload.project || payload);
      const loadedItems = payload.items || payload.items_list || payload || [];
      setItems(Array.isArray(loadedItems) ? loadedItems : []);
      if (Array.isArray(loadedItems) && loadedItems.length) {
        const initialId = loadedItems[0].id ?? loadedItems[0]._id;
        setSelectedItemId((prev) => prev || initialId);
        if (!selectedItemId) {
          setSelectedItemStruct(parseItemContentToStruct(loadedItems[0]));
        }
      } else {
        setSelectedItemId(null);
        setSelectedItemStruct(null);
      }
    } catch (err) {
      console.error("loadProject", err);
      alert("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function parseItemContentToStruct(item) {
    if (!item) return null;
    try {
      const parsed = item.content ? JSON.parse(item.content) : null;
      if (parsed && parsed.sections) return parsed;
      return { sections: [{ heading: item.title || "", content_md: item.content || "" }] };
    } catch (e) {
      return { sections: [{ heading: item.title || "", content_md: item.content || "" }] };
    }
  }

  function updateItemContentLocal(itemId, newContentString) {
    setItems((prev) => prev.map((it) => (String(it.id ?? it._id) === String(itemId) ? { ...it, content: newContentString } : it)));
  }

  // --- NEW: handleGenerate implementation ---
  // Tries the most-likely backend route and updates UI on success.
  async function handleGenerate(itemId) {
    if (!projectId || !itemId) return;
    setLoading(true);
    try {
      // Primary: POST /projects/:projectId/items/:itemId/generate
      let res;
      try {
        res = await api.post(`/projects/${projectId}/items/${itemId}/generate`);
        console.log("generate response (items/:id/generate):", res.status, res.data);
      } catch (errPrimary) {
        console.warn("Primary generate failed, trying fallback patterns:", errPrimary?.response?.status, errPrimary?.response?.data);

        // Fallback 1: POST /projects/:projectId/items with { action: 'generate', item_id }
        try {
          res = await api.post(`/projects/${projectId}/items`, { action: "generate", item_id: itemId });
          console.log("generate response (items POST fallback):", res.status, res.data);
        } catch (errFallback1) {
          console.warn("Fallback POST /items failed:", errFallback1?.response?.status, errFallback1?.response?.data);

          // Fallback 2: POST /projects/:projectId/generate with { item_id }
          try {
            res = await api.post(`/projects/${projectId}/generate`, { item_id: itemId });
            console.log("generate response (project-level fallback):", res.status, res.data);
          } catch (errFallback2) {
            console.warn("All generate attempts failed", errFallback2?.response?.status, errFallback2?.response?.data);
            throw errFallback2;
          }
        }
      }

      // If we get here, `res` should be defined
      const data = res?.data ?? {};
      // Backends vary: updated item may come back as `item`, `updated`, `generated`, or the endpoint may return raw text.
      const updatedItem =
        data.item || data.updated || data.generated_item || data.updated_item || null;

      // If we got back an updated item object, merge it into items
      if (updatedItem && (updatedItem.id || updatedItem._id)) {
        const idKey = updatedItem.id ?? updatedItem._id;
        const contentStr = updatedItem.content ?? updatedItem.content_md ?? JSON.stringify({ sections: updatedItem.sections ?? [] });
        setItems((prev) => prev.map((it) => (String(it.id ?? it._id) === String(idKey) ? { ...it, ...updatedItem, content: contentStr } : it)));
        // update selected struct if currently selected
        if (String(selectedItemId) === String(idKey)) {
          setSelectedItemStruct(parseItemContentToStruct({ id: idKey, content: contentStr, title: updatedItem.title }));
        }
        alert("Generation complete");
        return;
      }

      // If server returned refined/generated raw text
      if (data.generated_raw || data.content || data.refined_raw || typeof data === "string") {
        const raw = data.generated_raw ?? data.refined_raw ?? data.content ?? (typeof data === "string" ? data : null);
        if (raw != null) {
          // convert to a content string (JSON structure) if necessary
          const newContentString = typeof raw === "string" && raw.trim().startsWith("{") ? raw : JSON.stringify({ sections: [{ heading: "", content_md: raw }] });
          updateItemContentLocal(itemId, newContentString);
          if (String(selectedItemId) === String(itemId)) {
            setSelectedItemStruct(parseItemContentToStruct({ id: itemId, content: newContentString }));
          }
          alert("Generation complete");
          return;
        }
      }

      // If the response included the full project payload, reload
      if (data.items || data.project) {
        await loadProject();
        alert("Generation completed (reloaded project)");
        return;
      }

      // If nothing recognizable returned, reload the project to pick up server-side changes
      await loadProject();
      alert("Generation complete (reloaded project)");
    } catch (err) {
      console.error("handleGenerate failed:", err?.response ?? err);
      // Provide helpful message
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        alert("Generate failed: unauthorized (check auth token).");
      } else if (status === 404) {
        alert("Generate route not found (404). Confirm backend implements a generate endpoint for items.");
      } else {
        alert("Generate failed. See console/network tab for details.");
      }
    } finally {
      setLoading(false);
    }
  }
  // --- END handleGenerate ---

  // replace existing handleDownload with this (kept same as you had)
  async function handleDownload() {
    if (!projectId) {
      alert("No project selected to export.");
      return;
    }
    setExporting(true);

    const path =
      exportFormat === "pptx"
        ? `/projects/${projectId}/export/pptx`
        : `/projects/${projectId}/export/docx`;

    try {
      const resp = await api.get(path, { responseType: "arraybuffer" });

      if (!resp || !resp.data) {
        throw new Error("Empty response from export endpoint");
      }

      const isBytes =
        resp.data instanceof ArrayBuffer || typeof resp.data.byteLength === "number";

      if (!isBytes) {
        throw new Error("Export endpoint did not return file bytes");
      }

      const headers = resp.headers || {};
      const disposition = headers["content-disposition"] || headers["Content-Disposition"] || "";
      let filename = (project?.title || `project-${projectId}`).replace(/\s+/g, "_");
      const ext = exportFormat === "pptx" ? ".pptx" : ".docx";

      if (disposition) {
        const m = /filename="?(.*?)"?($|;)/.exec(disposition);
        if (m && m[1]) filename = m[1];
        else filename = filename + ext;
      } else {
        filename = filename + ext;
      }

      const contentType =
        headers["content-type"] ||
        headers["Content-Type"] ||
        (exportFormat === "pptx"
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

      const blob = new Blob([resp.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      console.log("Export download started:", filename);
    } catch (err) {
      console.error("Export request failed:", err);

      const status = (err?.response && err.response.status) || null;

      if (status === 404) {
        alert(
          "Export route not found (404). Make sure backend export router is included and you are calling the correct endpoint.\n\n" +
            "Quick test (run in terminal):\n" +
            `curl -v -X GET "http://localhost:8000/api/v1/projects/${projectId}/export/${exportFormat === "pptx" ? "pptx" : "docx"}" -H "Authorization: Bearer <TOKEN>" -o project.${exportFormat}`
        );
      } else if (status === 401 || status === 403) {
        alert("Export request unauthorized (401/403). Check auth token and that your client sends Authorization header.");
      } else {
        alert("Export failed. Check browser console & backend logs for details.");
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleRefine(itemId, prompt) {
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/items/${itemId}/refine`, { refinement_prompt: prompt });
      const data = res.data ?? res;
      let newStruct = null;

      if (data && data.parsed) {
        if (data.parsed.sections) newStruct = { sections: data.parsed.sections };
        else newStruct = { sections: [{ heading: data.parsed.heading || "", content_md: data.parsed.content_md || (data.refined_raw || "") }] };
      } else if (data && data.refined_raw) {
        newStruct = { sections: [{ heading: "", content_md: data.refined_raw }] };
      }

      if (newStruct) {
        const newContentString = JSON.stringify({ title: project?.main_prompt || "", sections: newStruct.sections });
        updateItemContentLocal(itemId, newContentString);
        setSelectedItemId(itemId);
        setSelectedItemStruct(newStruct);
      } else {
        await loadProject();
      }
    } catch (err) {
      console.error("Refine failed", err);
      alert("Refine failed: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveContent(itemId, content) {
    setLoading(true);
    try {
      await api.patch(`/projects/${projectId}/items/${itemId}`, { content });
      updateItemContentLocal(itemId, content);
      const fakeItem = { id: itemId, content, title: items.find(i => String(i.id ?? i._id) === String(itemId))?.title || "" };
      setSelectedItemStruct(parseItemContentToStruct(fakeItem));
      alert("Saved");
    } catch (err) {
      console.error("Save failed", err);
      alert("Save failed: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(id) {
    setSelectedItemId(id);
    const it = items.find((x) => String(x.id ?? x._id) === String(id));
    setSelectedItemStruct(parseItemContentToStruct(it));
  }

  const selectedItem = items.find((i) => String(i.id ?? i._id) === String(selectedItemId)) || null;

  return (
    <div className="pp-root">
      <style>{`
        .pp-root { padding: 18px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111827; min-height: 100vh; box-sizing: border-box; }
        .pp-header { display:flex; justify-content:space-between; align-items:center; gap: 20px; margin-bottom:18px; }
        .pp-left { display:flex; flex-direction:column; gap:6px; }
        .pp-controls { display:flex; gap:8px; align-items:center; }
        .pp-main-grid { display:grid; grid-template-columns: 260px 1fr 360px; gap: 16px; align-items: start; }
        @media (max-width:1100px) { .pp-main-grid { grid-template-columns: 1fr; } }
        .pp-card { background: #fff; border-radius: 12px; padding: 12px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 8px 18px rgba(16,24,40,0.03); }
        .pp-select { padding:8px 10px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); background:#fff; font-weight:600; }
        .pp-download-btn { padding:8px 12px; border-radius:8px; font-weight:800; cursor:pointer; background: linear-gradient(180deg,#10b981,#059669); color: white; border:none; }
        .pp-download-btn[disabled] { opacity:0.6; cursor:not-allowed; }
      `}</style>

      <div className="pp-header">
        <div className="pp-left">
          <h2 style={{ margin: 0 }}>{project ? project.title : "Loading..."}</h2>
          <div style={{ color: "#6b7280", fontSize: 14 }}>{project?.main_prompt}</div>
        </div>

        <div className="pp-controls" role="toolbar">
          <div style={{ color: "#6b7280", fontSize: 13 }}>{loading ? "Working…" : ""}</div>

          <select
            className="pp-select"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            aria-label="Choose export format"
            title="Choose export format"
          >
            <option value="docx">Download .docx</option>
            <option value="pptx">Download .pptx</option>
          </select>

          <button type="button" className="pp-download-btn" onClick={handleDownload} disabled={exporting || loading}>
            {exporting ? "Exporting…" : "Download"}
          </button>
        </div>
      </div>

      <div className="pp-main-grid">
        <div className="pp-card" style={{ padding: 8 }}>
          <OutlinePanel
            items={items}
            activeId={selectedItemId}
            onSelect={(id) => handleSelect(id)}
            onGenerate={(id) => handleGenerate(id)}
          />
        </div>

        <div className="pp-card">
          {selectedItem ? (
            <ItemEditor
              projectId={projectId}
              itemId={selectedItem.id ?? selectedItem._id}
              initialStruct={selectedItemStruct}
              onSave={(savedContent) => handleSaveContent(selectedItem.id ?? selectedItem._id, savedContent)}
              onClose={() => navigate("/dashboard")}
            />
          ) : (
            <div style={{ padding: 20 }}>Select a section to edit</div>
          )}
        </div>

        <div className="pp-card">
          <RefinementControls item={selectedItem} onRefine={(itemId, prompt) => handleRefine(itemId, prompt)} />
        </div>
      </div>
    </div>
  );
}
