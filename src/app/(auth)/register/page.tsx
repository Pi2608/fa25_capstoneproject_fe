"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";
import { postJson } from "@/lib/api";
import Link from "next/link";

type Banner = { type: "info" | "error" | "success"; text: string };

const phoneValid = (v: string) => /^\d{10}$/.test(v);
const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

interface NameParts {
  firstName: string;
  lastName: string;
}

interface UnknownApiError {
  message?: string;
  detail?: string;
  title?: string;
  type?: string;
  status?: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function hasNumber(x: Record<string, unknown>, key: string): x is Record<string, number | unknown> {
  return key in x && typeof x[key] === "number";
}
function hasString(x: Record<string, unknown>, key: string): x is Record<string, string | unknown> {
  return key in x && typeof x[key] === "string";
}

function splitVietnameseName(fullName: string): NameParts {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  const lastName = parts[0] ?? "";
  const firstName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

function prettyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  try {
    if (isPlainObject(err)) {
      const obj = err as Record<string, unknown>;

      if (hasNumber(obj, "status")) {
        const st = obj.status as number;
        if (st === 429) return "Too many attempts. Please try again in a moment.";
        if (st === 401) return "You are not authorized to perform this action.";
        if (st === 403) return "You don’t have permission to access this resource.";
        if (st === 404) return "Requested resource was not found.";
        if (st >= 500) return "The server is busy. Please try again later.";
      }

      const msgLike: string[] = [];
      if (hasString(obj, "message")) msgLike.push(String(obj.message));
      if (hasString(obj, "detail")) msgLike.push(String(obj.detail));
      if (hasString(obj, "title")) msgLike.push(String(obj.title));
      if (hasString(obj, "type")) msgLike.push(String(obj.type));

      for (const msg of msgLike) {
        if (/already exists/i.test(msg)) return "This email is already registered. Please use a different email.";
        if (/otp/i.test(msg) && /invalid|expired/i.test(msg)) return "The verification code is invalid or expired.";
        if (/too many/i.test(msg) || /rate/i.test(msg)) return "Too many attempts. Please try again later.";
        if (/500|internal server/i.test(msg)) return "The server is busy. Please try again later.";
      }

      if (msgLike.length > 0) return msgLike[0]!;
    }

    if (typeof err === "string") {
      try {
        const j = JSON.parse(err) as unknown;
        return prettyError(j, fallback);
      } catch {
        const s = err;
        if (/already exists/i.test(s)) return "This email is already registered. Please use a different email.";
        if (/otp/i.test(s) && /invalid|expired/i.test(s)) return "The verification code is invalid or expired.";
        if (/500|internal server/i.test(s)) return "The server is busy. Please try again later.";
        return s;
      }
    }
  } catch {
  }
  return fallback;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [showPass, setShowPass] = useState<boolean>(false);
  const [agree, setAgree] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirm?: string;
    agree?: string;
    otp?: string;
  }>({});

  useEffect(() => {
    try {
      const cachedEmail = typeof window !== "undefined" ? localStorage.getItem("reg_email") : null;
      const cachedName = typeof window !== "undefined" ? localStorage.getItem("reg_name") : null;
      if (cachedEmail && cachedName) {
        const { firstName, lastName } = JSON.parse(cachedName) as NameParts;
        if (!name) setName([lastName, firstName].filter(Boolean).join(" "));
        if (!email) setEmail(cachedEmail);
      }
    } catch {
    }
  }, [email, name]);

  const passScore = useMemo<number>(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);

  const scoreLabel = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][passScore];

  const validateStep1 = useCallback(() => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Please enter your name.";
    if (!email.trim()) e.email = "Please enter your email.";
    else if (!emailValid(email)) e.email = "Invalid email address.";
    if (phone && !phoneValid(phone)) e.phone = "Phone number must be exactly 10 digits.";
    if (!password.trim()) e.password = "Please enter a password.";
    else if (password.length < 8) e.password = "Password must be at least 8 characters.";
    if (!confirm.trim()) e.confirm = "Please re-enter your password.";
    else if (confirm !== password) e.confirm = "Passwords do not match.";
    if (!agree) e.agree = "Please agree to the Terms.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [agree, confirm, email, name, password, phone]);

  const validateStep2 = useCallback(() => {
    const e: typeof errors = {};
    if (!otp.trim()) e.otp = "Please enter the verification code.";
    else if (!/^\d{4,8}$/.test(otp)) e.otp = "Invalid code.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [otp]);

  const submitStep1: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    setBanner(null);
    if (!validateStep1()) {
      setBanner({ type: "error", text: "Please complete all required fields." });
      return;
    }
    setLoading(true);
    try {
      const { firstName, lastName } = splitVietnameseName(name);
      await postJson("/auth/verify-email", {
        firstName,
        lastName,
        email,
        phone: phone || null,
        password,
      });
      try {
        localStorage.setItem("reg_name", JSON.stringify({ firstName, lastName } satisfies NameParts));
        localStorage.setItem("reg_email", email);
      } catch {
      }
      setBanner({ type: "success", text: "Verification code sent. Please check your inbox." });
      setToast("Verification code sent ✉️");
      setTimeout(() => setToast(null), 1600);
      setStep(2);
    } catch (e: unknown) {
      setBanner({ type: "error", text: prettyError(e, "Could not send verification code. Please try again later.") });
    } finally {
      setLoading(false);
    }
  };

  const submitStep2: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    setBanner(null);
    if (!validateStep2()) return;
    setLoading(true);
    try {
      await postJson("/auth/verify-otp", { otp });
      setBanner({ type: "success", text: "Email verified. Redirecting…" });
      setToast("Email verified ✅");
      setTimeout(() => setToast(null), 1400);
      setTimeout(() => router.push("/login"), 900);
    } catch (e: unknown) {
      setBanner({ type: "error", text: prettyError(e, "The verification code is invalid or expired.") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (banner?.type === "error") return;
    if (Object.keys(errors).length && step === 1) validateStep1();
    if (Object.keys(errors).length && step === 2) validateStep2();
  }, [agree, banner?.type, confirm, email, errors, name, otp, password, phone, step, validateStep1, validateStep2]);

  return (
    <main className={styles.wrap}>
      <div className={styles.brandBar}>
        <div className={styles.logoDot} />
        <div className={styles.brandWrap}>
          <Link href="/" className="flex items-center gap-2">
            <span className={styles.brand}>CustomMapOSM</span>
          </Link>
          <span className={styles.tagline}>Create an account in seconds</span>
        </div>
      </div>

      <section className={styles.card}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.sub}>
          {step === 1 ? "Join and start building maps" : "Enter the verification code we sent to your email"}
        </p>

        {banner && (
          <div
            className={`${styles.banner} ${
              banner.type === "error" ? styles.bannerError :
              banner.type === "success" ? styles.bannerSuccess : styles.bannerInfo
            }`}
            role={banner.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {banner.text}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={submitStep1} className={styles.form} noValidate>
            <label className={styles.label}>
              Full name
              <input
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
                placeholder="John Doe"
                aria-invalid={!!errors.name}
                autoComplete="name"
              />
              {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
            </label>

            <label className={styles.label}>
              Email
              <input
                className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
              {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
            </label>

            <label className={styles.label}>
              Phone (optional)
              <input
                className={`${styles.input} ${errors.phone ? styles.inputError : ""}`}
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/[^\d]/g, "")); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
                placeholder="0912345678"
                aria-invalid={!!errors.phone}
                autoComplete="tel"
                inputMode="tel"
                maxLength={10}
              />
              {errors.phone && <div className={styles.fieldError}>{errors.phone}</div>}
            </label>

            <label className={styles.label}>
              Password
              <div className={styles.passRow}>
                <input
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="At least 8 characters"
                  aria-invalid={!!errors.password}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.peek}
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
              <div className={styles.strengthWrap} aria-hidden="true">
                <div className={`${styles.strengthBar} ${passScore >= 1 ? styles.strOn : ""}`} />
                <div className={`${styles.strengthBar} ${passScore >= 2 ? styles.strOn : ""}`} />
                <div className={`${styles.strengthBar} ${passScore >= 3 ? styles.strOn : ""}`} />
                <div className={`${styles.strengthBar} ${passScore >= 4 ? styles.strOn : ""}`} />
                <span className={styles.strengthLabel}>{password ? scoreLabel : ""}</span>
              </div>
              {errors.password && <div className={styles.fieldError}>{errors.password}</div>}
            </label>

            <label className={styles.label}>
              Confirm password
              <input
                className={`${styles.input} ${errors.confirm ? styles.inputError : ""}`}
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined })); }}
                placeholder="Re-enter your password"
                aria-invalid={!!errors.confirm}
                autoComplete="new-password"
              />
              {errors.confirm && <div className={styles.fieldError}>{errors.confirm}</div>}
            </label>

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => { setAgree(e.target.checked); if (errors.agree) setErrors((p) => ({ ...p, agree: undefined })); }}
                className={styles.checkbox}
              />
              <span>
                I agree to the <a className={styles.link} href="/terms">Terms</a> and <a className={styles.link} href="/privacy">Privacy Policy</a>.
              </span>
            </label>
            {errors.agree && <div className={styles.fieldError}>{errors.agree}</div>}

            <button className={styles.primaryBtn} type="submit" disabled={loading || !name || !email || !password || !confirm || !agree}>
              {loading ? "Sending…" : "Create account"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitStep2} className={styles.form} noValidate>
            <div className={styles.otpLabel}>Verification code</div>
            <div className={styles.otpRow}>
              <input
                className={`${styles.input} ${styles.otpInput} ${errors.otp ? styles.inputError : ""}`}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); if (errors.otp) setErrors((p) => ({ ...p, otp: undefined })); }}
                placeholder="Enter OTP"
                aria-invalid={!!errors.otp}
                autoFocus
              />
              <button type="submit" className={styles.primaryBtn} disabled={loading || !otp}>
                {loading ? "Verifying…" : "Verify & finish"}
              </button>
            </div>
            {errors.otp && <div className={styles.fieldError}>{errors.otp}</div>}

            <div className={styles.resendWrap}>
              <span>Didn’t get the code?</span>
              <button
                type="button"
                className={styles.resendBtn}
                disabled={loading}
                onClick={async () => {
                  setBanner(null);
                  setLoading(true);
                  try {
                    let firstName = "";
                    let lastName = "";
                    try {
                      const cached = localStorage.getItem("reg_name");
                      if (cached) {
                        const parsed = JSON.parse(cached) as NameParts;
                        firstName = parsed.firstName;
                        lastName = parsed.lastName;
                      } else {
                        ({ firstName, lastName } = splitVietnameseName(name));
                      }
                    } catch {
                      ({ firstName, lastName } = splitVietnameseName(name));
                    }
                    await postJson("/auth/verify-email", { firstName, lastName, email, phone: phone || null, password });
                    setBanner({ type: "info", text: "Verification code resent." });
                    setToast("Code resent ✉️");
                    setTimeout(() => setToast(null), 1400);
                  } catch (e: unknown) {
                    setBanner({ type: "error", text: prettyError(e, "Could not resend the code. Please try again later.") });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <div className={styles.divider}><span>or</span></div>

        <p className={styles.note}>
          Already have an account? <a className={styles.link} href="/login">Sign in</a>
        </p>
      </section>

      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`} role="status" aria-live="polite">
        <div className={styles.toastDot} />
        <span>{toast}</span>
      </div>
    </main>
  );
}
