// frontend/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCc73Xj_r4pXEh1u-XuUl5At4MYQanoRV0",
  authDomain: "ocean-project-75d51.firebaseapp.com",
  projectId: "ocean-project-75d51",
  storageBucket: "ocean-project-75d51.firebasestorage.app",
  messagingSenderId: "707110539756",
  appId: "1:707110539756:web:04f20bb7786b408e99b0c9",
  measurementId: "G-9VZ66C0K22"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Debug helpers (safe for browser; won't break SSR or builds)
if (typeof window !== "undefined") {
  try {
    window.auth = auth;

    window.getIdToken = async (forceRefresh = true) => {
      if (!auth?.currentUser) {
        throw new Error("User not signed in.");
      }
      return auth.currentUser.getIdToken(forceRefresh);
    };
  } catch (e) {
    console.warn("Debug Firebase helpers failed to attach:", e);
  }
}

export default app;
