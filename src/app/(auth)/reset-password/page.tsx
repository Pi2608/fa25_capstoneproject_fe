"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { getApiMessage } from "@/lib/errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (newPassword.length < 8) {
      setErr("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Mật khẩu nhập lại không khớp.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ otp, newPassword, confirmPassword });
      router.push("/login");
    } catch (err: unknown) {
      setErr(getApiMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-zinc-900/70 via-[#0d1412] to-zinc-900/80 text-zinc-100 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-emerald-400/10 blur-3xl" />

      <section className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-center py-16">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl shadow-2xl shadow-emerald-900/20 ring-1 ring-emerald-400/10">
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-semibold">
                <span className="bg-gradient-to-r from-emerald-300 to-emerald-400 bg-clip-text text-transparent">
                  Đặt lại mật khẩu
                </span>
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Nhập mã xác minh (OTP) và mật khẩu mới của bạn.
              </p>

              {err && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {err}
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-300">Mã xác minh (OTP)</span>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Mã gồm 6 chữ số"
                    className="w-full rounded-xl px-3 py-2.5 bg-zinc-900/70 placeholder-zinc-500 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60 transition"
                    required
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-300">Mật khẩu mới</span>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl px-3 py-2.5 pr-20 bg-zinc-900/70 placeholder-zinc-500 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-white/5"
                    >
                      {showNew ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sử dụng 8+ ký tự gồm cả chữ và số.
                  </p>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-300">Xác nhận mật khẩu mới</span>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl px-3 py-2.5 pr-20 bg-zinc-900/70 placeholder-zinc-500 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-zinc-300 hover:text-white hover:bg-white/5"
                    >
                      {showConfirm ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading || !otp || !newPassword || !confirmPassword}
                  className="group w-full rounded-xl py-2.5 font-medium text-zinc-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {loading ? "Đang cập nhật…" : "Đặt mật khẩu mới"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-zinc-400">
                <a
                  href="/forgot-password"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Gửi lại mã
                </a>{" "}
                ·{" "}
                <a
                  href="/login"
                  className="text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  Quay lại đăng nhập
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
