"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyMembershipStatus, getPlans, Plan } from "@/lib/api-membership";


function usd(n?: number | null) {
  const v = typeof n === "number" ? n : 0;
  return `$${v.toFixed(2)}`;
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<{ id: number | null; status: string | null }>({ id: null, status: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ps = await getPlans();
        if (!alive) return;
        setPlans(ps);

        try {
          const me = await getMyMembershipStatus();
          if (!alive) return;
          setCurrent({ id: me.planId, status: me.status ?? "active" });
        } catch {
          const free = ps.find(p => (p.priceMonthly ?? 0) <= 0);
          setCurrent({ id: free?.planId ?? null, status: free ? "active" : null });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Billing</h2>

      {loading ? (
        <div className="text-sm text-zinc-400">Fetching plans…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((p) => {
            const isFree = (p.priceMonthly ?? 0) <= 0;
            const isCurrent = current.id === p.planId && current.status === "active";
            const isPending = current.id === p.planId && current.status === "pending";

            return (
              <div
                key={p.planId}
                className={[
                  "relative rounded-2xl border p-6 bg-zinc-900/50 backdrop-blur-sm shadow-lg transition",
                  isCurrent ? "border-emerald-400/60" : "border-white/10 hover:ring-1 hover:ring-emerald-400/30",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-semibold">{p.planName}</div>
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      Current plan
                    </span>
                  )}
                  {isPending && (
                    <span className="inline-flex items-center rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-300">
                      Pending payment
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-zinc-400">{p.description}</p>

                <div className="mt-5">
                  <span className="text-2xl font-bold text-emerald-400">
                    {isFree ? "$0.00" : usd(p.priceMonthly)}
                  </span>
                  <span className="ml-1 text-sm text-zinc-400">/month</span>
                </div>

                <div className="mt-5">
                  {isCurrent ? (
                    <span className="inline-flex items-center justify-center w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                      In use
                    </span>
                  ) : (
                    <Link
                      href={`/profile/select-plan?planId=${p.planId}`}
                      className="block text-center w-full rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:text-white hover:border-emerald-400 hover:bg-emerald-500/10 transition"
                    >
                      Select
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
