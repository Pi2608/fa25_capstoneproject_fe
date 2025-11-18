"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acceptInvite,
  AcceptInviteOrganizationReqDto,
  GetInvitationsResDto,
  getMyInvitations,
  rejectInvite,
  RejectInviteOrganizationReqDto,
} from "@/lib/api-organizations";
import { useI18n } from "@/i18n/I18nProvider";
import type { KeysOf, Namespaces } from "@/i18n/messages";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type ApiLikeError = {
  status?: number;
  message?: string;
  detail?: string;
};

function toApiError(err: unknown): ApiLikeError {
  if (typeof err === "object" && err !== null) {
    const r = err as Record<string, unknown>;
    return {
      status: typeof r.status === "number" ? r.status : undefined,
      message: typeof r.message === "string" ? r.message : undefined,
      detail: typeof r.detail === "string" ? r.detail : undefined,
    };
  }
  return {};
}

export default function MyInvitationsPage() {
  const { t } = useI18n();
  const tPath = t as unknown as (
    path: `${Namespaces}.${string}`,
    vars?: Record<string, string | number>
  ) => string;
  type InviteKeys = KeysOf<"invites">;
  const tr = (k: InviteKeys) => tPath(`invites.${k}` as const);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const update = () => {
      setIsDark(root.classList.contains("dark"));
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);
  const [data, setData] = useState<GetInvitationsResDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await getMyInvitations();
      setData(res);
      setErr(null);
    } catch {
      setErr(tr("load_failed"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const invitations = data?.invitations ?? [];

  const pending = useMemo(
    () =>
      invitations.filter(
        (i) => !i.isAccepted && !(i as { isRejected?: boolean }).isRejected
      ),
    [invitations]
  );

  const pendingCount = pending.length;

  async function onAccept(invitationId: string) {
    setBusyId(invitationId);
    try {
      const body: AcceptInviteOrganizationReqDto = { invitationId };
      await acceptInvite(body);
      setToast(tr("toast_accept_ok"));
      await load();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("invitations-changed"));
    } catch (e: unknown) {
      const errObj = toApiError(e);
      if ((errObj.status ?? 0) === 409) {
        setToast(tr("toast_already_accepted"));
        await load();
        if (typeof window !== "undefined")
          window.dispatchEvent(new Event("invitations-changed"));
      } else {
        alert(errObj.detail ?? errObj.message ?? tr("accept_failed"));
      }
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(invitationId: string) {
    setBusyId(invitationId);
    try {
      const body: RejectInviteOrganizationReqDto = { invitationId };
      await rejectInvite(body);
      setToast(tr("toast_reject_ok"));
      await load();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("invitations-changed"));
    } catch (e: unknown) {
      const errObj = toApiError(e);
      alert(errObj.detail ?? errObj.message ?? tr("reject_failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-w-0 relative px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2 mb-6">
              <span style={{ color: isDark ? "#ffffff" : "#000000" }}>
                {tr("title")}
              </span>

              <span
                className={[
                  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  pendingCount > 0
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/40"
                    : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-white/5 dark:text-zinc-300 dark:border-white/10",
                ].join(" ")}
              >
                {pendingCount}
              </span>
            </h1>

          </div>

          <button
            onClick={() => load()}
            disabled={loading}
            className={[
              "inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors",
              loading
                ? "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-wait dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
            ].join(" ")}
          >
            {tr("refresh")}
          </button>
        </div>

        {toast && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100">
            {toast}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-zinc-200 bg-white/80 shadow-sm animate-pulse dark:border-zinc-800 dark:bg-zinc-900/70"
              />
            ))}
          </div>
        )}

        {!loading && err && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-100">
            {err}
          </div>
        )}

        {!loading && !err && pending.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white/90 p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
            {tr("empty_pending")}
          </div>
        )}

        {!loading && !err && pending.length > 0 && (
          <div className="space-y-3">
            {pending.map((inv) => (
              <div
                key={inv.invitationId}
                className="rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-zinc-800 dark:bg-zinc-900/90"
              >
                <div className="space-y-1">
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {inv.orgName ?? tr("org_missing")}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    {tr("invited_by")}{" "}
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">
                      {inv.inviterEmail ?? "—"}
                    </span>{" "}
                    • {tr("role")}{" "}
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      {inv.memberType ?? tr("role_member_default")}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {tr("invited_at")}: {fmtDate(inv.invitedAt)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={busyId === inv.invitationId}
                    onClick={() => onAccept(inv.invitationId)}
                    className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold shadow-sm hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busyId === inv.invitationId
                      ? tr("processing")
                      : tr("btn_accept")}
                  </button>
                  <button
                    disabled={busyId === inv.invitationId}
                    onClick={() => onReject(inv.invitationId)}
                    className="px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  >
                    {tr("btn_reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading &&
          !err &&
          invitations.some((i) => i.isAccepted) && (
            <div className="pt-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2 dark:text-zinc-400">
                {tr("processed_header")}
              </div>
              <div className="space-y-2">
                {invitations
                  .filter((i) => i.isAccepted)
                  .map((inv) => (
                    <div
                      key={inv.invitationId}
                      className="rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 text-sm text-zinc-700 flex items-center justify-between shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-200"
                    >
                      <div className="space-x-1">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {inv.orgName}
                        </span>
                        <span>•</span>
                        <span>{tr("role")}</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">
                          {inv.memberType ?? tr("role_member_default")}
                        </span>
                        <span>•</span>
                        <span>
                          {tr("accepted_at")}: {fmtDate(inv.acceptedAt ?? undefined)}
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/40">
                        {tr("badge_accepted")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
