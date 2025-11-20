// src/components/ItemEditor.jsx
import React, { useEffect, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * ItemEditor
 * Props:
 * - projectId, itemId
 * - initialStruct: { sections: [{ heading, content_md }] }
 * - onSave(savedContentString)    <-- REQUIRED
 * - onClose()
 */
export default function ItemEditor({ projectId, itemId, onClose = () => {}, initialStruct, onSave }) {
  const initialHeading = initialStruct?.sections?.[0]?.heading ?? "";
  const initialContent = initialStruct?.sections?.[0]?.content_md ?? "";

  const [heading, setHeading] = useState(initialHeading);
  const [contentMd, setContentMd] = useState(initialContent);
  const [previewHtml, setPreviewHtml] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHeading(initialStruct?.sections?.[0]?.heading ?? "");
    setContentMd(initialStruct?.sections?.[0]?.content_md ?? "");
  }, [initialStruct]);

  useEffect(() => {
    try {
      const html = marked.parse(contentMd || "");
      setPreviewHtml(DOMPurify.sanitize(html));
    } catch (e) {
      setPreviewHtml("<p>(Preview error)</p>");
    }
  }, [contentMd]);

  async function handleSave() {
    if (!onSave) {
      alert("Save handler not provided");
      return;
    }
    setBusy(true);
    try {
      const contentString = JSON.stringify({ title: "", sections: [{ heading, content_md: contentMd }] });
      await Promise.resolve(onSave(contentString));
    } catch (err) {
      console.error("Save failed (editor)", err);
      alert("Save failed: " + (err?.message || ""));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      if (typeof window.generateItem === "function") {
        const resp = await window.generateItem(projectId, itemId);
        const md = resp?.parsed?.content_md ?? resp?.generated_raw ?? "";
        const hd = resp?.parsed?.heading ?? heading;
        setContentMd(md);
        setHeading(hd);
      } else {
        alert("Generation not available from editor — use the Outline Generate button.");
      }
    } catch (err) {
      console.error("Generate failed (editor)", err);
      alert("Generate failed: " + (err?.message || ""));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefine(instruction) {
    if (!instruction) return;
    setBusy(true);
    try {
      if (typeof window.refineItem === "function") {
        const resp = await window.refineItem(projectId, itemId, instruction);
        const md = resp?.parsed?.content_md ?? resp?.refined_raw ?? "";
        const hd = resp?.parsed?.heading ?? heading;
        setContentMd(md);
        setHeading(hd);
      } else {
        alert("Refine not available from editor — use the Refine panel.");
      }
    } catch (err) {
      console.error("Refine failed (editor)", err);
      alert("Refine failed: " + (err?.message || ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{`
        .ie-root { font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#111827; }
        .ie-topbar { display:flex; gap:12px; align-items:center; margin-bottom:12px; }
        .ie-heading { flex:1; display:flex; gap:12px; align-items:center; }
        .ie-title-input { font-weight:800; font-size:16px; padding:10px 12px; border-radius:10px; border:1.2px solid rgba(0,0,0,0.06); outline:none; width:100%; background:#fff; }
        .ie-title-input:focus { box-shadow: 0 8px 26px rgba(255,90,90,0.06); border-color:#ff5a5a; }
        .ie-btn { padding:9px 12px; border-radius:10px; border:0; font-weight:800; cursor:pointer; color:#fff; }
        .ie-btn.primary { background: linear-gradient(180deg,#ff6b6b,#ff4d4d); box-shadow: 0 10px 28px rgba(255,90,90,0.12); }
        .ie-btn.ghost { background: transparent; color:#374151; border: 1px solid rgba(0,0,0,0.06); font-weight:700; padding:8px 10px; }
        .ie-btn.warn { background:#ffb4b4; color:#5a1b1b; font-weight:700; }
        .ie-grid { display:flex; gap:12px; align-items:flex-start; }
        .ie-editor { flex:1; min-width:0; background:#fff; border-radius:12px; border:1px solid rgba(0,0,0,0.06); padding:12px; }
        .ie-textarea { width:100%; min-height:420px; padding:12px; border-radius:10px; border:1.2px solid rgba(0,0,0,0.06); resize:vertical; font-size:14px; line-height:1.6; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace; }
        .ie-textarea:focus { outline:none; border-color:#ff5a5a; box-shadow: 0 8px 26px rgba(255,90,90,0.06); }
        .ie-preview { width:360px; max-width:36%; min-width:240px; border-radius:12px; border:1px solid rgba(0,0,0,0.06); overflow:auto; background: linear-gradient(180deg,#fff,#fff7f7); padding:12px; box-shadow: 0 12px 30px rgba(0,0,0,0.04); }
        .ie-preview h4 { margin:0 0 8px 0; font-size:15px; font-weight:800; color:#2f1f1f; }
        .ie-preview .preview-body { color:#4b3a3a; font-size:14px; line-height:1.6; }
        .ie-controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .ie-disabled { opacity:0.6; pointer-events:none; }
        @media (max-width:1100px) { .ie-grid { flex-direction:column; } .ie-preview { width:100%; max-width:100%; } }
      `}</style>

      <div className="ie-root">
        <div className="ie-topbar" role="toolbar" aria-label="Editor toolbar">
          <div className="ie-heading">
            <input
              aria-label="Section heading"
              className="ie-title-input"
              placeholder="Untitled section — e.g. Market overview"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
            />
          </div>

          <div className={`ie-controls ${busy ? "ie-disabled" : ""}`}>
            <button type="button" className="ie-btn ghost" onClick={() => handleRefine("Make this shorter")} disabled={busy}>
              Shorten
            </button>

            <button type="button" className="ie-btn ghost" onClick={() => handleRefine("Make this more formal")} disabled={busy}>
              Formal
            </button>

            <button type="button" className="ie-btn warn" onClick={handleGenerate} disabled={busy}>
              {busy ? "Generating…" : "Regenerate"}
            </button>

            <button type="button" className="ie-btn primary" onClick={handleSave} disabled={busy} title="Save (saves current content to server)">
              {busy ? "Saving…" : "Save"}
            </button>

            <button type="button" className="ie-btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="ie-grid" role="application">
          <div className="ie-editor" aria-label="Editor">
            <textarea
              className="ie-textarea"
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              placeholder="Write markdown here. Use headings, lists, code blocks, etc. Example: `## Summary` followed by the content."
            />
          </div>

          <aside className="ie-preview" aria-label="Preview">
            <h4>Preview</h4>
            <div className="preview-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </aside>
        </div>
      </div>
    </>
  );
}
