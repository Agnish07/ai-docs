// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);


if (typeof window !== "undefined") {
  try {
    window.auth = auth;
    window.getIdToken = async (forceRefresh = true) => {
      if (!auth || !auth.currentUser) {
        throw new Error("Not signed in (auth.currentUser is null). Log in first.");
      }
      return auth.currentUser.getIdToken(forceRefresh);
    };
  } catch (e) {
  }
}
