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


  // NEW: track which item is currently generating
  const [generatingItemId, setGeneratingItemId] = useState(null);

  function sortItems(items) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

  async function loadProject() {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}`);
      const payload = res.data || {};
      setProject(payload.project || payload);
      const loadedItems = payload.items || payload;
      setItems(sortItems(loadedItems || []));
      if (loadedItems && loadedItems.length) {
        const initialId = loadedItems[0].id;
        setSelectedItemId((prev) => prev || initialId);
        if (!selectedItemId) {
          setSelectedItemStruct(parseItemContentToStruct(loadedItems[0]));
        }
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
  if (!item || !item.content) {
    return { sections: [{ heading: item?.title || "", content_md: "" }] };
  }

  // Case 1 — Content is a JSON string
  try {
    const parsed = JSON.parse(item.content);

    // If backend already returned the correct structured JSON
    if (parsed.sections) {
      return parsed;
    }

    // If backend returned {heading, content_md}
    if (parsed.heading || parsed.content_md) {
      return { sections: [parsed] };
    }

    // Fallback: convert JSON to single markdown block
    return { sections: [{ heading: item.title || "", content_md: item.content }] };
  } catch (e) {
    // Case 2 — Content is NOT JSON (just raw text from backend)
    return {
      sections: [
        {
          heading: item.title || "",
          content_md: item.content, // <-- SHOW RAW CONTENT
        }
      ]
    };
  }
}


  function updateItemContentLocal(itemId, newContentString) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, content: newContentString } : it)));
  }

  // REPLACED: improved handleGenerate with status + error handling
  async function handleGenerate(itemId) {
    if (!projectId || !itemId) {
      alert("Project or item missing");
      return;
    }

    // prevent double clicks
    if (generatingItemId) {
      console.log("Already generating", generatingItemId);
      return;
    }

    setGeneratingItemId(itemId);

    try {
      console.log("Calling generate for", itemId);
      const resp = await api.post(`/projects/${projectId}/items/${itemId}/generate`);
      console.log("Generate response:", resp?.data ?? resp);

      // Backend returns { generated_raw, parsed, item } in your earlier items.py — refresh UI
      // If backend responds with parsed content, update local item content to reflect it immediately
      const data = resp.data || resp;
      if (data && data.parsed) {

  let sections = [];

  // Full structured format
  if (data.parsed.sections) {
    sections = data.parsed.sections;

  // Minimal format {heading, content_md}
  } else if (data.parsed.heading || data.parsed.content_md) {
    sections = [{ heading: data.parsed.heading || "", content_md: data.parsed.content_md || "" }];
  }

  // Raw text fallback
  // fallback: backend returned ONLY generated_raw (plain text)
else if (data.generated_raw) {
  const rawText = data.generated_raw;

  const newContentString = JSON.stringify({
    sections: [
      {
        heading: selectedItem?.title || "",
        content_md: rawText
      }
    ]
  });

  updateItemContentLocal(itemId, newContentString);
  setSelectedItemId(itemId);
  setSelectedItemStruct({
    sections: [
      { heading: selectedItem?.title || "", content_md: rawText }
    ]
  });
}


  const newContentString = JSON.stringify({ sections });
  updateItemContentLocal(itemId, newContentString);
  setSelectedItemId(itemId);
  setSelectedItemStruct({ sections });
}


      // Always reload project list to pick up any server-side changes (IDs, content, etc)
      await loadProject();
      setItems((prev) => sortItems(prev));
      alert("Generation complete");
    } catch (err) {
      console.error("Generate failed:", err);

      const status = err?.response?.status ?? null;
      if (status === 401 || status === 403) {
        alert("Not authorized. Your session may have expired. Please sign in again.");
      } else if (status === 404) {
        alert("Generate endpoint not found (404). Check backend route for /generate.");
      } else {
        // show backend message if available
        const msg = err?.response?.data ? JSON.stringify(err.response.data) : err?.message || String(err);
        alert("Generate failed: " + msg);
      }
    } finally {
      setGeneratingItemId(null);
    }
  }

  // keep handleDownload as you supplied earlier (not repeated here to reduce length)
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
      if (!resp || !resp.data) throw new Error("Empty response from export endpoint");

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
        setItems((prev) => sortItems(prev));

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
      setItems((prev) => sortItems(prev));
      const fakeItem = { id: itemId, content, title: items.find(i => i.id === itemId)?.title || "" };
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
    const it = items.find((x) => x.id === id);
    setSelectedItemStruct(parseItemContentToStruct(it));
  }

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

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

        /* small indicator for generating item (used in OutlinePanel) */
        .generating-badge { display:inline-block; margin-left:8px; padding:4px 8px; border-radius:999px; background:#f3f4f6; color:#111; font-weight:700; font-size:12px; }
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
            generatingId={generatingItemId}          /* NEW prop */
            onSelect={(id) => handleSelect(id)}
            onGenerate={(id) => handleGenerate(id)}
          />
        </div>

        <div className="pp-card">
          {selectedItem ? (
            <ItemEditor
              projectId={projectId}
              itemId={selectedItem.id}
              initialStruct={selectedItemStruct}
              onSave={(savedContent) => handleSaveContent(selectedItem.id, savedContent)}
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
