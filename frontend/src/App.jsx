// src/App.jsx
import React, { useState, useLayoutEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./Login";
import Dashboard from "./pages/Dashboard";
import ProjectPage from "./pages/ProjectPage";
import CreateProject from "./pages/CreateProject";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import CreateProjectModal from "./components/CreateProjectModal";
import api from "./api";
import { auth } from "./firebase";

function RequireAuth({ children }) {
  const user = auth.currentUser;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const mainRef = useRef(null);

  // measure navbar and apply padding-top to main
  useLayoutEffect(() => {
    function applyNavPadding() {
      const nav = document.querySelector(".nav-shell");
      if (!nav || !mainRef.current) return;
      const rect = nav.getBoundingClientRect();
      mainRef.current.style.paddingTop = `${rect.height}px`;
      // also expose a CSS var for other uses
      document.documentElement.style.setProperty("--nav-height", `${rect.height}px`);
    }

    applyNavPadding();
    window.addEventListener("resize", applyNavPadding);
    // MutationObserver in case nav content changes height later
    const obs = new MutationObserver(applyNavPadding);
    const navEl = document.querySelector(".nav-shell");
    if (navEl) obs.observe(navEl, { childList: true, subtree: true, attributes: true });

    return () => {
      window.removeEventListener("resize", applyNavPadding);
      obs.disconnect();
    };
  }, []);

  function openCreateModal() {
    setShowCreateModal(true);
  }
  function closeCreateModal() {
    setShowCreateModal(false);
  }

  async function handleCreate(payload) {
    try {
      const res = await api.post("/projects", payload);
      const data = res.data || res;
      const newId = data.id || data.project?.id || (Array.isArray(data) && data[0]?.id);
      setShowCreateModal(false);
      if (newId) {
        window.location.href = `/projects/${newId}`;
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Create project failed", err);
      alert("Create failed: " + (err?.message || ""));
    }
  }

  return (
    <>
      <Navbar onCreateClick={openCreateModal} />
      <main ref={mainRef} style={{ minHeight: "100vh" }}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/projects/:projectId" element={<RequireAuth><ProjectPage /></RequireAuth>} />
          <Route path="/create-project" element={<RequireAuth><CreateProject /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={auth.currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
        </Routes>

        {showCreateModal && <CreateProjectModal onClose={closeCreateModal} onCreate={handleCreate} />}
      </main>
    </>
  );
}
