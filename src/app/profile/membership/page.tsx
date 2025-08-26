"use client";

import { useEffect, useState } from "react";
import {
  createOrRenewMembership,
  type MembershipResponse,
  getPlans,
  type Plan,
} from "@/lib/api";
import { toast } from "react-toastify";

export default function MembershipPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MembershipResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getPlans();
        setPlans(data ?? []);
        if (data?.length) setPlanId(data[0].planId);
      } catch (e: any) {
        toast.error("Failed to load plans.");
      }
    })();
  }, []);

  const onSubmit = async () => {
    if (!planId) {
      setError("Please select a plan.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const res = await createOrRenewMembership({ planId });
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "Failed to create/renew membership");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-semibold mb-2 text-white">Membership</h1>
      <p className="text-zinc-400 mb-6">Create or renew your membership.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-2 text-zinc-300">Select plan</label>
          <select
            value={planId ?? ""}
            onChange={(e) => setPlanId(Number(e.target.value))}
            className="w-full rounded-md bg-zinc-900 border border-white/10 px-3 py-2 text-sm text-white"
          >
            {plans.length === 0 && <option value="">(No plans loaded)</option>}
            {plans.map((p) => (
              <option key={p.planId} value={p.planId}>
                {p.planName} — ${p.priceMonthly}/mo
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onSubmit}
          disabled={submitting}
          className="px-5 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Processing…" : "Create / Renew membership"}
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <div className="text-sm text-emerald-300">
            ✅ Membership ID: <b>{result.membershipId}</b> — Status: <b>{result.status}</b>
          </div>
        )}
      </div>
    </div>
  );
}
