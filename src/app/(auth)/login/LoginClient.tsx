"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import {
  login as loginApi,
  postJson,
  type LoginResponse,
  getPlans,
  createOrRenewMembership,
  type Plan, setAuthTokens
} from "@/lib/api";
import { authStore } from "@/contexts/auth-store";
import {
  getFirebaseAuth,
  googleProvider,
  facebookProvider,
} from "@/lib/firebase";
import {
  getIdToken,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type AuthError,
  type UserCredential,
} from "firebase/auth";

type BannerType = "info" | "error" | "success";
type Provider = "google" | "facebook";

interface SocialLoginResponse {
  token: string;
  user: { id: string; email: string };
}

interface ErrorPayload {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  message?: string;
  errors?: string[];
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function humanizeLoginError(err: unknown): string {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : isRecord(err) && typeof err.message === "string"
          ? (err.message as string)
          : "";

  let candidate: ErrorPayload | null = null;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      candidate = JSON.parse(raw) as ErrorPayload;
    } catch {
      candidate = null;
    }
  }

  if (!candidate && isRecord(err)) {
    if (isRecord(err.body)) {
      candidate = err.body as ErrorPayload;
    } else if (
      isRecord(err.response) &&
      isRecord((err.response as unknown as Record<string, unknown>).data)
    ) {
      const resp = err.response as Record<string, unknown>;
      candidate = resp.data as ErrorPayload;
    } else if (isRecord(err.response)) {
      candidate = err.response as ErrorPayload;
    }
  }

  if (candidate) {
    if (candidate.detail) return String(candidate.detail);
    if (candidate.message) return String(candidate.message);
    if (candidate.title) return String(candidate.title);
    if (Array.isArray(candidate.errors)) return candidate.errors.join("\n");
  }

  const status =
    (isRecord(err) && typeof err.status === "number"
      ? (err.status as number)
      : undefined) ??
    (isRecord(err) &&
      isRecord(err.response) &&
      typeof (err.response as Record<string, unknown>).status === "number"
      ? ((err.response as Record<string, unknown>).status as number)
      : undefined);

  if (status === 400 || status === 401) return "Invalid email or password";
  if (status === 429) return "Too many attempts. Please try again later.";
  if (/InvalidEmailOrPassword/i.test(raw)) return "Invalid email or password";
  if (/network|failed to fetch|timeout/i.test(raw))
    return "Network error. Please check your connection.";

  return "Unable to sign in. Please try again.";
}

function firebaseMsg(
  code?: string
): { type: BannerType; text: string; fallback?: boolean } {
  switch (code) {
    case "auth/popup-closed-by-user":
      return { type: "info", text: "You closed the popup. Try again if you want." };
    case "auth/popup-blocked":
    case "auth/operation-not-supported-in-this-environment":
      return {
        type: "info",
        text: "Popup was blocked. Switching to redirect sign-in…",
        fallback: true,
      };
    case "auth/account-exists-with-different-credential":
      return { type: "error", text: "This email already uses a different sign-in method." };
    case "auth/unauthorized-domain":
      return { type: "error", text: "This domain is not allowed for sign-in." };
    default:
      return { type: "error", text: "We can’t sign you in right now. Please try again." };
  }
}

const MEMBERSHIP_GUARD_KEY = "cmosm:membership-checked";

async function ensureFreeMembership() {
  try {
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem(MEMBERSHIP_GUARD_KEY)
    )
      return;

    const plans: Plan[] = await getPlans().catch(() => []);
    if (!plans || plans.length === 0) return;

    const free =
      plans.find((p) => /free/i.test(p.planName)) ??
      plans.find((p) => p.priceMonthly === 0) ??
      null;
    if (!free) return;

    await createOrRenewMembership({ planId: free.planId }).catch(() => { });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MEMBERSHIP_GUARD_KEY, "1");
    }
  } catch {
  }
}

async function finishSocial(
  cred: UserCredential,
  provider: Provider
): Promise<void> {
  const idToken = await getIdToken(cred.user, true);
  const data = await postJson<{ provider: Provider; idToken: string }, SocialLoginResponse>(
    "/auth/login",
    { provider, idToken }
  );
  authStore.setToken(data.token);
  await ensureFreeMembership();
}

export default function LoginClient() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ type: BannerType; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPwd, setShowPwd] = useState<boolean>(false);

  useEffect(() => {
    const a = getFirebaseAuth();
    getRedirectResult(a)
      .then(async (res) => {
        if (!res) return;
        const pv = (sessionStorage.getItem("redirectProvider") as Provider) ?? "google";
        await finishSocial(res, pv);
        setBanner({ type: "success", text: "Signed in successfully. " });
        setToast("Signed in successfully! Welcome back 👋");
        setTimeout(() => {
          router.refresh();
          router.push("/");
        }, 900);
        sessionStorage.removeItem("redirectProvider");
      })
      .catch((e: AuthError) => setBanner(firebaseMsg(e?.code)));
  }, [router]);

  const validate = () => {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = "Please enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email address.";
    if (!password.trim()) e.password = "Please enter your password.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setBanner(null);
    if (!validate()) {
      setBanner({ type: "error", text: "Please fill in all required fields." });
      return;
    }
    setLoading(true);
    try {
      const data: LoginResponse = await loginApi({ email, password });
      const token = data.accessToken ?? (data as unknown as { token?: string }).token;
      if (!token) throw new Error("Login response missing token");

      setAuthTokens({ accessToken: token });
      authStore.setToken?.(token);
      await ensureFreeMembership();

      setBanner({ type: "success", text: "Signed in successfully." });
      setToast("Signed in successfully! Welcome back 👋");
      setTimeout(() => {
        router.refresh();
        if (email.toLowerCase() === "admin@cusommaposm.com") {
          router.push("/dashboard");
        } else {
          router.push("/profile");
        }
      }, 900);
    } catch (err: unknown) {
      setBanner({ type: "error", text: humanizeLoginError(err) });
    } finally {
      setLoading(false);
    }
  };

  // const socialLogin = async (provider: Provider) => {
  //   setBanner(null);
  //   setLoading(true);
  //   const prov = provider === "google" ? googleProvider : facebookProvider;
  //   try {
  //     const cred = await signInWithPopup(getFirebaseAuth(), prov);
  //     await finishSocial(cred, provider);

  //     setBanner({ type: "success", text: "Signed in successfully. " });
  //     setToast("Signed in successfully! Welcome back 👋");
  //     setTimeout(() => {
  //       router.refresh();
  //       router.push("/");
  //     }, 900);
  //   } catch (e: unknown) {
  //     const code =
  //       isRecord(e) && typeof (e as Record<string, unknown>).code === "string"
  //         ? ((e as Record<string, unknown>).code as string)
  //         : undefined;
  //     const m = firebaseMsg(code);
  //     if (m.fallback) {
  //       setBanner({ type: "info", text: m.text });
  //       sessionStorage.setItem("redirectProvider", provider);
  //       await signInWithRedirect(getFirebaseAuth(), prov);
  //       return;
  //     }
  //     setBanner({ type: m.type, text: m.text });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (
    <main className={styles.wrap}>
      <div className={styles.brandBar}>
        <div className={styles.logoDot} />
        <div className={styles.brandWrap}>
          <span className={styles.brand}>IMOS</span>
          <span className={styles.tagline}>Your maps — fast &amp; simple</span>
        </div>
      </div>

      <section className={styles.card}>
        <h1 className={styles.title}>Welcome back</h1>

        {banner && (
          <div
            className={`${styles.banner} ${banner.type === "error"
              ? styles.bannerError
              : banner.type === "success"
                ? styles.bannerSuccess
                : styles.bannerInfo
              }`}
            role={banner.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {banner.text}
          </div>
        )}

        <form onSubmit={onSubmit} className={styles.form} noValidate>
          <label className={styles.label}>
            Email
            <input
              className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              onBlur={validate}
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
            {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
          </label>

          <label className={styles.label}>
            Password
            <div className={styles.pwdWrap}>
              <input
                className={`${styles.input} ${styles.inputPwd} ${errors.password ? styles.inputError : ""}`}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                onBlur={validate}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}
                aria-pressed={showPwd}
                title={showPwd ? "Hide password" : "Show password"}
                className={styles.eyeBtn}
              >
                {showPwd ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M10.58 10.58a3 3 0 004.24 4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M17.94 17.94C16.26 18.95 14.23 19.5 12 19.5 6.5 19.5 2.27 15.64 1 12c.49-1.39 1.47-2.92 2.86-4.3M9.88 4.62C10.56 4.53 11.27 4.5 12 4.5 17.5 4.5 21.73 8.36 23 12c-.37 1.03-1.02 2.18-1.95 3.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M1 12s4.5-7.5 11-7.5S23 12 23 12s-4.5 7.5-11 7.5S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                )}
              </button>
            </div>

            {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
          </label>


          <button
            className={styles.primaryBtn}
            type="submit"
            disabled={loading || !email || !password}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* <div className={styles.divider}>
          <span>or</span>
        </div> */}

        <div className={styles.socialRow}>
          {/* <button
            className={`${styles.socialBtn} ${styles.google}`}
            onClick={() => socialLogin("google")}
            disabled={loading}
            type="button"
          >
            Continue with Google
          </button> */}
          {/* <button
            className={`${styles.socialBtn} ${styles.facebook}`}
            onClick={() => socialLogin("facebook")}
            disabled={loading}
            type="button"
          >
            Continue with Facebook
          </button> */}
        </div>

        <p className={styles.note}>
          Forgot your password? <a href="/forgot-password" className={styles.link}>Reset</a>
        </p>

        <p className={styles.note}>
          New here? <a href="/register" className={styles.link}>Create an account</a>
        </p>
      </section>

      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`} role="status" aria-live="polite">
        <div className={styles.toastDot} />
        <span>{toast}</span>
      </div>
    </main>
  );
}
