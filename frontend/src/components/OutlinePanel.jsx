// src/components/OutlinePanel.jsx
import React from "react";

export default function OutlinePanel({ items = [], activeId, onSelect, onGenerate, generatingId = null }) {
  return (
    <>
      <style>{`
        .op-root { display:flex; flex-direction:column; gap:10px; }
        .op-title { font-weight:700; font-size:15px; }
        .op-list { display:flex; flex-direction:column; gap:8px; max-height:72vh; overflow:auto; padding-right:6px; }
        .op-item { display:flex; justify-content:space-between; align-items:center; padding:10px; border-radius:8px; transition: background .12s ease, transform .06s ease; }
        .op-item:hover { transform: translateY(-1px); }
        .op-item.active { background: #eef2ff; box-shadow: 0 6px 18px rgba(59,130,246,0.06); }
        .op-left { cursor:pointer; min-width:0; }
        .op-title-line { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow: ellipsis; max-width:160px; }
        .op-sub { font-size:12px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow: ellipsis; max-width:160px; }
        .op-actions { display:flex; gap:8px; align-items:center; }
        .op-gen-btn { background: linear-gradient(180deg,#ff6b6b,#ff4d4d); color: white; border: none; padding:6px 10px; border-radius:8px; font-weight:700; cursor:pointer; }
        .op-gen-btn[disabled] { opacity:0.65; cursor:not-allowed; transform:none; }
        .generating-badge { display:inline-block; margin-left:8px; padding:4px 8px; border-radius:999px; background:#f3f4f6; color:#111; font-weight:700; font-size:12px; }
      `}</style>

      <div className="op-root">
        <div className="op-title">Outline</div>
        <div className="op-list" role="list">
          {items.map((it) => {
            const active = it.id === activeId;
            const isGenerating = generatingId !== null && generatingId === it.id;
            return (
              <div
                key={it.id}
                role="listitem"
                className={`op-item ${active ? "active" : ""}`}
                aria-current={active ? "true" : "false"}
              >
                <div className="op-left" onClick={() => onSelect(it.id)}>
                  <div className="op-title-line">{it.title || "Untitled"}</div>
                  <div className="op-sub">{(it.content || "").replace(/\n/g, " ").slice(0, 90)}</div>
                </div>
                <div className="op-actions">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onGenerate(it.id); }}
                    className="op-gen-btn"
                    title="Generate content for this section"
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating…" : "Gen"}
                  </button>

                  {isGenerating && <span className="generating-badge">Working</span>}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div style={{ color: "#6b7280" }}>No sections yet</div>}
        </div>
      </div>
    </>
  );
}
