// frontend/src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const u = auth.currentUser;
    if (u) {
      setUser({
        email: u.email,
        uid: u.uid || u.providerData?.[0]?.uid,
        displayName: u.displayName || u.providerData?.[0]?.displayName || null,
        phoneNumber: u.phoneNumber || null,
      });
    }
  }, []);

  async function handleSignOut() {
    try {
      await auth.signOut();
      navigate("/");
    } catch (err) {
      console.error("Sign out failed", err);
      alert("Sign out failed");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;600;700;800&display=swap');

        :root {
          --primary: #ff5a5a;
          --page-bg: #fff7f6;
          --white: #ffffff;
          --muted: #6b5151;
          --border: rgba(0,0,0,0.08);
          --nav-height: 72px;
        }

        .profile-wrap {
          padding-top: var(--nav-height);
          min-height: calc(100vh - var(--nav-height));
          background: var(--page-bg);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 40px 20px;
          box-sizing: border-box;
          font-family: Inter, system-ui;
        }

        .profile-card {
          width: 100%;
          max-width: 720px;
          background: var(--white);
          padding: 32px;
          border-radius: 16px;
          border: 1px solid var(--border);
          box-shadow: 0 30px 60px rgba(255, 90, 90, 0.12);
        }

        .profile-title {
          font-family: "Space Grotesk";
          font-size: 26px;
          font-weight: 800;
          margin: 0;
          color: #2c1c1c;
        }

        .profile-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 14px;
          color: #3b2a2a;
        }

        .label {
          font-weight: 800;
          font-size: 15px;
        }

        .value {
          padding: 10px 12px;
          background: #fafafa;
          border-radius: 10px;
          border: 1.6px solid var(--border);
          font-weight: 600;
          font-size: 14px;
          color: #4b3a3a;
          word-break: break-word;
        }

        .profile-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 30px;
          gap: 10px;
        }

        .btn {
          padding: 10px 16px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          border: 0;
          font-size: 15px;
        }

        .btn.secondary {
          background: #fff;
          border: 1.6px solid var(--border);
          color: var(--muted);
        }

        .btn.primary {
          background: linear-gradient(180deg,#ff6b6b,#ff4d4d);
          color: white;
          box-shadow: 0 10px 28px rgba(255,90,90,0.22);
        }

        .btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(255,90,90,0.32);
        }
      `}</style>

      <div className="profile-wrap">
        <div className="profile-card">
          <h2 className="profile-title">Profile</h2>

          {!user ? (
            <div style={{ marginTop: 20 }}>Loading profile...</div>
          ) : (
            <>
              <div className="profile-grid">
                <div className="label">Email</div>
                <div className="value">{user.email}</div>

                <div className="label">User ID</div>
                <div className="value">{user.uid}</div>

                <div className="label">Display Name</div>
                <div className="value">{user.displayName || "—"}</div>

                <div className="label">Phone</div>
                <div className="value">{user.phoneNumber || "—"}</div>
              </div>

              <div className="profile-actions">
                <button className="btn secondary" onClick={() => navigate("/dashboard")}>
                  Back
                </button>
                <button className="btn primary" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
