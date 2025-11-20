// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import api from "../api";
import CreateProjectModal from "../components/CreateProjectModal";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

// local logo image you provided (used in header)
const LOGO_PATH = "/mnt/data/7bdc7eda-19fb-4ee1-ab9a-1ef6157aed88.png";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await api.get("/projects");
      // support both res.data being [] or { projects: [...] }
      const data = res.data ?? [];
      const list = Array.isArray(data) ? data : data.projects ?? data.items ?? [];
      // keep stable ordering if your items include `order`
      const sorted = Array.from(list).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setProjects(sorted);
    } catch (err) {
      console.error("loadProjects", err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate(payload) {
    try {
      const res = await api.post("/projects", payload);
      setShowNew(false);
      // assume returned project
      const project = res.data ?? res;
      const id = project?.id || project?.project?.id || (Array.isArray(project) && project[0]?.id);
      // reload list and navigate if created id present
      await loadProjects();
      if (id) navigate(`/projects/${id}`);
      else navigate("/dashboard");
    } catch (err) {
      console.error("create project", err);
      alert("Failed to create project");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;

    try {
      // call backend DELETE endpoint
      await api.delete(`/projects/${id}`);

      // remove locally without refetching for snappy UI
      setProjects((prev) => prev.filter((p) => p.id !== id));

      // If user happens to be viewing the project route, navigate them away:
      // (Optional) if your router tracks current project, you could check and redirect.
      // We'll just ensure we end up on dashboard (no-op if already there).
      navigate("/dashboard");
    } catch (err) {
      console.error("delete project", err);
      // best-effort helpful messages
      const status = err?.response?.status ?? null;
      if (status === 401 || status === 403) {
        alert("Not authorized to delete this project. Make sure you're signed in and own the project.");
      } else if (status === 404) {
        alert("Project not found (already deleted).");
        // remove from local list too
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete project. Check console for details.");
      }
    }
  }

  function handleLogout() {
    auth.signOut().then(() => window.location.replace("/"));
  }

  return (
    <>
      <style>{`
        /* Dashboard styles — follow anime-red Gen-Z theme and account for fixed navbar */
        :root {
          --primary: #FF5A5A;
          --muted: #6b5151;
          --card-bg: #fff;
          --page-bg: #fff7f6;
          --border: rgba(107,81,81,0.06);
          --nav-height: 72px; /* matches navbar compact height; overridden if App measures dynamically */
        }

        .dashboard-wrap {
          /* push content below the fixed navbar */
          padding-top: var(--nav-height, 72px);
          min-height: calc(100vh - var(--nav-height, 72px));
          background: var(--page-bg);
          padding-left: 28px;
          padding-right: 28px;
          padding-bottom: 60px;
          box-sizing: border-box;
          font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          color: var(--muted);
        }

        .dashboard-inner {
          max-width: 1100px;
          margin: 24px auto;
        }

        .header {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .header-left {
          display:flex;
          align-items:center;
          gap:14px;
        }

        .brand-badge {
          width:56px;
          height:56px;
          border-radius:12px;
          background-image: url('${LOGO_PATH}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          border: 2px solid rgba(255,255,255,0.95);
          box-shadow: 0 16px 40px rgba(255,90,90,0.06);
          flex-shrink:0;
        }

        .header-title {
          display:flex;
          flex-direction:column;
        }

        .header-title h2 {
          margin:0;
          font-size:22px;
          font-weight:800;
          color: #2f1f1f;
          letter-spacing: 0.2px;
        }

        .header-sub {
          margin-top:4px;
          color: #8b6b6b;
          font-size:13px;
        }

        .header-actions {
          display:flex;
          gap:10px;
          align-items:center;
        }

        .button {
          appearance: none;
          border: 0;
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(180deg, #ff6b6b, #ff4d4d);
          color: white;
          box-shadow: 0 10px 28px rgba(255,90,90,0.12);
        }

        .button.secondary {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--muted);
          font-weight: 700;
          box-shadow: none;
        }

        .project-grid {
          display:grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap:16px;
        }

        .card {
          background: var(--card-bg);
          border-radius: 12px;
          padding: 16px;
          border: 1px solid var(--border);
          box-shadow: 0 12px 30px rgba(0,0,0,0.04);
        }

        .card h3 {
          margin:0;
          font-size:16px;
          font-weight:800;
          color: #2f1f1f;
        }

        .card .meta {
          margin-top:8px;
          font-size:13px;
          color:#7a5a5a;
        }

        .card-actions {
          display:flex;
          gap:8px;
          align-items:center;
        }

        .open-btn {
          padding:8px 12px;
          border-radius:10px;
          border: 1px solid rgba(0,0,0,0.06);
          background: white;
          cursor:pointer;
          font-weight:700;
        }

        .delete-btn {
          padding:8px 12px;
          border-radius:10px;
          border: 1px solid rgba(0,0,0,0.06);
          background: #fff1f0;
          color: #D14836;
          cursor:pointer;
          font-weight:700;
        }

        /* Empty-state styling */
        .empty {
          display:flex;
          gap:20px;
          align-items:center;
          justify-content:center;
          padding: 28px;
          border-radius:12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.95));
          border: 1px solid var(--border);
        }
        .empty-img {
          width:140px;
          height:140px;
          border-radius:12px;
          background-image: url('${LOGO_PATH}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          filter: saturate(.9) brightness(1.03);
          box-shadow: 0 18px 46px rgba(255,90,90,0.06);
        }
        .empty-text {
          max-width:520px;
        }
        .empty-text h4 {
          margin:0 0 8px 0;
          font-size:18px;
          color:#2f1f1f;
        }
        .empty-text p {
          margin:0;
          color:#7b5656;
        }

        /* small screens */
        @media (max-width:720px) {
          .header { flex-direction: column; align-items: flex-start; gap:12px; }
          .header-actions { width:100%; justify-content:flex-start; }
          .brand-badge { width:48px; height:48px; }
        }
      `}</style>

      <div className="dashboard-wrap">
        <div className="dashboard-inner">
          <div className="header">
            <div className="header-left">
              <div className="brand-badge" aria-hidden />
              <div className="header-title">
                <h2>Projects</h2>
                <div className="header-sub">Create and manage documents</div>
              </div>
            </div>

            <div className="header-actions">
              <button className="button" onClick={() => setShowNew(true)}>New Project</button>
              <button className="button secondary" onClick={handleLogout}>Logout</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {projects.length === 0 && !loading && (
              <div className="empty" role="status" aria-live="polite">
                <div className="empty-img" aria-hidden />
                <div className="empty-text">
                  <h4>No projects yet</h4>
                  <p>Click <strong>New Project</strong> to create your first document. You can also import content or use templates later.</p>
                </div>
              </div>
            )}

            {loading && <div style={{ textAlign: "center", color: "#7a5a5a", padding: 12 }}>Loading projects…</div>}

            <div className="project-grid" aria-live="polite">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#2f1f1f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || "Untitled"}</div>
                    <div style={{ color: "#7a5a5a", fontSize: 13, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(p.doc_type || "DOC").toUpperCase()} • {(p.main_prompt || "").slice(0, 80)}</div>
                  </div>

                  <div className="card-actions" style={{ marginLeft: 12 }}>
                    <button className="open-btn" onClick={() => navigate(`/projects/${p.id}`)}>Open</button>

                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(p.id)}
                      title="Delete project"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showNew && <CreateProjectModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </>
  );
}
