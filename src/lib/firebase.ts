import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, type Auth } from "firebase/auth";

type FirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

function buildConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

function assertConfig(cfg: FirebaseConfig) {
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!cfg.authDomain) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!cfg.projectId) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!cfg.appId) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  if (missing.length) {
    throw new Error(
      `Firebase config missing: ${missing.join(
        ", "
      )}. Kiểm tra Vercel → Settings → Environment Variables (Preview/Production) hoặc .env.local.`
    );
  }
}

let app: FirebaseApp | null = null;

function ensureClientApp(): FirebaseApp {
  if (typeof window === "undefined") {
    throw new Error("Firebase Auth is client-only");
  }
  if (!app) {
    const cfg = buildConfig();
    assertConfig(cfg);
    app = getApps().length ? getApp() : initializeApp(cfg as Required<FirebaseConfig>);
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(ensureClientApp());
}

export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
