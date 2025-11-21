// frontend/src/Login.jsx
import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { login, register } from "./auth";
import api from "./api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resp, setResp] = useState(null);

  const navigate = useNavigate();

  // Redirect when user logs in
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        navigate("/dashboard");
      }
    });
    return () => unsub();
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    try {
      await register(email, password);
    } catch (err) {
      alert(err.message);
    }
  }

  async function callGenerateTest() {
    try {
      const r = await api.post("/generate-test", {
        prompt: "Hello from frontend",
      });
      setResp(JSON.stringify(r.data, null, 2));
    } catch (err) {
      setResp(err?.response?.data || err.message);
    }
  }

  return (
    <>
      {/* Local component styles — anime red theme (no global CSS changes) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;600;800&display=swap');

        :root{
          --primary: #FF5A5A;   /* anime red */
          --primary-600: #E85B5B;
          --white: #FFFFFF;
          --bg: #FFF7F5;       /* soft page bg */
          --card: #FFFFFF;
          --muted: #5b3f3f;
          --border: rgba(88,50,50,0.08);
          --shadow: rgba(0,0,0,0.08);
        }

        /* page wrapper */
        .login-page {
          min-height: calc(100vh - 0px);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          padding: 48px 20px;
          font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          color: var(--muted);
        }

        /* container card */
        .login-card {
          width: 100%;
          max-width: 520px;
          background: var(--card);
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 18px 40px var(--shadow), inset 0 1px 0 rgba(255,255,255,0.6);
          border: 1px solid var(--border);
        }

        /* header */
        .login-header {
          display:flex;
          align-items:center;
          gap:16px;
          margin-bottom: 18px;
        }
        .login-logo {
          width:56px;
          height:56px;
          border-radius:12px;
          background-image: url('/mnt/data/69aa6a4e-d72a-431c-8e43-7acdde3f75aa.png');
          background-size: cover;
          background-position: center;
          box-shadow: 0 10px 26px rgba(255,90,90,0.08), inset 0 -6px 10px rgba(255,255,255,0.04);
          border: 2px solid rgba(255,255,255,0.75);
          flex-shrink:0;
        }
        .brand-title {
          font-family: "Space Grotesk", "Inter", system-ui;
          color: var(--primary);
          font-weight: 700;
          font-size: 1.35rem;
          letter-spacing: 0.3px;
        }
        .brand-sub {
          font-size: 0.9rem;
          color: #7a5353;
          margin-top: 2px;
        }

        /* form */
        form { margin-top: 6px; }
        .field {
          display:block;
          margin-bottom: 12px;
        }

        input[type="text"],
        input[type="password"],
        input[type="email"] {
          width:100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--border);
          background: transparent;
          font-size: 0.98rem;
          color: var(--muted);
          outline: none;
          transition: box-shadow .12s ease, border-color .12s ease, transform .08s ease;
        }
        input::placeholder { color: rgba(91,63,63,0.4); }

        input:focus {
          border-color: var(--primary);
          box-shadow: 0 8px 26px rgba(255,90,90,0.06);
          transform: translateY(-1px);
        }

        /* button row */
        .btn-row {
          display:flex;
          gap:10px;
          margin-top: 6px;
        }

        .btn-primary {
          background: var(--primary);
          color: var(--white);
          padding: 11px 16px;
          border-radius: 10px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(255,90,90,0.12);
          transition: transform .12s ease, box-shadow .12s ease;
          flex: 1;
        }
        .btn-primary:hover { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(255,90,90,0.16); }

        .btn-ghost {
          background: transparent;
          color: var(--muted);
          padding: 11px 14px;
          border-radius: 10px;
          border: 1.5px solid var(--border);
          cursor: pointer;
          flex: 1;
          font-weight: 600;
        }
        .btn-ghost:hover {
          background: rgba(0,0,0,0.02);
          transform: translateY(-2px);
        }

        /* protected api area */
        .api-area { margin-top:22px; display:flex; gap:12px; align-items:flex-start; flex-direction:column; }
        .api-controls { display:flex; gap:10px; width:100%; }
        .api-pre {
          background: #fff7f7;
          color: #4a2e2e;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.03);
          width:100%;
          white-space: pre-wrap;
        }

        /* small text links */
        .muted {
          color: #7b5858;
          font-size: 0.9rem;
        }

        /* responsive */
        @media (max-width:520px) {
          .login-card { padding: 18px; border-radius: 12px; }
          .brand-title { font-size: 1.12rem; }
          .login-logo { width:48px; height:48px; }
        }
      `}</style>

      <div className="login-page">
        <div className="login-card" role="region" aria-label="Login form">
          <div className="login-header">
            <div className="login-logo" aria-hidden />
            <div>
              <div className="brand-title">Ocean</div>
              <div className="brand-sub">Sign in to your workspace</div>
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="btn-row">
              <button className="btn-primary" onClick={handleLogin}>
                Login
              </button>
              <button className="btn-ghost" onClick={handleRegister}>
                Register
              </button>
            </div>
          </form>

          {/* Optional — test the backend protected endpoint */}
          <div className="api-area">
            

            {resp && <pre className="api-pre">{resp}</pre>}
          </div>
        </div>
      </div>
    </>
  );
}