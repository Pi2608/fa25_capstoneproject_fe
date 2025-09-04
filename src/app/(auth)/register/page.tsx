"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";
import { postJson } from "@/lib/api";
import Link from "next/link";

type Banner = { type: "info" | "error" | "success"; text: string };

const phoneValid = (v: string) => /^\d{10}$/.test(v);
const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** ==== Types & Guards ==== */
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

/** ==== Helpers ==== */
function splitVietnameseName(fullName: string): NameParts {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  const lastName = parts[0] ?? "";
  const firstName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

/** Chuẩn hoá thông báo lỗi trả về từ BE để hiện cho người dùng */
function prettyError(err: unknown, fallback = "Có lỗi xảy ra. Vui lòng thử lại."): string {
  try {
    if (isPlainObject(err)) {
      const obj = err as Record<string, unknown>;

      // status số
      if (hasNumber(obj, "status")) {
        const st = obj.status as number;
        if (st === 429) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
        if (st === 401) return "Bạn không có quyền thực hiện thao tác này.";
        if (st === 403) return "Bạn không có quyền truy cập.";
        if (st === 404) return "Không tìm thấy tài nguyên.";
        if (st >= 500) return "Hệ thống đang bận. Vui lòng thử lại sau.";
      }

      // message / detail / title / type chuỗi
      const msgLike: string[] = [];
      if (hasString(obj, "message")) msgLike.push(String(obj.message));
      if (hasString(obj, "detail")) msgLike.push(String(obj.detail));
      if (hasString(obj, "title")) msgLike.push(String(obj.title));
      if (hasString(obj, "type")) msgLike.push(String(obj.type));

      for (const msg of msgLike) {
        if (/already exists/i.test(msg)) return "Email này đã được đăng ký, vui lòng dùng email khác.";
        if (/otp/i.test(msg) && /invalid|expired/i.test(msg)) return "Mã xác minh không đúng hoặc đã hết hạn.";
        if (/too many/i.test(msg) || /rate/i.test(msg)) return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
        if (/500|internal server/i.test(msg)) return "Hệ thống đang bận. Vui lòng thử lại sau.";
      }

      if (msgLike.length > 0) return msgLike[0]!;
    }

    if (typeof err === "string") {
      // Thử parse JSON string an toàn
      try {
        const j = JSON.parse(err) as unknown;
        return prettyError(j, fallback);
      } catch {
        const s = err;
        if (/already exists/i.test(s)) return "Email này đã được đăng ký, vui lòng dùng email khác.";
        if (/otp/i.test(s) && /invalid|expired/i.test(s)) return "Mã xác minh không đúng hoặc đã hết hạn.";
        if (/500|internal server/i.test(s)) return "Hệ thống đang bận. Vui lòng thử lại sau.";
        return s;
      }
    }
  } catch {
    // no-op
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
      // ignore cache errors
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

  const scoreLabel = ["Rất yếu", "Yếu", "Khá", "Mạnh", "Rất mạnh"][passScore];

  const validateStep1 = useCallback(() => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Vui lòng nhập tên.";
    if (!email.trim()) e.email = "Vui lòng nhập email.";
    else if (!emailValid(email)) e.email = "Email không hợp lệ.";
    if (phone && !phoneValid(phone)) e.phone = "Số điện thoại phải gồm đúng 10 chữ số.";
    if (!password.trim()) e.password = "Vui lòng nhập mật khẩu.";
    else if (password.length < 8) e.password = "Mật khẩu tối thiểu 8 ký tự.";
    if (!confirm.trim()) e.confirm = "Vui lòng nhập lại mật khẩu.";
    else if (confirm !== password) e.confirm = "Mật khẩu nhập lại không khớp.";
    if (!agree) e.agree = "Vui lòng đồng ý điều khoản.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [agree, confirm, email, name, password, phone]);

  const validateStep2 = useCallback(() => {
    const e: typeof errors = {};
    if (!otp.trim()) e.otp = "Vui lòng nhập mã xác minh.";
    else if (!/^\d{4,8}$/.test(otp)) e.otp = "Mã không hợp lệ.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [otp]);

  const submitStep1: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    setBanner(null);
    if (!validateStep1()) {
      setBanner({ type: "error", text: "Vui lòng điền đầy đủ thông tin." });
      return;
    }
    setLoading(true);
    try {
      const { firstName, lastName } = splitVietnameseName(name);
      await postJson(
        "/auth/verify-email",
        { firstName, lastName, email, phone: phone || null, password }
      );
      try {
        localStorage.setItem("reg_name", JSON.stringify({ firstName, lastName } satisfies NameParts));
        localStorage.setItem("reg_email", email);
      } catch {
        // ignore storage
      }
      setBanner({ type: "success", text: "Đã gửi mã xác minh tới email. Vui lòng kiểm tra hộp thư." });
      setStep(2);
    } catch (e: unknown) {
      setBanner({ type: "error", text: prettyError(e, "Không thể gửi mã xác minh. Vui lòng thử lại sau.") });
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
      setBanner({ type: "success", text: "Xác minh email thành công. Đang chuyển trang…" });
      setTimeout(() => router.push("/login"), 900);
    } catch (e: unknown) {
      setBanner({ type: "error", text: prettyError(e, "Mã xác minh không đúng hoặc đã hết hạn.") });
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
            <span className="text-lg font-semibold tracking-tight">CustomMapOSM</span>
          </Link>
          <span className={styles.tagline}>Tạo tài khoản chỉ trong vài giây</span>
        </div>
      </div>

      <section className={styles.card}>
        <h1 className={styles.title}>Tạo tài khoản</h1>
        <p className={styles.sub}>
          {step === 1 ? "Tham gia và bắt đầu tạo bản đồ" : "Nhập mã xác minh đã gửi tới email"}
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
              Họ và tên
              <input
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
                placeholder="Nguyễn Văn A"
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
                placeholder="ban@example.com"
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
              {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
            </label>

            <label className={styles.label}>
              Số điện thoại (tuỳ chọn)
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
              Mật khẩu
              <div className={styles.passRow}>
                <input
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="Ít nhất 8 ký tự"
                  aria-invalid={!!errors.password}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={styles.peek}
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPass ? "Ẩn" : "Hiện"}
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
              Nhập lại mật khẩu
              <input
                className={`${styles.input} ${errors.confirm ? styles.inputError : ""}`}
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined })); }}
                placeholder="Nhập lại mật khẩu"
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
                Tôi đồng ý với <a className={styles.link} href="/terms">Điều khoản</a> và <a className={styles.link} href="/privacy">Chính sách bảo mật</a>.
              </span>
            </label>
            {errors.agree && <div className={styles.fieldError}>{errors.agree}</div>}

            <button className={styles.primaryBtn} type="submit" disabled={loading || !name || !email || !password || !confirm || !agree}>
              {loading ? "Đang gửi…" : "Tạo tài khoản"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitStep2} className={styles.form} noValidate>
            <div className={styles.otpLabel}>Mã xác minh</div>
            <div className={styles.otpRow}>
              <input
                className={`${styles.input} ${styles.otpInput} ${errors.otp ? styles.inputError : ""}`}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); if (errors.otp) setErrors((p) => ({ ...p, otp: undefined })); }}
                placeholder="Nhập mã OTP"
                aria-invalid={!!errors.otp}
                autoFocus
              />
              <button type="submit" className={styles.primaryBtn} disabled={loading || !otp}>
                {loading ? "Đang xác minh…" : "Xác minh & hoàn tất"}
              </button>
            </div>
            {errors.otp && <div className={styles.fieldError}>{errors.otp}</div>}

            <div className={styles.resendWrap}>
              <span>Không nhận được mã?</span>
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
                    await postJson(
                      "/auth/verify-email",
                      { firstName, lastName, email, phone: phone || null, password }
                    );
                    setBanner({ type: "info", text: "Đã gửi lại mã xác minh." });
                  } catch (e: unknown) {
                    setBanner({ type: "error", text: prettyError(e, "Không thể gửi lại mã. Vui lòng thử lại sau.") });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Gửi lại mã
              </button>
            </div>
          </form>
        )}

        <div className={styles.divider}><span>hoặc</span></div>

        <p className={styles.note}>
          Đã có tài khoản? <a className={styles.link} href="/login">Đăng nhập</a>
        </p>
      </section>
    </main>
  );
}
