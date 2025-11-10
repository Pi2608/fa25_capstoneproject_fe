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
      setErr("Không tải được danh sách lời mời.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const invitations = data?.invitations ?? [];

  const pending = useMemo(
    () => invitations.filter((i) => !i.isAccepted && !(i as { isRejected?: boolean }).isRejected),
    [invitations]
  );

  const pendingCount = pending.length;

  async function onAccept(invitationId: string) {
    setBusyId(invitationId);
    try {
      const body: AcceptInviteOrganizationReqDto = { invitationId };
      await acceptInvite(body);
      setToast("Đã chấp nhận lời mời.");
      await load();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("invitations-changed"));
    } catch (e: unknown) {
      const errObj = toApiError(e);
      if ((errObj.status ?? 0) === 409) {
        setToast("Lời mời này đã được chấp nhận trước đó.");
        await load();
        if (typeof window !== "undefined") window.dispatchEvent(new Event("invitations-changed"));
      } else {
        alert(errObj.detail ?? errObj.message ?? "Chấp nhận lời mời thất bại.");
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
      setToast("Đã từ chối lời mời.");
      await load();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("invitations-changed"));
    } catch (e: unknown) {
      const errObj = toApiError(e);
      alert(errObj.detail ?? errObj.message ?? "Từ chối lời mời thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-semibold flex items-center gap-2">
          Lời mời tham gia tổ chức
          <span
            className={[
              "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              pendingCount > 0
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                : "bg-white/5 text-zinc-300 border border-white/10",
            ].join(" ")}
            aria-label="Số lời mời chưa phản hồi"
            title="Số lời mời chưa phản hồi"
          >
            {pendingCount}
          </span>
        </h1>

        <button
          onClick={() => load()}
          disabled={loading}
          className={[
            "rounded-lg px-3 py-2 text-sm",
            loading
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              : "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10",
          ].join(" ")}
        >
          Làm mới
        </button>
      </div>

      {toast && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && err && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 p-4">
          {err}
        </div>
      )}

      {!loading && !err && pending.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-zinc-300">
          Bạn không có lời mời đang chờ.
        </div>
      )}

      {!loading && !err && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((inv) => (
            <div
              key={inv.invitationId}
              className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <div className="text-base font-semibold text-white">
                  {inv.orgName ?? "—"}
                </div>
                <div className="text-sm text-zinc-400">
                  Mời bởi: <span className="text-zinc-300">{inv.inviterEmail ?? "—"}</span> • Vai trò:{" "}
                  <span className="text-emerald-300">{inv.memberType ?? "Member"}</span>
                </div>
                <div className="text-xs text-zinc-500">Mời lúc: {fmtDate(inv.invitedAt)}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={busyId === inv.invitationId}
                  onClick={() => onAccept(inv.invitationId)}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busyId === inv.invitationId ? "Đang xử lý..." : "Chấp nhận"}
                </button>
                <button
                  disabled={busyId === inv.invitationId}
                  onClick={() => onReject(inv.invitationId)}
                  className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10 disabled:opacity-60"
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading &&
        !err &&
        invitations.some((i) => i.isAccepted) && (
          <div className="pt-2">
            <div className="text-sm text-zinc-400 mb-2">Đã xử lý</div>
            <div className="space-y-2">
              {invitations
                .filter((i) => i.isAccepted)
                .map((inv) => (
                  <div
                    key={inv.invitationId}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-white">{inv.orgName}</span> • Vai trò:{" "}
                      <span className="text-emerald-300">{inv.memberType ?? "Member"}</span> • Chấp nhận lúc:{" "}
                      {fmtDate(inv.acceptedAt ?? undefined)}
                    </div>
                    <span className="rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 px-2 py-0.5 text-xs">
                      Đã chấp nhận
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  );
}
