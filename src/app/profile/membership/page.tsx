"use client";

import { useEffect, useState } from "react";
import {
  getPlans,
  createOrRenewMembership,
  type Plan,
  type MembershipResponse,
} from "@/lib/api";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Request failed";
}

export default function MembershipPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getPlans();
        if (alive) setPlans(data);
      } catch (err: unknown) {
        if (alive) setError(safeMessage(err));
      } finally {
        if (alive) setLoadingPlans(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleChoose = (plan: Plan) => {
    setSelected(plan);
    setMsg(null);
    setError(null);
  };

  const pay = async () => {
    if (!selected) return;
    setSubmitting(true);
    setMsg(null);
    setError(null);
    try {
      const res: MembershipResponse = await createOrRenewMembership({ planId: selected.planId });
      setMsg(`Membership status: ${res.status}`);
    } catch (err: unknown) {
      setError(safeMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="text-zinc-100">
      <h1 className="text-2xl font-semibold mb-4">Membership</h1>

      {loadingPlans && <p className="text-sm text-zinc-400">Loading plans…</p>}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {msg}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const isSelected = selected?.planId === p.planId;
          return (
            <div
              key={p.planId}
              className={`rounded-2xl border p-6 bg-zinc-900/50 shadow-lg ${
                isSelected ? "border-emerald-400/60 ring-1 ring-emerald-400/40" : "border-white/10"
              }`}
            >
              <div className="text-lg font-medium">{p.planName}</div>
              <p className="mt-1 text-sm text-zinc-400">{p.description}</p>
              <div className="mt-4 text-2xl font-bold text-emerald-400">
                ${p.priceMonthly.toFixed(2)} <span className="text-sm text-zinc-400">/month</span>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => handleChoose(p)}
                  className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    isSelected
                      ? "border-emerald-400/70 text-emerald-300"
                      : "border-white/10 text-zinc-300 hover:text-white"
                  }`}
                >
                  {isSelected ? "Selected" : "Select"}
                </button>

                <button
                  onClick={pay}
                  disabled={!isSelected || submitting}
                  className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-zinc-950"
                >
                  {submitting ? "Processing…" : "Subscribe"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
