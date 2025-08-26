"use client";

import { useEffect, useMemo, useState } from "react";
import { getPlans, type Plan } from "@/lib/api";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Request failed";
}

const fmtCurrency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getPlans();
        if (alive) setPlans(data);
      } catch (err: unknown) {
        if (alive) setError(safeMessage(err));
      }
    })();
    return () => { alive = false; };
  }, []);

  const popularIds = useMemo(() => {
    const s = new Set<number>();
    plans.forEach(p => { if (/pro/i.test(p.planName)) s.add(p.planId); });
    return s;
  }, [plans]);

  return (
    <main className="relative mx-auto max-w-screen-2xl px-4 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.18),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.12),transparent)]" />

      <h1 className="text-3xl font-semibold mb-2">Pricing</h1>
      <p className="mb-8 text-zinc-400">Simple plans that scale with you. No hidden fees.</p>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const isPopular = popularIds.has(p.planId);
          const isFree = p.priceMonthly === 0;

          return (
            <div
              key={p.planId}
              className={[
                "relative rounded-2xl border p-6",
                "bg-zinc-900/50 backdrop-blur-sm border-white/10",
                "shadow-lg transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30",
                isPopular ? "ring-1 ring-emerald-400/30" : ""
              ].join(" ")}
            >
              {isPopular && (
                <span className="absolute -top-2 right-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow">
                  Popular
                </span>
              )}

              <div className="flex h-full flex-col">
                <div>
                  <h3 className="text-lg font-semibold">{p.planName}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{p.description}</p>
                </div>

                <div className="mt-5">
                  <span className="text-3xl font-bold text-emerald-400">
                    {isFree ? "$0.00" : fmtCurrency.format(p.priceMonthly)}
                  </span>
                  <span className="ml-1 text-sm text-zinc-400">/month</span>
                </div>

                <button
                  className="mt-auto w-full rounded-xl py-2.5 font-medium text-zinc-950 bg-emerald-500/90 hover:bg-emerald-400 shadow-lg shadow-emerald-900/20 transition"
                  onClick={() => alert(`Choose plan: ${p.planName}`)}
                >
                  Choose plan
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
