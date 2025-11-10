"use client";

import { getMyMembershipStatus, getPlans, type Plan } from "@/lib/api-membership";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

function safeMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

export default function MembershipPage() {
  const { t } = useI18n();
  const tr = (k: string) => t("membership", k);

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
          const me = await getMyMembershipStatus();
          if (!alive) return;
          const found = ps.find((p) => p.planId === me.planId);
          if (found) {
            setCurrentPlan(found);
            setStatus(me.status ?? "active");
            return;
          }
        } catch {
          // ignore, fallback to free plan below
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

  const statusLabel = (s: string | null): string | null => {
    if (!s) return null;
    const k = s.toLowerCase();
    const map: Record<string, string> = {
      active: tr("status_active"),
      trialing: tr("status_trialing"),
      past_due: tr("status_past_due"),
      canceled: tr("status_canceled"),
      expired: tr("status_expired"),
      inactive: tr("status_inactive"),
    };
    return map[k] ?? s;
  };

  return (
    <main className="text-zinc-100">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{tr("title")}</h1>
        <p className="text-zinc-400 mt-1">{tr("subtitle")}</p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{tr("current_plan_title")}</div>
            {!loading && currentPlan && (
              <span className="rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 text-xs font-semibold">
                {statusLabel(status)}
              </span>
            )}
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="text-sm text-zinc-400">{tr("loading")}</div>
            ) : currentPlan ? (
              <>
                <div className="text-xl font-semibold">{currentPlan.planName}</div>
                <p className="text-sm text-zinc-400 mt-1">{currentPlan.description || "—"}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-400">
                    {currentPlan.priceMonthly === 0
                      ? "$0.00"
                      : `$${currentPlan.priceMonthly!.toFixed(2)}`}
                  </span>
                  <span className="text-sm md:text-base text-zinc-400">{tr("per_month")}</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-400">{tr("no_plan")}</div>
            )}
          </div>

        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 backdrop-blur-sm">
          <div className="text-lg font-semibold">{tr("benefits_title")}</div>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            <li>• {tr("benefit_1")}</li>
            <li>• {tr("benefit_2")}</li>
            <li>• {tr("benefit_3")}</li>
            <li>• {tr("benefit_4")}</li>
          </ul>
          <div className="mt-4">
            <Link
              href="/profile/select-plan"
              className="inline-flex items-center rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:text-emerald-200 transition"
            >
              {tr("cta_view_plans")}
            </Link>
          </div>
        </div>
      </div>

    </main>
  );
}
