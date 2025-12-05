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
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

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
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{tr("title")}</h1>
          <span
            className={[
              "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
              pendingCount > 0
                ? (isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" : "bg-emerald-100 text-emerald-700 border-emerald-200")
                : `${themeClasses.textMuted} ${themeClasses.tableBorder}`,
            ].join(" ")}
            aria-label={tr("badge_aria")}
          >
            {pendingCount}
          </span>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className={`rounded-md border px-3 py-1.5 text-sm ${loading ? (isDark ? "bg-zinc-800 text-zinc-500 cursor-wait" : "bg-gray-300 text-gray-500 cursor-wait") : themeClasses.button}`}
        >
          {tr("refresh")}
        </button>
      </div>

      {toast && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {toast}
        </div>
      )}

      {err && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-800"}`}>
          {err}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`h-20 rounded-xl border animate-pulse ${themeClasses.panel}`}
            />
          ))}
        </div>
      )}

      {!loading && !err && pending.length === 0 && (
        <div className={`rounded-xl border p-6 text-sm ${themeClasses.panel} ${themeClasses.textMuted}`}>
          {tr("empty_pending")}
        </div>
      )}

      {!loading && !err && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((inv) => (
            <div
              key={inv.invitationId}
              className={`rounded-xl border p-4 hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${themeClasses.panel}`}
            >
              <div className="space-y-1">
                <div className={`text-base font-semibold ${isDark ? "text-zinc-50" : "text-gray-900"}`}>
                  {inv.orgName ?? tr("org_missing")}
                </div>
                <div className={`text-sm ${themeClasses.textMuted}`}>
                  {tr("invited_by")}{" "}
                  <span className={`font-medium ${themeClasses.textMuted}`}>
                    {inv.inviterEmail ?? "—"}
                  </span>{" "}
                  • {tr("role")}{" "}
                  <span className={`font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                    {inv.memberType ?? tr("role_member_default")}
                  </span>
                </div>
                <div className={`text-xs ${themeClasses.textMuted}`}>
                  {tr("invited_at")}: {fmtDate(inv.invitedAt)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={busyId === inv.invitationId}
                  onClick={() => onAccept(inv.invitationId)}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busyId === inv.invitationId
                    ? tr("processing")
                    : tr("btn_accept")}
                </button>
                <button
                  disabled={busyId === inv.invitationId}
                  onClick={() => onReject(inv.invitationId)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 disabled:cursor-not-allowed ${themeClasses.button}`}
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
            <div className={`text-xs font-medium uppercase tracking-wide mb-2 ${themeClasses.textMuted}`}>
              {tr("processed_header")}
            </div>
            <div className="space-y-2">
              {invitations
                .filter((i) => i.isAccepted)
                .map((inv) => (
                  <div
                    key={inv.invitationId}
                    className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-between ${themeClasses.panel} ${themeClasses.textMuted}`}
                  >
                    <div className="space-x-1">
                      <span className={`font-semibold ${isDark ? "text-zinc-50" : "text-gray-900"}`}>
                        {inv.orgName}
                      </span>
                      <span>•</span>
                      <span>{tr("role")}</span>
                      <span className={`font-medium ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                        {inv.memberType ?? tr("role_member_default")}
                      </span>
                      <span>•</span>
                      <span>
                        {tr("accepted_at")}: {fmtDate(inv.acceptedAt ?? undefined)}
                      </span>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${isDark ? "bg-emerald-500/15 text-emerald-100 border-emerald-400/40" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                      {tr("badge_accepted")}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  );
}
