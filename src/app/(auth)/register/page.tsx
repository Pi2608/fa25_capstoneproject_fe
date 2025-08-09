"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";
import { apiFetch } from "@/lib/api";

type Banner = { type: "info" | "error" | "success"; text: string };

const phoneValid = (v: string) => /^\d{10}$/.test(v);
const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function splitVietnameseName(fullName: string) {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  const lastName = parts[0];
  const firstName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [agree, setAgree] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; password?: string; confirm?: string; agree?: string; otp?: string }>({});

  useEffect(() => {
    try {
      const cachedEmail = localStorage.getItem("reg_email");
      const cachedName = localStorage.getItem("reg_name");
      if (cachedEmail && cachedName) {
        const { firstName, lastName } = JSON.parse(cachedName);
        if (!name) setName([lastName, firstName].filter(Boolean).join(" "));
        if (!email) setEmail(cachedEmail);
      }
    } catch {}
  }, []);

  const passScore = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(s, 4);
  }, [password]);

  const scoreLabel = ["Rất yếu", "Yếu", "Khá", "Mạnh", "Rất mạnh"][passScore];

  const validateStep1 = () => {
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
  };

  const validateStep2 = () => {
    const e: typeof errors = {};
    if (!otp.trim()) e.otp = "Vui lòng nhập mã xác minh.";
    else if (!/^\d{4,8}$/.test(otp)) e.otp = "Mã không hợp lệ.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitStep1 = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBanner(null);
    if (!validateStep1()) {
      setBanner({ type: "error", text: "Vui lòng điền đầy đủ thông tin." });
      return;
    }
    setLoading(true);
    try {
      const { firstName, lastName } = splitVietnameseName(name);
      await apiFetch("/auth/verify-email", {
        method: "POST",
        body: {
          firstName,
          lastName,
          email,
          phone: phone || null,
          password,
        },
      });
      try {
        localStorage.setItem("reg_name", JSON.stringify({ firstName, lastName }));
        localStorage.setItem("reg_email", email);
      } catch {}
      setBanner({ type: "success", text: "Đã gửi mã xác minh tới email. Vui lòng kiểm tra hộp thư." });
      setStep(2);
    } catch (e: any) {
      const text =
        e?.message?.includes("fetch") || e?.name === "TypeError"
          ? "Không thể kết nối tới máy chủ. Vui lòng thử lại."
          : e?.message || "Không thể gửi mã xác minh.";
      setBanner({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const submitStep2 = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBanner(null);
    if (!validateStep2()) return;
    setLoading(true);
    try {
      // Bước 2 đúng endpoint: /auth/verify-otp, chỉ cần { otp }
      await apiFetch("/auth/verify-otp", {
        method: "POST",
        body: { otp },
      });

      setBanner({ type: "success", text: "Xác minh email thành công. Đang chuyển trang…" });
      setTimeout(() => router.push("/login"), 900);
    } catch (e: any) {
      const text =
        e?.message?.includes("fetch") || e?.name === "TypeError"
          ? "Không thể kết nối tới máy chủ. Vui lòng thử lại."
          : e?.message || "Mã xác minh không đúng hoặc đã hết hạn.";
      setBanner({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (banner?.type === "error") return;
    if (Object.keys(errors).length && step === 1) validateStep1();
    if (Object.keys(errors).length && step === 2) validateStep2();
  }, [name, email, phone, password, confirm, agree, otp, step]);

  return (
    <main className={styles.wrap}>
      <div className={styles.brandBar}>
        <div className={styles.logoDot} />
        <div className={styles.brandWrap}>
          <span className={styles.brand}>CustomMapOSM</span>
          <span className={styles.tagline}>Create your account in seconds</span>
        </div>
      </div>

      <section className={styles.card}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.sub}>{step === 1 ? "Join us and start mapping" : "Nhập mã xác minh đã gửi tới email"}</p>

        {banner && (
          <div
            className={`${styles.banner} ${banner.type === "error" ? styles.bannerError : banner.type === "success" ? styles.bannerSuccess : styles.bannerInfo}`}
            role={banner.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {banner.text}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={submitStep1} className={styles.form} noValidate>
            {/* ... form step 1 giữ nguyên như của anh ... */}
            <label className={styles.label}>
              Full name
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
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                autoComplete="email"
              />
              {errors.email && <div className={styles.fieldError}>{errors.email}</div>}
            </label>

            <label className={styles.label}>
              Phone (tuỳ chọn)
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
                  placeholder="Ít nhất 8 ký tự"
                  aria-invalid={!!errors.password}
                  autoComplete="new-password"
                />
                <button type="button" className={styles.peek} onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
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
              {loading ? "Sending…" : "Create account"}
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
                {loading ? "Verifying…" : "Verify & finish"}
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
                      if (cached) ({ firstName, lastName } = JSON.parse(cached));
                      else ({ firstName, lastName } = splitVietnameseName(name));
                    } catch {
                      ({ firstName, lastName } = splitVietnameseName(name));
                    }
                    await apiFetch("/auth/verify-email", {
                      method: "POST",
                      body: {
                        firstName,
                        lastName,
                        email,
                        phone: phone || null,
                        password,
                      },
                    });
                    setBanner({ type: "info", text: "Đã gửi lại mã xác minh." });
                  } catch (e: any) {
                    const text =
                      e?.message?.includes("fetch") || e?.name === "TypeError"
                        ? "Không thể kết nối tới máy chủ. Vui lòng thử lại."
                        : e?.message || "Không thể gửi lại mã.";
                    setBanner({ type: "error", text });
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

        <div className={styles.divider}><span>or</span></div>

        <p className={styles.note}>
          Đã có tài khoản? <a className={styles.link} href="/login">Sign in</a>
        </p>
      </section>
    </main>
  );
}
