"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import {
  getJson,
  getPlans,
  type Plan,
} from "@/lib/api";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

const fmtCurrency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

export default function PricingPage() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    router.push(`/profile/select-plan?planId=${plan.planId}`);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const NAV = [
    { label: "Dịch vụ", href: "/service" },
    { label: "Hướng dẫn", href: "/tutorial" },
    { label: "Mẫu", href: "/templates" },
    { label: "Bảng giá", href: "/pricing" },
    { label: "Cộng đồng", href: "/community" },
  ] as const;

  const DICH_VU: { label: string; desc: string; href: string }[] = [
    { label: "Trình tạo bản đồ", desc: "Tạo bản đồ web tương tác nhanh, không cần cài đặt.", href: "/service/map-builder" },
    { label: "Lớp dữ liệu", desc: "Quản lý lớp vector & raster, style linh hoạt.", href: "/service/data-layers" },
    { label: "Nguồn đám mây", desc: "Kết nối PostGIS, GeoServer, S3, Google Drive…", href: "/service/cloud-sources" },
    { label: "Bảng điều khiển", desc: "Ghép bản đồ với biểu đồ & số liệu thành dashboard.", href: "/service/dashboards" },
    { label: "Cộng tác", desc: "Chia sẻ & chỉnh sửa nhóm theo thời gian thực.", href: "/service/collaboration" },
    { label: "Xuất & Nhúng", desc: "Xuất PNG/PDF, nhúng vào website hoặc ứng dụng.", href: "/service/export-embed" },
  ];

  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getPlans();
        if (!alive) return;
        setPlans(data);

        if (isLoggedIn) {
          try {
            const me = await getJson<MyMembership>("/membership/me");
            if (!alive) return;

            const found = data.find((p) => p.planId === me.planId);
            if (found) {
              setCurrentPlan(found);
              setStatus(me.status ?? "active");
            } else {
              const free = data.find((p) => (p.priceMonthly ?? 0) <= 0) || null;
              setCurrentPlan(free);
              setStatus(free ? "active" : null);
            }
          } catch {
            const free = data.find((p) => (p.priceMonthly ?? 0) <= 0) || null;
            setCurrentPlan(free);
            setStatus(free ? "active" : null);
          }
        } else {
          setCurrentPlan(null);
          setStatus(null);
        }
      } catch (err: unknown) {
        if (!alive) return;
        setError(safeMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isLoggedIn]);

  const popularIds = useMemo(() => {
    const s = new Set<number>();
    plans.forEach((p) => { if (/pro/i.test(p.planName)) s.add(p.planId); });
    return s;
  }, [plans]);

  const currentId = currentPlan?.planId ?? null;

  const renderStatusBadge = (p: Plan) => {
    const isCurrent = currentId === p.planId && status === "active";
    const isPending = currentId === p.planId && status === "pending";
    const isExpired = currentId === p.planId && status === "expired";

    if (isCurrent)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          Đang dùng
        </span>
      );
    if (isPending)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-yellow-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          Đang chờ thanh toán
        </span>
      );
    if (isExpired)
      return (
        <span className="absolute -top-2 right-4 rounded-full bg-zinc-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
          Hết hạn
        </span>
      );
    return null;
  };

  return (
    <main className="relative min-h-screen text-white">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/bg.avif"
          alt="Nền bản đồ"
          fill
          priority
          unoptimized
          quality={100}
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <header className="sticky top-0 z-40">
        <div className="pointer-events-none absolute inset-x-0 -z-10 h-20 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-400 shadow" />
            <span className="text-lg md:text-xl font-bold tracking-tight text-white">
              CustomMapOSM
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="mega-menu"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition"
              >
                Dịch vụ
                <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                </svg>
              </button>

              {open && (
                <div
                  id="mega-menu"
                  role="menu"
                  tabIndex={-1}
                  className="absolute left-1/2 -translate-x-1/2 mt-4 w-[640px] max-w-[90vw] rounded-2xl bg-zinc-900/90 backdrop-blur-md ring-1 ring-white/10 shadow-2xl p-4 md:p-5"
                  onMouseEnter={() => setOpen(true)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {DICH_VU.map((it) => (
                      <Link
                        key={it.label}
                        href={it.href}
                        className="group flex items-start gap-3 rounded-xl p-3 md:p-4 hover:bg-white/10 focus:bg-white/10 outline-none transition"
                        onClick={() => setOpen(false)}
                      >
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400">
                            <path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v5l4 2-.7 1.2L11 13V7h2Z" />
                          </svg>
                        </span>
                        <div className="leading-tight">
                          <div className="text-[15px] md:text-[16px] font-semibold text-white group-hover:text-emerald-400">
                            {it.label}
                          </div>
                          <p className="text-sm text-white/70 mt-1">{it.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-white/10 pt-3 flex justify-end">
                    <Link href="/service" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300" onClick={() => setOpen(false)}>
                      Xem thêm →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {NAV.slice(1).map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {!isLoggedIn ? (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-base font-semibold text-white/90 hover:text-white">Đăng nhập</Link>
                <Link href="/register" className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold text-zinc-950 shadow hover:bg-emerald-400 transition">Bắt đầu</Link>
              </>
            ) : (
              <>
                <Link href="/profile" className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold text-zinc-950 shadow hover:bg-emerald-400 transition">Hồ sơ</Link>
                <button onClick={onLogout} className="rounded-lg px-3 py-2 text-base font-semibold text-white/90 hover:text-red-400">Đăng xuất</button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Bảng giá</h1>
        <p className="mt-2 text-zinc-200">
          Các gói đơn giản, mở rộng theo nhu cầu. Không phí ẩn.
        </p>
      </section>

      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-16">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(loading ? Array.from({ length: 4 }) : plans).map((p, i) => {
            if (loading) {
              return (
                <div
                  key={`skeleton-${i}`}
                  className="relative rounded-2xl border p-6 bg-zinc-900/40 backdrop-blur-sm border-white/10 shadow-lg animate-pulse"
                >
                  <div className="h-5 w-28 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-40 rounded bg-white/5" />
                  <div className="mt-6 h-8 w-32 rounded bg-white/10" />
                  <div className="mt-6 h-10 w-full rounded-xl bg-white/5" />
                </div>
              );
            }

            const plan = p as Plan;
            const isPopular = popularIds.has(plan.planId);
            const isFree = (plan.priceMonthly ?? 0) === 0;

            const isCurrentActive = currentId === plan.planId && status === "active";
            const isCurrentPending = currentId === plan.planId && status === "pending";

            return (
              <div
                key={plan.planId}
                className={[
                  "relative rounded-2xl border p-6",
                  "bg-zinc-900/60 backdrop-blur-sm border-white/10",
                  "shadow-lg transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30",
                  isPopular ? "ring-1 ring-emerald-400/30" : "",
                ].join(" ")}
              >
                {isPopular && !isCurrentActive && (
                  <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
                    Phổ biến
                  </span>
                )}

                {renderStatusBadge(plan)}

                <div className="flex h-full flex-col">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.planName}</h3>
                    {plan.description && (
                      <p className="mt-1 text-sm text-zinc-300">{plan.description}</p>
                    )}
                  </div>

                  <div className="mt-5">
                    <span className="text-3xl font-bold text-emerald-400">
                      {isFree ? "$0.00" : fmtCurrency.format(plan.priceMonthly)}
                    </span>
                    <span className="ml-1 text-sm text-zinc-300">/tháng</span>
                  </div>

                  <div className="mt-auto">
                    {isCurrentActive ? (
                      <span className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300">
                        Đang dùng
                      </span>
                    ) : (
                      <button
                        className="w-full rounded-xl py-2.5 font-medium text-zinc-950 bg-emerald-500/90 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 transition"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {isCurrentPending && currentId === plan.planId
                          ? "Tiếp tục thanh toán"
                          : "Chọn gói"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {plans.some((p) => (p.priceMonthly ?? 0) > 0) && (
          <p className="mt-6 text-xs text-zinc-500">
            * Chỉ các gói trả phí mới yêu cầu thanh toán. Gói Free không cần đăng ký.
          </p>
        )}
      </section>
    </main>
  );
}
