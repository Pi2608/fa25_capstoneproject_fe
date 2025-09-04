"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlans, type Plan, getJson } from "@/lib/api";

type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

export default function MembershipPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ps = await getPlans();
        if (!alive) return;
        setPlans(ps);

        try {
          const me = await getJson<MyMembership>("/membership/me");
          if (!alive) return;
          const found = ps.find((p) => p.planId === me.planId);
          if (found) {
            setCurrentPlan(found);
            setStatus(me.status ?? "active");
            return;
          }
        } catch {
        }

        const free = ps.find((p) => p.priceMonthly === 0) || null;
        setCurrentPlan(free);
        setStatus(free ? "active" : null);
      } catch (e) {
        if (!alive) return;
        setErr(safeMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="text-zinc-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Thành viên</h1>
        <p className="text-zinc-400 mt-1">
          Quản lý trạng thái gói và quyền lợi của bạn. Muốn đổi gói? Nhấn <strong>Chọn gói</strong>.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Gói hiện tại</div>
            {!loading && currentPlan && (
              <span className="rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 text-xs font-semibold">
                {status === "active" ? "Đang dùng" : status}
              </span>
            )}
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="text-sm text-zinc-400">Đang tải…</div>
            ) : currentPlan ? (
              <>
                <div className="text-xl font-semibold">{currentPlan.planName}</div>
                <p className="text-sm text-zinc-400 mt-1">{currentPlan.description || "—"}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-400">
                    {currentPlan.priceMonthly === 0
                      ? "$0.00"
                      : `$${currentPlan.priceMonthly.toFixed(2)}`}
                  </span>
                  <span className="text-sm md:text-base text-zinc-400">/tháng</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-400">Không có gói nào.</div>
            )}
          </div>

          {/* <div className="mt-4">
            <Link
              href="/profile/select-plan"
              className="inline-flex items-center rounded-xl bg-emerald-500/90 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition"
            >
              Chọn gói
            </Link>
          </div> */}
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-sm">
          <div className="text-lg font-semibold">Quyền lợi nổi bật</div>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            <li>• Tải dữ liệu raster, vector, bảng tính…</li>
            <li>• Lọc & phân tích không gian</li>
            <li>• Dashboard, biểu đồ & xuất bản đồ</li>
            <li>• Chia sẻ & cộng tác theo thời gian thực</li>
          </ul>
          <div className="mt-4">
            <Link
              href="/profile/select-plan"
              className="inline-flex items-center rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:text-emerald-200 transition"
            >
              Xem các gói
            </Link>
          </div>
        </div>
      </div>

      {/* <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-sm">
        <div className="text-lg font-semibold">Thao tác nhanh</div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/profile/select-plan"
            className="rounded-xl bg-emerald-500/90 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition"
          >
            Chọn gói
          </Link>
          <Link
            href="/profile/help"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition"
          >
            Trợ giúp
          </Link>
        </div>
      </div> */}
    </main>
  );
}
