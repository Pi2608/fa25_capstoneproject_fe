"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useToast } from "@/contexts/ToastContext";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import {
  getMyOrganizations,
  getOrganizationMembers,
  updateMemberRole,
  transferOwnership,
  removeMember,
  inviteMember,
  GetOrganizationMembersResDto,
  MemberDto,
  MyOrganizationDto,
} from "@/lib/api-organizations";
import { getMe, Me } from "@/lib/api-auth";
import { EmptyState } from "@/components/ui/EmptyState";

type MemberRow = {
  memberId: string;
  userId: string;
  displayName: string;
  email: string;
  lastViewedAgo?: string;
  permissions: string;
  license: "Owner" | "Admin" | "Member" | "Viewer" | string;
  joinedAt?: string;
};

function StatPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30">
      {text}
    </span>
  );
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

function isOrgList(u: unknown): u is MyOrganizationDto[] {
  return Array.isArray(u);
}

function isOrgEnvelope(u: unknown): u is { organizations: MyOrganizationDto[] } {
  if (typeof u !== "object" || u === null) return false;
  const v = (u as { organizations?: unknown }).organizations;
  return Array.isArray(v);
}

function isMembersRes(u: unknown): u is GetOrganizationMembersResDto {
  if (typeof u !== "object" || u === null) return false;
  const v = (u as { members?: unknown }).members;
  return Array.isArray(v);
}

function isGuid(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = String(value).trim();
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
}

type ErrorLike = {
  message?: unknown;
  detail?: unknown;
  response?: {
    data?: unknown;
    status?: number;
  };
};

function extractFromJsonString(str: string): string | null {
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object") {
      const detail =
        (parsed as any).detail ??
        (parsed as any).message ??
        (parsed as any).title;
      if (typeof detail === "string" && detail.trim().length > 0) {
        return detail.trim();
      }
    }
  } catch {
    const match = str.match(/"detail"\s*:\s*"([^"]*)"/);
    if (match && match[1]) return match[1];
  }
  return null;
}

function safeErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;

  if (typeof err === "string") {
    const trimmed = err.trim();
    if (!trimmed) return fallback;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const fromJson = extractFromJsonString(trimmed);
      if (fromJson) return fromJson;
    }
    return trimmed;
  }

  const e = err as ErrorLike;

  if (typeof e.detail === "string" && e.detail.trim().length > 0) {
    return e.detail.trim();
  }

  const data = e.response?.data;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const fromJson = extractFromJsonString(trimmed);
      if (fromJson) return fromJson;
    }
    if (trimmed.length > 0) return trimmed;
  } else if (data && typeof data === "object") {
    const detail =
      (data as any).detail ??
      (data as any).message ??
      (data as any).title;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail.trim();
    }
  }

  if (typeof e.message === "string" && e.message.trim().length > 0) {
    const msg = e.message.trim();
    if (msg.startsWith("{") || msg.startsWith("[")) {
      const fromJson = extractFromJsonString(msg);
      if (fromJson) return fromJson;
    }
    return msg;
  }

  if (err instanceof Error && typeof err.message === "string" && err.message.trim().length > 0) {
    return err.message.trim();
  }

  return fallback;
}

type ApiErr = {
  status?: number;
  type?: string;
  title?: string;
  detail?: string;
  message?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function pickStr(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
}

function pickNum(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  return typeof v === "number" ? v : undefined;
}

function parseApiError(err: unknown): ApiErr {
  if (isRecord((err as any)?.response?.data)) {
    const data = (err as any).response.data as Record<string, unknown>;
    return {
      status: pickNum(data, "status") ?? pickNum(err as any, "status"),
      type: pickStr(data, "type"),
      title: pickStr(data, "title"),
      detail: pickStr(data, "detail"),
      message: pickStr(data, "message"),
    };
  }

  if (isRecord(err)) {
    return {
      status: pickNum(err, "status"),
      type: pickStr(err, "type"),
      title: pickStr(err, "title"),
      detail: pickStr(err, "detail"),
      message: pickStr(err, "message"),
    };
  }

  if (typeof err === "string") {
    try {
      const parsed = JSON.parse(err);
      if (isRecord(parsed)) {
        return {
          status: pickNum(parsed, "status"),
          type: pickStr(parsed, "type"),
          title: pickStr(parsed, "title"),
          detail: pickStr(parsed, "detail"),
          message: pickStr(parsed, "message"),
        };
      }
    } catch {
      return { message: err };
    }
  }

  if (err instanceof Error) return { message: err.message };

  return {};
}

function inviteUserMessage(
  err: unknown,
  t: (key: string, vars?: Record<string, unknown>) => string
): string {
  const apiErr = parseApiError(err);
  const status =
    apiErr.status ??
    (typeof (err as any)?.response?.status === "number"
      ? (err as any).response.status
      : 0);
  const code = String(apiErr.type || apiErr.title || "").toLowerCase();
  const txt = String(apiErr.detail || apiErr.message || "").toLowerCase();

  const isQuota =
    code.includes("userquotaexceeded") ||
    code.includes("organization.userquotaexceeded") ||
    txt.includes("maximum user limit") ||
    txt.includes("maximum number of users") ||
    txt.includes("maximum users") ||
    txt.includes("quota") ||
    (txt.includes("limit") && txt.includes("user"));

  if (isQuota) return t("org_detail.err_quota");

  const isAlready =
    status === 409 ||
    code.includes("invitionalreadyexists") ||
    code.includes("organization.invitionalreadyexists") ||
    code.includes("alreadyexists") ||
    (txt.includes("already") && txt.includes("invitation")) ||
    (txt.includes("already") && txt.includes("member"));

  if (isAlready) return t("org_detail.err_already_member");

  if (status === 403) return t("org_detail.err_forbidden");
  if (status === 404) return t("org_detail.err_not_found");
  if (status === 400) return t("org_detail.err_bad_request");
  if (status === 429) return t("org_detail.err_rate_limited");
  if (status >= 500) return t("org_detail.err_server");

  if (apiErr.detail && !/stack|trace|exception/i.test(apiErr.detail)) {
    return apiErr.detail;
  }
  if (apiErr.message && !/stack|trace|exception/i.test(apiErr.message)) {
    return apiErr.message;
  }

  return t("settings_members.invite_failed");
}

export default function MembersPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { isLoggedIn } = useAuthStatus();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
  const [orgErr, setOrgErr] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<MemberRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);

  const [inviteInput, setInviteInput] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Member" | "Viewer">("Member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const editorsCount = useMemo(
    () =>
      members.filter((m) =>
        ["admin", "editor"].includes(String(m.license).toLowerCase())
      ).length,
    [members]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      if (!isLoggedIn) return;

      try {
        const meRes = await getMe();
        if (!cancelled) setMe(meRes);
      } catch {}

      try {
        const orgRes = await getMyOrganizations();
        if (cancelled) return;

        const items: MyOrganizationDto[] = isOrgList(orgRes)
          ? orgRes
          : isOrgEnvelope(orgRes)
          ? orgRes.organizations
          : [];

        setOrgs(items);
        setOrgErr(null);

        if (items.length > 0) {
          setSelectedOrgId((prev) => prev ?? items[0].orgId);
        }
      } catch {
        if (cancelled) return;
        setOrgErr(t("settings_members.load_orgs_failed"));
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, t]);

  const loadMembers = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setPageError(null);
      try {
        const res = await getOrganizationMembers(orgId);
        const arr: MemberDto[] = isMembersRes(res)
          ? res.members
          : Array.isArray(res)
          ? (res as MemberDto[])
          : [];

        const rows: MemberRow[] = arr.map((member) => {
          const role = typeof member.role === "string" ? member.role : "Member";

          return {
            memberId: member.memberId,
            userId: member.userId ?? "",
            displayName: member.fullName || t("settings_members.unknown"),
            email: member.email || "—",
            lastViewedAgo: "—",
            permissions: t("settings_members.permissions_projects"),
            license: role as MemberRow["license"],
            joinedAt: member.joinedAt,
          };
        });

        setMembers(rows);
      } catch {
        setMembers([]);
        setPageError(t("settings_members.load_members_failed"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (selectedOrgId) {
      void loadMembers(selectedOrgId);
    } else {
      setMembers([]);
    }
  }, [selectedOrgId, loadMembers]);

  const setBusy = (id: string, value: boolean) => {
    setRowBusy((prev) => ({ ...prev, [id]: value }));
  };

  const currentUserRow = useMemo(
    () =>
      me
        ? members.find(
            (m) => m.email?.toLowerCase() === me.email?.toLowerCase()
          ) ?? null
        : null,
    [members, me]
  );

  const isOwner = currentUserRow?.license === "Owner";

  const canTransfer = (target: MemberRow) => {
    if (!currentUserRow) return false;
    if (currentUserRow.license !== "Owner") return false;
    if (target.license === "Owner") return false;
    if (target.email?.toLowerCase() === me?.email?.toLowerCase()) return false;
    if (!isGuid(target.userId)) return false;
    if (!isGuid(selectedOrgId)) return false;
    return true;
  };

  const handleChangeRole = async (memberId: string, newRole: MemberRow["license"]) => {
  if (!selectedOrgId || !isOwner) return;

  if (newRole === "Owner") {
    const target = members.find((m) => m.memberId === memberId);
    if (target) {
      handleTransferOwnershipClick(target);
      return;
    }
  }

  const previous = members;
  setMembers((list) =>
    list.map((m) => (m.memberId === memberId ? { ...m, license: newRole } : m))
  );
  setBusy(memberId, true);

  try {
    await updateMemberRole({ orgId: selectedOrgId, memberId, newRole });
  } catch {
    setMembers(previous);
    const msg = t("settings_members.update_role_failed");
    showToast("error", msg, 4000);
  } finally {
    setBusy(memberId, false);
  }
};


  const handleTransferOwnershipClick = (target: MemberRow) => {
    if (!selectedOrgId) return;

    if (target.email?.toLowerCase() === me?.email?.toLowerCase()) {
      showToast("warning", t("settings_members.transfer_self_forbidden"), 4000);
      return;
    }

    if (!isGuid(selectedOrgId)) {
      showToast("error", t("settings_members.invalid_orgid"), 4000);
      return;
    }

    if (!isGuid(target.userId)) {
      showToast("error", t("settings_members.invalid_userid"), 4000);
      return;
    }

    if (!canTransfer(target)) {
      showToast("warning", t("settings_members.only_owner_transfer"), 4000);
      return;
    }

    setTransferTarget(target);
  };

  const confirmTransferOwnership = async (target: MemberRow) => {
    if (!selectedOrgId) return;

    setBusy(target.memberId, true);
    try {
      const res = await transferOwnership(
        String(selectedOrgId).trim(),
        target.userId.trim()
      );

      await loadMembers(selectedOrgId);

      const name = target.displayName || target.email || "";
      const fallback = name
        ? t("settings_members.transfer_success_to", { name })
        : t("settings_members.transfer_success");
      const apiMsg =
        typeof (res as any)?.result === "string"
          ? ((res as any).result as string).trim()
          : "";
      const msg = apiMsg || fallback;

      showToast("success", msg, 3000);
      setTransferTarget(null);
    } catch (err) {
      const reason = safeErrorMessage(
        err,
        t("settings_members.transfer_failed")
      );
      const msg = t("settings_members.transfer_failed_with_reason", { reason });
      showToast("error", msg, 4000);
    } finally {
      setBusy(target.memberId, false);
    }
  };

  const handleRemoveClick = (member: MemberRow) => {
    if (!selectedOrgId || !isOwner) return;
    setDeleteTarget(member);
  };

  const confirmRemoveMember = async (target: MemberRow) => {
    if (!selectedOrgId) return;

    setBusy(target.memberId, true);
    try {
      await removeMember({ orgId: selectedOrgId, memberId: target.memberId });
      setMembers((list) => list.filter((m) => m.memberId !== target.memberId));
      showToast("success", t("settings_members.remove_success"), 3000);
      setDeleteTarget(null);
    } catch (err) {
      const msg = safeErrorMessage(err, t("settings_members.remove_failed"));
      showToast("error", msg, 4000);
    } finally {
      setBusy(target.memberId, false);
    }
  };

  const handleInvite = useCallback(
    async () => {
      if (!selectedOrgId) return;

      const emails = inviteInput
        .split(/[,\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (emails.length === 0) {
        const msg = t("settings_members.invite_enter_email");
        setInviteMsg(msg);
        showToast("warning", msg, 3000);
        return;
      }

      const invalid = emails.find((e) => !isValidEmail(e));
      if (invalid) {
        const msg = t("settings_members.invite_invalid_email", { email: invalid });
        setInviteMsg(msg);
        showToast("error", msg, 4000);
        return;
      }

      setInviteBusy(true);
      setInviteMsg(null);

      try {
        for (const email of emails) {
          await inviteMember({
            orgId: selectedOrgId,
            memberEmail: email,
            memberType: inviteRole,
          });
        }

        const msg = t("settings_members.invite_sent", {
          emails: emails.join(", "),
        });
        setInviteMsg(msg);
        setInviteInput("");
        await loadMembers(selectedOrgId);
        showToast("success", t("settings_members.invite_success_toast"), 3000);
      } catch (err) {
        const msg = inviteUserMessage(err, t);
        setInviteMsg(msg);
        showToast("error", msg, 4000);
      } finally {
        setInviteBusy(false);
      }
    },
    [inviteInput, inviteRole, selectedOrgId, loadMembers, t, showToast]
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          {t("settings_members.title")}
        </h2>
        <div className="flex items-center gap-2">
          <StatPill
            text={t("settings_members.stat_members", {
              count: members.length,
              limit: 25,
            })}
          />
          <StatPill
            text={t("settings_members.stat_editors", {
              count: editorsCount,
              limit: 3,
            })}
          />
          <button
            className="ml-2 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => isOwner && setInviteOpen(true)}
            disabled={inviteBusy || !isOwner}
            title={
              isOwner
                ? t("settings_members.invite_button_title_owner")
                : t("settings_members.only_owner_invite_title")
            }
          >
            {`+ ${t("settings_members.invite_member")}`}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("settings_members.org_label")}
        </label>
        <select
          className={`rounded-md border px-2 py-1 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.select} ${isDark ? "dark:hover:bg-zinc-800" : ""}`}
          value={selectedOrgId ?? ""}
          onChange={(e) => setSelectedOrgId(e.target.value || null)}
        >
          {orgs.map((o) => (
            <option key={o.orgId} value={o.orgId}>
              {o.orgName}
            </option>
          ))}
        </select>
        {orgErr && (
          <span className="rounded px-2 py-1 text-xs text-red-700 ring-1 ring-red-200 bg-red-50 dark:text-red-200 dark:ring-red-400/40 dark:bg-red-900/30">
            {orgErr}
          </span>
        )}
      </div>

      {pageError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30">
          {pageError}
        </div>
      )}

      {inviteOpen && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/95">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {t("settings_members.invite_member")}
            </div>
            <button
              className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              onClick={() => setInviteOpen(false)}
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                {t("settings_members.invite_emails_label")}
              </label>
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder={t("settings_members.invite_placeholder")}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm placeholder:text-zinc-400 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !inviteBusy) {
                    void handleInvite();
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "Admin" | "Member" | "Viewer")
                }
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                title={t("settings_members.invite_role_title")}
              >
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </select>

              <button
                onClick={() => void handleInvite()}
                disabled={inviteBusy || !selectedOrgId}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {inviteBusy ? t("common.inviting") : t("common.invite")}
              </button>
            </div>
          </div>

          {inviteMsg && (
            <div className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
              {inviteMsg}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
          {t("settings_members.loading_members")}
        </div>
      )}

      {!loading && members.length === 0 && (
        <EmptyState
          illustration="team"
          title="No Team Members Yet"
          description="Build your team by inviting members to collaborate. Members can have different roles with varying levels of access to organization resources."
          action={
            isOwner
              ? {
                  label: "Invite Members",
                  onClick: () => setInviteOpen(true),
                }
              : undefined
          }
        />
      )}

      {!loading && members.length > 0 && (
        <div className={`overflow-x-auto rounded-lg ring-1 shadow-sm ${isDark ? "ring-white/10" : "ring-gray-200"}`}>
          <table className={`min-w-full ${isDark ? "bg-zinc-950" : "bg-white"}`}>
            <thead>
              <tr className={themeClasses.tableHeader}>
                <th className="px-3 py-2 text-sm font-medium text-left">
                  {t("settings_members.col_member")}
                </th>
                <th className="px-3 py-2 text-sm font-medium text-left">
                  {t("settings_members.col_last_view")}
                </th>
                <th className="px-3 py-2 text-sm font-medium text-left">
                  {t("settings_members.col_permissions")}
                </th>
                <th className="px-3 py-2 text-sm font-medium text-left">
                  {t("settings_members.col_role")}
                </th>
                <th className="w-[280px] px-3 py-2 text-sm font-medium text-left">
                  {t("settings_members.col_actions")}
                </th>
              </tr>
            </thead>
            <tbody>
            {!loading &&
              members.map((m) => {
                const busy = !!rowBusy[m.memberId];
                const isMe =
                  me && m.email?.toLowerCase() === me.email?.toLowerCase();

                const transferTitle = !isGuid(m.userId)
                  ? t("settings_members.no_guid_user")
                  : !isGuid(selectedOrgId)
                  ? t("settings_members.invalid_orgid")
                  : currentUserRow?.license !== "Owner"
                  ? t("settings_members.only_owner_transfer")
                  : m.email?.toLowerCase() === me?.email?.toLowerCase()
                  ? t("settings_members.transfer_self_forbidden")
                  : m.license === "Owner"
                  ? t("settings_members.cannot_transfer_to_owner")
                  : t("settings_members.transfer_ownership");

                return (
                  <tr
                    key={m.memberId}
                    className={`border-t ${themeClasses.tableCell} ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-3 py-3">
                      <div className={`font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                        {m.displayName}
                      </div>
                      <div className={`text-xs ${themeClasses.textMuted}`}>
                        {m.email}
                      </div>
                    </td>

                    <td className={`px-3 py-3 text-sm ${themeClasses.textMuted}`}>
                      {m.lastViewedAgo ?? "—"}
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium
                        bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200
                        dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/40"
                      >
                        {m.permissions}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <select
                        className={`rounded-md border px-2 py-1 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 ${themeClasses.select} ${isDark ? "dark:hover:bg-zinc-800" : ""}`}
                        value={m.license}
                        disabled={
                          busy || m.license === "Owner" || !isOwner
                        }
                        onChange={(e) =>
                          handleChangeRole(
                            m.memberId,
                            e.target.value as MemberRow["license"]
                          )
                        }
                        title={
                          !isOwner
                            ? t("settings_members.role_change_only_owner")
                            : m.license === "Owner"
                            ? t("settings_members.role_change_owner_locked")
                            : t("settings_members.role_change")
                        }
                      >
                        <option value="Owner">Owner</option>
                        <option value="Admin">Admin</option>
                        <option value="Member">Member</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busy || !canTransfer(m)}
                          onClick={() => handleTransferOwnershipClick(m)}
                          title={transferTitle}
                          className="px-2 py-1 text-xs font-medium rounded-md border border-sky-300 text-sky-700 bg-white hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-400/40 dark:text-sky-300 dark:bg-transparent dark:hover:bg-sky-500/10"
                        >
                          {t("settings_members.transfer_ownership")}
                        </button>

                        <button
                          disabled={
                            busy ||
                            m.license === "Owner" ||
                            isMe === true ||
                            !isOwner
                          }
                          onClick={() => handleRemoveClick(m)}
                          className="px-2 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500/85 dark:hover:bg-red-500"
                          title={
                            isOwner
                              ? t("settings_members.remove_member_title")
                              : t("settings_members.remove_only_owner")
                          }
                        >
                          {t("settings_members.remove")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {transferTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t("settings_members.transfer_ownership")}
            </h3>

            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
              {t("settings_members.confirm_transfer", {
                name: transferTarget.displayName || transferTarget.email,
              })}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => setTransferTarget(null)}
              >
                {t("common.cancel")}
              </button>

              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => confirmTransferOwnership(transferTarget)}
                disabled={rowBusy[transferTarget.memberId]}
              >
                {t("settings_members.transfer_ownership")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {t("settings_members.remove_member_title")}
            </h3>

            <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-line">
              {t("settings_members.remove_confirm", {
                name: deleteTarget.displayName || deleteTarget.email,
              })}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => setDeleteTarget(null)}
              >
                {t("common.cancel")}
              </button>

              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500/90 dark:hover:bg-red-500"
                onClick={() => confirmRemoveMember(deleteTarget)}
                disabled={rowBusy[deleteTarget.memberId]}
              >
                {t("settings_members.remove")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
