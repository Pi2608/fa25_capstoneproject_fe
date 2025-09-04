"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordVerify } from "@/lib/api";
import { getApiMessage } from "@/lib/errors";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await resetPasswordVerify({ email });
      router.push("/reset-password");
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
                  Quên mật khẩu
                </span>
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Nhập email của bạn. Chúng tôi sẽ gửi mã xác minh (OTP) để đặt lại mật khẩu.
              </p>

              {err && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {err}
                </div>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-300">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@example.com"
                    className="w-full rounded-xl px-3 py-2.5 bg-zinc-900/70 placeholder-zinc-500 border border-white/10 outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60 transition"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="group w-full rounded-xl py-2.5 font-medium text-zinc-950 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {loading ? "Đang gửi…" : "Gửi mã"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-zinc-400">
                Nhớ ra mật khẩu rồi?{" "}
                <a href="/login" className="text-emerald-400 hover:text-emerald-300 hover:underline">
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
