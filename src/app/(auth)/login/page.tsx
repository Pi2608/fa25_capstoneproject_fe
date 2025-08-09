"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import { login as loginApi, postJson } from "@/lib/api";
import { auth, googleProvider, facebookProvider } from "@/lib/firebase";
import {
  getIdToken,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  type AuthError,
  type UserCredential,
} from "firebase/auth";

type BannerType = "info" | "error";

type Provider = "google" | "facebook";

function msg(code?: string): { type: BannerType; text: string; fallback?: boolean } {
  switch (code) {
    case "auth/popup-closed-by-user":
      return { type: "info", text: "Bạn đã hủy đăng nhập. Nếu muốn, hãy thử lại." };
    case "auth/popup-blocked":
    case "auth/operation-not-supported-in-this-environment":
      return { type: "info", text: "Trình duyệt chặn popup. Đang chuyển sang cách khác…", fallback: true };
    case "auth/account-exists-with-different-credential":
      return { type: "error", text: "Email này đã dùng cách đăng nhập khác. Vui lòng dùng đúng phương thức." };
    case "auth/unauthorized-domain":
      return { type: "error", text: "Tên miền hiện tại chưa được phép đăng nhập. Vui lòng thử lại sau." };
    default:
      return { type: "error", text: "Không thể đăng nhập lúc này. Vui lòng thử lại." };
  }
}

interface SocialLoginResponse {
  token: string;
  user: { id: string; email: string };
}

async function finishSocial(cred: UserCredential, provider: Provider, router: ReturnType<typeof useRouter>) {
  const idToken = await getIdToken(cred.user, true);
  const data = await postJson<{ provider: Provider; idToken: string }, SocialLoginResponse>(
    "/auth/login",
    { provider, idToken }
  );
  localStorage.setItem("token", data.token);
  router.push("/");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: BannerType; text: string } | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    getRedirectResult(auth)
      .then(async (res) => {
        if (!res) return;
        const pv = (sessionStorage.getItem("redirectProvider") as Provider) ?? "google";
        await finishSocial(res, pv, router);
        sessionStorage.removeItem("redirectProvider");
      })
      .catch((e: AuthError) => setBanner(msg(e?.code)));
  }, [router]);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Vui lòng nhập email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email không hợp lệ.";
    if (!password.trim()) e.password = "Vui lòng nhập mật khẩu.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    setBanner(null);
    if (!validate()) {
      setBanner({ type: "error", text: "Vui lòng điền đầy đủ thông tin." });
      return;
    }
    setLoading(true);
    try {
      const data = await loginApi({ email, password });
      localStorage.setItem("token", data.accessToken ?? data.token);
      router.push("/");
    } catch (e) {
      const message = e && typeof e === "object" && "message" in (e as Record<string, unknown>)
        ? String((e as { message?: unknown }).message)
        : "Không thể đăng nhập. Vui lòng thử lại.";
      setBanner({ type: "error", text: message });
    } finally {
      setLoading(false);
    }
  };

  const socialLogin = async (provider: Provider) => {
    setBanner(null);
    setLoading(true);
    const prov = provider === "google" ? googleProvider : facebookProvider;
    try {
      const cred = await signInWithPopup(auth, prov);
      await finishSocial(cred, provider, router);
    } catch (e) {
      const code = e && typeof e === "object" && "code" in (e as Record<string, unknown>)
        ? String((e as { code?: unknown }).code)
        : undefined;
      const m = msg(code);
      if (m.fallback) {
        setBanner({ type: "info", text: m.text });
        sessionStorage.setItem("redirectProvider", provider);
        await signInWithRedirect(auth, prov);
        return;
      }
      setBanner({ type: m.type, text: m.text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <div className={styles.brandBar}>
        <div className={styles.logoDot} />
        <div className={styles.brandWrap}>
          <span className={styles.brand}>CustomMapOSM</span>
          <span className={styles.tagline}>Map your world—fast & simple</span>
        </div>
      </div>

      <section className={styles.card}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.sub}>Sign in to continue</p>

        {banner && (
          <div className={`${styles.banner} ${banner.type === "error" ? styles.bannerError : styles.bannerInfo}`} role={banner.type === "error" ? "alert" : "status"} aria-live="polite">
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
            <input
              className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
              type="password"
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
            {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
          </label>

          <button className={styles.primaryBtn} type="submit" disabled={loading || !email || !password}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className={styles.divider}><span>or</span></div>

        <div className={styles.socialRow}>
          <button className={`${styles.socialBtn} ${styles.google}`} onClick={() => socialLogin("google")} disabled={loading} type="button">
            Continue with Google
          </button>
          <button className={`${styles.socialBtn} ${styles.facebook}`} onClick={() => socialLogin("facebook")} disabled={loading} type="button">
            Continue with Facebook
          </button>
        </div>

        <p className={styles.note}>
          New here? <a href="/register" className={styles.link}>Create an account</a>
        </p>
      </section>
    </main>
  );
}