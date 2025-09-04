"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import {
  login as loginApi,
  postJson,
  type LoginResponse,
  // ↓↓↓ ADD
  getPlans,
  createOrRenewMembership,
  type Plan,
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

type BannerType = "info" | "error";
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
    } else if (isRecord(err.response) && isRecord((err.response as unknown as Record<string, unknown>).data)) {
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
    (isRecord(err) && typeof err.status === "number" ? (err.status as number) : undefined) ??
    (isRecord(err) &&
      isRecord(err.response) &&
      typeof (err.response as Record<string, unknown>).status === "number"
        ? ((err.response as Record<string, unknown>).status as number)
        : undefined);

  if (status === 400 || status === 401) return "Email hoặc mật khẩu không đúng";
  if (status === 429) return "Thao tác quá nhiều. Hãy thử lại sau.";
  if (/InvalidEmailOrPassword/i.test(raw)) return "Email hoặc mật khẩu không đúng";
  if (/network|failed to fetch|timeout/i.test(raw)) return "Lỗi mạng. Vui lòng kiểm tra kết nối.";

  return "Không thể đăng nhập. Vui lòng thử lại.";
}

function firebaseMsg(code?: string): { type: BannerType; text: string; fallback?: boolean } {
  switch (code) {
    case "auth/popup-closed-by-user":
      return { type: "info", text: "Bạn đã huỷ đăng nhập. Thử lại nếu muốn." };
    case "auth/popup-blocked":
    case "auth/operation-not-supported-in-this-environment":
      return { type: "info", text: "Popup bị chặn. Đang chuyển sang đăng nhập bằng chuyển hướng…", fallback: true };
    case "auth/account-exists-with-different-credential":
      return { type: "error", text: "Email này đang dùng phương thức đăng nhập khác." };
    case "auth/unauthorized-domain":
      return { type: "error", text: "Miền này không được phép đăng nhập." };
    default:
      return { type: "error", text: "Hiện không thể đăng nhập. Vui lòng thử lại." };
  }
}

/** ===== FE-only: đảm bảo user có Free membership sau login ===== */
const MEMBERSHIP_GUARD_KEY = "cmosm:membership-checked";
/**
 * Gọi khi đã có token. Best-effort:
 * - Tìm gói "Free" (ưu tiên name "Free", fallback priceMonthly === 0)
 * - Gọi createOrRenewMembership({ planId: freeId })
 * - Nuốt mọi lỗi (không chặn luồng).
 * - Dùng cờ localStorage tránh gọi lặp.
 */
async function ensureFreeMembership() {
  try {
    // tránh spam nếu đã gọi trong phiên trình duyệt này
    if (typeof window !== "undefined" && window.localStorage.getItem(MEMBERSHIP_GUARD_KEY)) return;

    const plans = await getPlans().catch(() => [] as Plan[]);
    if (!plans || plans.length === 0) return;

    const free =
      plans.find((p) => /free/i.test(p.planName)) ??
      plans.find((p) => (p as any).priceMonthly === 0) ??
      null;
    if (!free) return;

    await createOrRenewMembership({ planId: free.planId }).catch(() => void 0);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MEMBERSHIP_GUARD_KEY, "1");
    }
  } catch {
    // im lặng
  }
}

async function finishSocial(
  cred: UserCredential,
  provider: Provider,
  router: ReturnType<typeof useRouter>
) {
  const idToken = await getIdToken(cred.user, true);
  const data = await postJson<{ provider: Provider; idToken: string }, SocialLoginResponse>(
    "/auth/login",
    { provider, idToken }
  );
  authStore.setToken(data.token);

  // ✅ đảm bảo có gói Free nếu chưa có
  await ensureFreeMembership();

  router.refresh();
  router.push("/");
}

export default function LoginClient() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ type: BannerType; text: string } | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const a = getFirebaseAuth();
    getRedirectResult(a)
      .then(async (res) => {
        if (!res) return;
        const pv = (sessionStorage.getItem("redirectProvider") as Provider) ?? "google";
        await finishSocial(res, pv, router);
        sessionStorage.removeItem("redirectProvider");
      })
      .catch((e: AuthError) => setBanner(firebaseMsg(e?.code)));
  }, [router]);

  const validate = () => {
    const e: { email?: string; password?: string } = {};
    if (!email.trim()) e.email = "Vui lòng nhập email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email không hợp lệ.";
    if (!password.trim()) e.password = "Vui lòng nhập mật khẩu.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setBanner(null);
    if (!validate()) {
      setBanner({ type: "error", text: "Vui lòng điền đầy đủ các trường bắt buộc." });
      return;
    }
    setLoading(true);
    try {
      const data: LoginResponse = await loginApi({ email, password });
      const token = data.accessToken ?? (data as unknown as { token?: string }).token;
      if (!token) throw new Error("Login response missing token");

      authStore.setToken(token);

      // ✅ đảm bảo có gói Free nếu chưa có
      await ensureFreeMembership();

      router.refresh();
      router.push("/profile");
    } catch (err: unknown) {
      setBanner({ type: "error", text: humanizeLoginError(err) });
    } finally {
      setLoading(false);
    }
  };

  const socialLogin = async (provider: Provider) => {
    setBanner(null);
    setLoading(true);
    const prov = provider === "google" ? googleProvider : facebookProvider;
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), prov);
      await finishSocial(cred, provider, router);
    } catch (e: unknown) {
      const code =
        isRecord(e) && typeof (e as Record<string, unknown>).code === "string"
          ? ((e as Record<string, unknown>).code as string)
          : undefined;
      const m = firebaseMsg(code);
      if (m.fallback) {
        setBanner({ type: "info", text: m.text });
        sessionStorage.setItem("redirectProvider", provider);
        await signInWithRedirect(getFirebaseAuth(), prov);
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
          <span className={styles.tagline}>Bản đồ của bạn — nhanh &amp; đơn giản</span>
        </div>
      </div>

      <section className={styles.card}>
        <h1 className={styles.title}>Chào mừng trở lại</h1>
        <p className={styles.sub}>Đăng nhập để tiếp tục</p>

        {banner && (
          <div
            className={`${styles.banner} ${banner.type === "error" ? styles.bannerError : styles.bannerInfo}`}
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
              placeholder="ban@example.com"
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
            {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
          </label>

          <label className={styles.label}>
            Mật khẩu
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
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <div className={styles.divider}><span>hoặc</span></div>

        <div className={styles.socialRow}>
          <button
            className={`${styles.socialBtn} ${styles.google}`}
            onClick={() => socialLogin("google")}
            disabled={loading}
            type="button"
          >
            Tiếp tục với Google
          </button>
          <button
            className={`${styles.socialBtn} ${styles.facebook}`}
            onClick={() => socialLogin("facebook")}
            disabled={loading}
            type="button"
          >
            Tiếp tục với Facebook
          </button>
        </div>

        <p className={styles.note}>
          Quên mật khẩu?{" "}
          <a href="/forgot-password" className={styles.link}>Đặt lại</a>
        </p>

        <p className={styles.note}>
          Mới dùng? <a href="/register" className={styles.link}>Tạo tài khoản</a>
        </p>
      </section>
    </main>
  );
}
