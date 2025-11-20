// frontend/src/components/CreateProjectModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * CreateProjectModal (portal)
 * - renders into document.body so it always overlays the navbar
 * - has bordery inputs + placeholders
 * - blocks background scroll while open
 * - closes on overlay click or Escape
 *
 * Usage:
 * <CreateProjectModal onClose={...} onCreate={...} />
 */

export default function CreateProjectModal({ onClose = () => {}, onCreate = () => {} }) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("DOCX");
  const [prompt, setPrompt] = useState("");
  const [outline, setOutline] = useState(["Introduction", "Body", "Conclusion"]);

  // lock scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // close on Escape
  const onEsc = useCallback((e) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onEsc]);

  function addOutline() {
    setOutline((s) => [...s, `Section ${s.length + 1}`]);
  }
  function updateOutline(i, v) {
    setOutline((s) => s.map((x, idx) => (idx === i ? v : x)));
  }
  function removeOutline(i) {
    setOutline((s) => s.filter((_, idx) => idx !== i));
  }

  async function submit(e) {
    e.preventDefault();
    const config = docType === "DOCX" ? { outline } : { slides: outline };
    const payload = { title: title || "Untitled Project", doc_type: docType, main_prompt: prompt, config };
    onCreate(payload);
  }

  const content = (
    <>
      <style>{`
        /* Portal modal styles — very high z-index */
        .modal-portal-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(2,6,23,0.44);
          z-index: 2200; /* > navbar (navbar was 999) */
          -webkit-font-smoothing: antialiased;
        }

        .modal-card {
          width: 100%;
          max-width: 780px;
          margin: 20px;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 30px 80px rgba(15,15,15,0.36);
          padding: 18px;
          box-sizing: border-box;
          max-height: calc(100vh - 64px);
          overflow: auto;
          border: 1px solid rgba(0,0,0,0.06);
        }

        .modal-header {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom: 8px;
        }
        .modal-title {
          font-weight:800;
          font-size:18px;
          color:#2d1f1f;
          margin:0;
        }
        .modal-close {
          background: transparent;
          border: 0;
          font-size:20px;
          cursor:pointer;
          color:#7a5555;
        }

        .modal-body { padding-top: 6px; }
        .field { margin-bottom: 14px; display:flex; flex-direction:column; gap:8px; }

        .label { font-weight:700; color:#3b2a2a; font-size:13px; }

        .input {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1.6px solid rgba(0,0,0,0.08);
          font-size: 14px;
          outline: none;
          background: #fff;
        }
        .input:focus {
          border-color: #ff5a5a;
          box-shadow: 0 8px 26px rgba(255,90,90,0.08);
        }
        textarea.input { min-height: 96px; resize: vertical; }

        .radio-row { display:flex; gap:18px; align-items:center; }

        .outline {
          background: #fafafa;
          border-radius:10px;
          padding:10px;
          border: 1px solid rgba(0,0,0,0.04);
        }
        .outline-item {
          display:flex;
          gap:8px;
          align-items:center;
          margin-bottom:8px;
        }
        .outline-item:last-child { margin-bottom:0; }

        .outline-item .outline-input {
          flex:1;
          padding:8px 10px;
          border-radius:8px;
          border:1px solid rgba(0,0,0,0.06);
          font-weight:600;
        }
        .outline-actions button {
          padding:8px 10px;
          border-radius:8px;
          border: 1px solid rgba(0,0,0,0.06);
          background:#fff;
          cursor:pointer;
          font-weight:700;
        }

        .modal-footer {
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:12px;
        }
        .btn {
          padding:10px 14px;
          border-radius:8px;
          font-weight:800;
          cursor:pointer;
          border:0;
        }
        .btn.secondary {
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          color:#423636;
        }
        .btn.primary {
          background: linear-gradient(180deg,#ff6b6b,#ff4d4d);
          color:#fff;
          box-shadow: 0 10px 28px rgba(255,90,90,0.12);
        }

        @media (max-width:720px) {
          .modal-card { margin: 12px; max-width: calc(100% - 24px); padding: 14px; }
          .modal-title { font-size:16px; }
        }
      `}</style>

      <div
        className="modal-portal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Create project"
        onMouseDown={(e) => {
          // close when clicking the overlay (but not when clicking inside the card)
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="modal-card"
          onMouseDown={(e) => {
            // prevent overlay handler from firing when clicking inside
            e.stopPropagation();
          }}
        >
          <div className="modal-header">
            <h3 className="modal-title text-4xl text-[#ff6b6b]">Create Project</h3>
            <div>
              <button
                className="modal-close"
                onClick={onClose}
                aria-label="Close"
                type="button"
              >
                ×
              </button>
            </div>
          </div>

          <form onSubmit={submit}>
            <div className="modal-body">
              <div className="field">
                <label className="label">Title</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Market analysis of EV industry in 2025"
                  required
                />
              </div>

              <div className="field">
                <div className="label">Type</div>
                <div className="radio-row" role="radiogroup" aria-label="Document type">
                  <label style={{display:"flex", gap:8, alignItems:"center", cursor:"pointer"}}>
                    <input type="radio" name="docType" checked={docType==="DOCX"} onChange={()=>setDocType("DOCX")} />
                    <span style={{fontWeight:700}}>Word (.docx)</span>
                  </label>
                  <label style={{display:"flex", gap:8, alignItems:"center", cursor:"pointer"}}>
                    <input type="radio" name="docType" checked={docType==="PPTX"} onChange={()=>setDocType("PPTX")} />
                    <span style={{fontWeight:700}}>PowerPoint (.pptx)</span>
                  </label>
                </div>
              </div>

              <div className="field">
                <label className="label">Main prompt / Topic</label>
                <textarea
                  className="input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Analysis of anime consumption & exposure in India"
                />
              </div>

              <div className="field">
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div className="label" style={{margin:0}}>Outline / Slides</div>
                  <div>
                    <button type="button" onClick={addOutline} className="btn primary" style={{padding:"8px 12px", borderRadius:8}}>Add</button>
                  </div>
                </div>

                <div className="outline" aria-live="polite">
                  {outline.map((o, i) => (
                    <div className="outline-item" key={i}>
                      <input
                        className="outline-input"
                        value={o}
                        onChange={(e) => updateOutline(i, e.target.value)}
                        placeholder={`e.g. Slide ${i+1}: Topic`}
                      />
                      <div className="outline-actions">
                        <button type="button" onClick={() => removeOutline(i)} aria-label={`Remove item ${i+1}`}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn primary">Create</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
