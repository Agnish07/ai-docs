// frontend/src/components/Navbar.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import api from "../api";
import { Bell, Search, Waves } from "lucide-react";
import logo from "../assets/logo.svg";

export default function Navbar({ onCreateClick }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [openSearch, setOpenSearch] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [searching, setSearching] = useState(false);

  const containerRef = useRef(null);
  const avatarRef = useRef(null);
  const userMenuRef = useRef(null);
  const debounceRef = useRef(null);
  const searchControllerRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // cleanup debounce and abort controller on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchControllerRef.current) {
        try {
          searchControllerRef.current.abort();
        } catch (e) {}
        searchControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      const t = e.target;
      if (containerRef.current && !containerRef.current.contains(t)) setOpenSearch(false);
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(t) &&
        avatarRef.current &&
        !avatarRef.current.contains(t)
      )
        setOpenUserMenu(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpenSearch(false);
        setOpenUserMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function doSearch(q) {
  const trimmed = (q || "").trim();

  // minimum length (helps avoid backend returning everything for empty q)
  if (!trimmed || trimmed.length < 2) {
    setResults([]);
    setOpenSearch(false);
    setSearching(false);
    return;
  }

  // abort previous controller if present
  if (searchControllerRef.current) {
    try { searchControllerRef.current.abort(); } catch (e) {}
    searchControllerRef.current = null;
  }
  const controller = new AbortController();
  searchControllerRef.current = controller;
  setSearching(true);

  try {
    // log what we send
    console.debug("[Search] sending request:", { q: trimmed });

    const res = await api.get("/projects", {
      params: { q: trimmed }, // <-- if your backend expects `search` change here
      signal: controller.signal,
    });

    console.debug("[Search] raw response:", res);

    const data = res?.data ?? res;
    // normalize list of results
    let list = Array.isArray(data) ? data : data.projects ?? data.items ?? [];

    // SAFETY: if backend returned all items (e.g. q ignored), filter client-side
    // We'll consider it "all items" if backend returned >0 items and none of them
    // matched the query (indicating server didn't filter).
    const ci = (str) => (str || "").toString().toLowerCase();
    const qLower = trimmed.toLowerCase();

    const anyServerMatched = list.some(
      (p) =>
        ci(p.title).includes(qLower) ||
        ci(p.main_prompt).includes(qLower) ||
        (p.tags && Array.isArray(p.tags) && p.tags.join(" ").toLowerCase().includes(qLower))
    );

    if (!anyServerMatched && list.length > 0) {
      console.debug("[Search] backend likely returned unfiltered data — applying client-side filter");
      list = list.filter(
        (p) =>
          ci(p.title).includes(qLower) ||
          ci(p.main_prompt).includes(qLower) ||
          (p.tags && Array.isArray(p.tags) && p.tags.join(" ").toLowerCase().includes(qLower))
      );
    }

    setResults(list.slice(0, 10));
    setOpenSearch(true);
  } catch (err) {
    const isAbort =
      err?.name === "AbortError" ||
      err?.code === "ERR_CANCELED" ||
      err?.message?.toLowerCase()?.includes("canceled") ||
      err?.message?.toLowerCase()?.includes("abort");
    if (!isAbort) {
      console.error("[Search] error:", err);
      setResults([]);
      setOpenSearch(false);
    }
  } finally {
    setSearching(false);
    if (searchControllerRef.current === controller) searchControllerRef.current = null;
  }
}


  function onSearchChange(e) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 220);
  }

  function selectProject(p) {
    setOpenSearch(false);
    setQuery("");
    setResults([]);
    setOpenUserMenu(false);
    if (p && p.id) navigate(`/projects/${p.id}`);
    else navigate("/dashboard");
  }

  function handleCreate() {
    if (typeof onCreateClick === "function") return onCreateClick();
    navigate("/create-project");
  }

  async function handleSignOut() {
    try {
      await auth.signOut();
    } finally {
      setOpenUserMenu(false);
      navigate("/login");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;600;800&display=swap');

        :root{
          --primary: #FF5A5A;
          --white: #FFFFFF;
          --muted: #4b2f2f;
          --nav-height: 85px; /* compact */
          --accent-glow: rgba(255,90,90,0.14);
        }

        /* NAV (compact) with left padding so logo isn't flush to edge */
        .nav-shell {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 999;
          background: var(--primary);
          color: var(--white);
          -webkit-font-smoothing:antialiased;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          height: var(--nav-height);
        }

        /* add horizontal padding so logo is not clipped by viewport / safe area */
        .nav-inner {
          max-width: 84rem;
          margin: 0 auto;
          padding: 0.55rem 1.25rem; /* increased left/right padding */
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 0.75rem;
          align-items: center;
          height: 100%;
          overflow: visible;
        }

        /* BRAND: larger, forced to top with high z-index and no clipping */
        .brand {
          display:flex;
          gap:0.75rem;
          align-items:center;
          cursor:pointer;
          position: relative;
          z-index: 2000; /* very high so it sits above any center content */
          pointer-events: auto;
        }

        /* make the logo clearer: slightly bigger, white rounded background to maintain contrast */
        .brand-logo {
          width:36px;
          height:36px;
          border-radius:10px;
          background-image: url('/mnt/data/7bdc7eda-19fb-4ee1-ab9a-1ef6157aed88.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-color: rgba(255,255,255,0.95);
          border: 2px solid rgba(255,255,255,0.95);
          box-shadow: 0 8px 20px rgba(255,255,255,0.12), inset 0 -4px 8px rgba(0,0,0,0.02);
          flex-shrink:0;
        }

        /* ensure Ocean text is bold, visible and never clipped */
        .brand-title {
          font-family: "Space Grotesk", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
          font-weight:700;
          font-size:1.02rem;
          color: var(--white);
          letter-spacing: 0.35px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.06);
          white-space: nowrap;
          line-height: 1;
          padding-right: 6px;
        }

        /* center search: but keep compact and reserve space so it can't overlap brand */
        .search-wrap {
          position: relative;
          width:100%;
          display:flex;
          justify-content:center;
          align-items:center;
        }

        .search-pill {
          width:100%;
          max-width: calc(100% - 300px); /* reserves space for left and right controls */
          border-radius:999px;
          padding: .6rem .9rem;
          display:flex;
          align-items:center;
          gap:.6rem;
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          border: 1.6px solid rgba(255,255,255,0.16);
          box-shadow: 0 10px 30px rgba(0,0,0,0.12), 0 4px 20px var(--accent-glow);
          transform: translateY(1px);
          transition: transform .14s ease, box-shadow .14s ease;
          backdrop-filter: blur(6px) saturate(110%);
        }
        .search-pill:hover { transform: translateY(-1px); }

        .search-icon {
          width:34px;
          height:34px;
          border-radius:8px;
          display:grid;
          place-items:center;
          background: rgba(255,255,255,0.06);
          color: var(--white);
          font-size:0.95rem;
          border: 1px solid rgba(255,255,255,0.08);
          flex: 0 0 34px;
        }

        .search-input {
          flex:1;
          border: 0;
          background: transparent;
          color: var(--white);
          outline: none;
          font-family: "Inter", system-ui;
          font-weight:700;
          font-size:0.95rem;
          padding: 0;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.75); font-weight:600; }

        .focus-ring { position:absolute; inset:-5px; border-radius:999px; pointer-events:none; opacity:0; transform:scale(.98); transition:all .16s ease; }
        .search-pill:focus-within .focus-ring { opacity:1; transform:scale(1); box-shadow: 0 0 0 5px rgba(255,90,90,0.06); }

        /* search results */
        .search-list {
          position: absolute;
          top: calc(100% + 12px);
          left: 50%;
          transform: translateX(-50%);
          width: min(880px, calc(100% - 2rem));
          max-width: 900px;
          background: #ffffff;
          color: #2b2b2b;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          z-index: 2000;
          border: 1px solid rgba(0,0,0,0.06);
        }
        .search-item {
          padding: 0.6rem 0.9rem;
          border-bottom: 1px solid rgba(0,0,0,0.04);
          cursor: pointer;
        }
        .search-item:last-child { border-bottom: none; }
        .search-item .title { font-weight: 700; }
        .search-item .sub { font-size: 0.86rem; color: #6b6b6b; margin-top: 4px; }
        .search-item:focus, .search-item:hover {
          background: rgba(255,90,90,0.04);
          outline: none;
        }

        /* small responsive adjustments: reduce max-width subtraction on narrow screens to avoid clipping brand */
        @media (max-width: 1100px) {
          .nav-inner { padding-left: 1rem; padding-right: 1rem; }
          .search-pill { max-width: calc(100% - 240px); }
        }
        @media (max-width: 720px) {
          .brand-title { font-size:0.96rem; }
          .brand-logo { width:30px; height:30px; border-radius:8px; }
          .search-pill { max-width: calc(100% - 160px); padding:.45rem .7rem; }
        }

        /* actions kept compact */
        .actions { display:flex; gap:0.6rem; align-items:center; justify-self:end; z-index:1100; }
        .btn-create { padding: 0.45rem .9rem; background: var(--white); color: var(--primary, #FF5A5A); border-radius: 10px; border:none; font-weight:700; }
        .ghost-btn { padding: 0.38rem; width:42px; height:42px; border-radius:10px; display:grid; place-items:center; background: transparent; border: 1px solid rgba(255,255,255,0.16); color: var(--white); cursor:pointer; }
        .avatar { width:42px; height:42px; border-radius: 999px; background: var(--white); color: var(--primary); display:grid; place-items:center; font-weight:800; border: 1.6px solid rgba(255,255,255,0.9); }

        .usermenu { position:absolute; right:0; margin-top:10px; width:11rem; border-radius:10px; background: var(--white); box-shadow: 0 14px 36px rgba(0,0,0,0.2); overflow:hidden; border: 1px solid rgba(0,0,0,0.06); }
        .usermenu button { width:100%; text-align:left; padding:0.75rem .85rem; background:transparent; border:none; font-weight:700; color:#3b2a2a; cursor:pointer; }
        .usermenu button:hover { background: rgba(242,90,90,0.04); color:var(--primary); }
      `}</style>

      <header className="nav-shell" role="navigation" aria-label="Main navigation">
        <div className="nav-inner">
          {/* LEFT - Brand */}
          <div
            className="brand"
            onClick={() => navigate("/dashboard")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/dashboard");
              }
            }}
          >
            <div className="brand" aria-hidden>
              {/* you can swap Waves with an <img src={logo} /> if you want */}
              <Waves className="w-9 h-9" />
            </div>
            <div className="brand-title">Ocean</div>
          </div>

          {/* CENTER - show search ONLY when logged in */}
          <div ref={containerRef} className="search-wrap" aria-hidden={!user}>
            {user && (
              <>
                <div
                  className="search-pill"
                  role="search"
                  aria-label="Search projects"
                >
                  <div className="search-icon" aria-hidden>
                    <Search />
                  </div>
                  <input
                    className="search-input"
                    value={query}
                    onChange={onSearchChange}
                    placeholder="Search projects..."
                    onFocus={() => setOpenSearch(true)}
                    aria-label="Search projects"
                  />
                  <div className="focus-ring" aria-hidden />
                </div>

                {openSearch && (
                  <div
                    className="search-list"
                    role="listbox"
                    aria-label="Search results"
                  >
                    {searching && results.length === 0 ? (
                      <div className="search-item">Searching…</div>
                    ) : results.length === 0 ? (
                      <div className="search-item">No results</div>
                    ) : (
                      results.map((p) => (
                        <div
                          key={p.id ?? p.title}
                          className="search-item"
                          onClick={() => selectProject(p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectProject(p);
                            }
                          }}
                          role="option"
                          tabIndex={0}
                        >
                          <div className="title">{p.title}</div>
                          <div className="sub">{(p.main_prompt || "").slice(0, 120)}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT - actions */}
          <div className="actions">
            {user && (
              <button
                className="btn-create cursor-pointer"
                onClick={handleCreate}
                aria-label="Create project"
              >
                + Create
              </button>
            )}

            <button
              className="ghost-btn cursor-pointer"
              title="Notifications"
              onClick={() => alert("Notifications (placeholder)")}
              aria-label="Notifications"
            >
              <Bell />
            </button>

            <div style={{ position: "relative" }}>
              {user ? (
                <>
                  <div
                    ref={avatarRef}
                    className="avatar cursor-pointer"
                    onClick={() => setOpenUserMenu((s) => !s)}
                    aria-haspopup="true"
                    aria-expanded={openUserMenu}
                    title={user.email || "User"}
                  >
                    {(user.email || "U").charAt(0).toUpperCase()}
                  </div>

                  {openUserMenu && (
                    <div ref={userMenuRef} className="usermenu" role="menu" aria-label="User menu">
                      <button
                        onClick={() => {
                          setOpenUserMenu(false);
                          navigate("/profile");
                        }}
                      >
                        Profile
                      </button>
                      <button onClick={handleSignOut}>Logout</button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  className="btn-create"
                  onClick={() => navigate("/login")}
                  style={{ background: "var(--white)", color: "var(--primary)" }}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
