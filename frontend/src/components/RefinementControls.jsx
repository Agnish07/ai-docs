// src/components/RefinementControls.jsx
import React, { useState } from "react";

export default function RefinementControls({ item, onRefine }) {
  const [prompt, setPrompt] = useState("");

  if (!item) return (
    <div className="rc-card">
      <style>{`.rc-card { padding:12px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto; color:#111827; }`}</style>
      <div style={{ fontWeight:700 }}>Select a section to refine</div>
    </div>
  );

  async function submit(e) {
    e.preventDefault();
    if (!prompt.trim()) return alert("Enter a refinement prompt");
    await onRefine(item.id, prompt);
    setPrompt("");
  }

  return (
    <>
      <style>{`
        .rc-root { display:flex; flex-direction:column; gap:10px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto; }
        .rc-title { font-weight:700; }
        .rc-textarea { width:100%; min-height:100px; padding:8px; border-radius:8px; border:1px solid rgba(0,0,0,0.06); resize:vertical; font-size:14px; }
        .rc-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:8px; }
        .rc-button { padding:8px 12px; background: linear-gradient(180deg,#ff6b6b,#ff4d4d); color:#fff; border-radius:8px; border:0; font-weight:700; cursor:pointer; }
        .rc-hint { color:#6b7280; font-size:13px; }
      `}</style>

      <div className="rc-root">
        <div className="rc-title">Refine: {item.title}</div>

        <form onSubmit={submit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "Make this more formal; shorten to 120 words"'
            className="rc-textarea"
            aria-label="Refinement prompt"
          />
          <div className="rc-row">
            <div>
              <button className="rc-button" type="submit">Send to AI</button>
            </div>
            <div className="rc-hint">Like / Dislike buttons coming later</div>
          </div>
        </form>
      </div>
    </>
  );
}
