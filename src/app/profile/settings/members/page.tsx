"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";

import { useAuthStatus } from "@/contexts/useAuthStatus";
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

export default function MembersPage() {
  const { t } = useI18n();
  const tr = t;

  const safeMessage = (err: unknown): string =>
    err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err && typeof (err as any).message === "string"
      ? (err as any).message
      : t("common.request_failed");

  const { isLoggedIn } = useAuthStatus();
  const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
  const [orgErr, setOrgErr] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Member" | "Viewer">("Member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const editorsCount = useMemo(
    () => members.filter((m) => ["admin", "editor"].includes(String(m.license).toLowerCase())).length,
    [members]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isLoggedIn) return;
      try {
        const u = await getMe();
        if (!alive) return;
        setMe(u);
      } catch {}
      try {
        const res = await getMyOrganizations();
        if (!alive) return;
        const items: MyOrganizationDto[] = isOrgList(res) ? res : isOrgEnvelope(res) ? res.organizations : [];
        setOrgs(items);
        setOrgErr(null);
        if (items.length) setSelectedOrgId((prev) => prev ?? items[0].orgId);
      } catch {
        if (!alive) return;
        setOrgErr(t("settings_members.load_orgs_failed"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [isLoggedIn, t]);

  const isGuid = (s: string) =>
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(s).trim());

  function extractGuidDeep(
    obj: unknown,
    keyRegex = /(userId|user_id|userid|accountId|account_id|id)$/i
  ): string {
    if (!obj || typeof obj !== "object") return "";
    const entries = Object.entries(obj as Record<string, unknown>);
    for (const [k, v] of entries) {
      if (typeof v === "string" && keyRegex.test(k) && isGuid(v)) return v.trim();
      if (v && typeof v === "object") {
        const child = extractGuidDeep(v, keyRegex);
        if (child) return child;
      }
    }
    return "";
  }

  const loadMembers = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setPageError(null);
      try {
        const res = await getOrganizationMembers(orgId);
        const arr: MemberDto[] = isMembersRes(res) ? res.members : Array.isArray(res) ? (res as MemberDto[]) : [];
        const rows: MemberRow[] = (arr ?? []).map((x) => {
          const role = typeof x.role === "string" ? x.role : "Member";
          const userGuid = extractGuidDeep(x);
          return {
            memberId: String(x.memberId ?? extractGuidDeep(x, /(memberId|member_id|id)$/i)),
            userId: userGuid,
            displayName: x.fullName || t("settings_members.unknown"),
            email: x.email || "—",
            lastViewedAgo: "—",
            permissions: t("settings_members.permissions_projects"),
            license: role as MemberRow["license"],
            joinedAt: x.joinedAt,
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
    if (selectedOrgId) void loadMembers(selectedOrgId);
    else setMembers([]);
  }, [selectedOrgId, loadMembers]);

  const setBusy = (id: string, v: boolean) => setRowBusy((s) => ({ ...s, [id]: v }));

  const currentUserRow = useMemo(
    () => (me ? members.find((m) => m.email?.toLowerCase() === me.email?.toLowerCase()) ?? null : null),
    [members, me]
  );

  const isOwner = currentUserRow?.license === "Owner";
  const canTransfer = (target: MemberRow) => {
    if (!currentUserRow) return false;
    if (currentUserRow.license !== "Owner") return false;
    if (target.license === "Owner") return false;
    if (target.email?.toLowerCase() === me?.email?.toLowerCase()) return false;
    if (!isGuid(target.userId)) return false;
    if (!isGuid(String(selectedOrgId))) return false;
    return true;
  };

  const handleChangeRole = async (memberId: string, newRole: MemberRow["license"]) => {
    if (!selectedOrgId || !isOwner) return;
    const prev = members;
    setMembers((list) => list.map((m) => (m.memberId === memberId ? { ...m, license: newRole } : m)));
    setBusy(memberId, true);
    try {
      await updateMemberRole({ orgId: selectedOrgId, memberId, newRole });
    } catch {
      setMembers(prev);
      alert(t("settings_members.update_role_failed"));
    } finally {
      setBusy(memberId, false);
    }
  };

  const handleTransferOwnership = async (target: MemberRow) => {
    if (!selectedOrgId) return;

    if (target.email?.toLowerCase() === me?.email?.toLowerCase()) {
      alert(t("settings_members.transfer_self_forbidden"));
      return;
    }
    if (!isGuid(String(selectedOrgId))) {
      alert(t("settings_members.invalid_orgid"));
      return;
    }
    if (!isGuid(target.userId)) {
      alert(t("settings_members.invalid_userid"));
      return;
    }
    if (!confirm(t("settings_members.confirm_transfer", { name: target.displayName || target.email }))) return;

    setBusy(target.memberId, true);
    try {
      const res = await transferOwnership(String(selectedOrgId).trim(), target.userId.trim());
      await loadMembers(selectedOrgId);
      alert(res?.result || t("settings_members.transfer_success"));
    } catch (e) {
      alert(safeMessage(e) || t("settings_members.transfer_failed"));
    } finally {
      setBusy(target.memberId, false);
    }
  };

  const handleRemove = async (memberId: string, nameOrEmail: string) => {
    if (!selectedOrgId || !isOwner) return;
    if (!confirm(t("settings_members.remove_confirm", { name: nameOrEmail }))) return;
    setBusy(memberId, true);
    try {
      await removeMember({ orgId: selectedOrgId, memberId });
      setMembers((list) => list.filter((m) => m.memberId !== memberId));
    } catch {
      alert(t("settings_members.remove_failed"));
    } finally {
      setBusy(memberId, false);
    }
  };

  const onInvite = useCallback(async () => {
    if (!selectedOrgId) return;
    const emails = inviteInput
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setInviteMsg(t("settings_members.invite_enter_email"));
      return;
    }
    const invalid = emails.find((e) => !isValidEmail(e));
    if (invalid) {
      setInviteMsg(t("settings_members.invite_invalid_email", { email: invalid }));
      return;
    }
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      for (const email of emails) {
        await inviteMember({ orgId: selectedOrgId, memberEmail: email, memberType: inviteRole });
      }
      setInviteMsg(t("settings_members.invite_sent", { emails: emails.join(", ") }));
      setInviteInput("");
      await loadMembers(selectedOrgId);
    } catch (e) {
      setInviteMsg(safeMessage(e));
    } finally {
      setInviteBusy(false);
    }
  }, [inviteInput, inviteRole, selectedOrgId, loadMembers, t]);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{t("settings_members.title")}</h2>
        <div className="flex items-center gap-2">
          <StatPill text={t("settings_members.stat_members", { count: members.length, limit: 25 })} />
          <StatPill text={t("settings_members.stat_editors", { count: editorsCount, limit: 3 })} />
          <button
            className="ml-2 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => isOwner && setInviteOpen(true)}
            disabled={inviteBusy || !isOwner}
            title={isOwner ? t("settings_members.invite_button_title_owner") : t("settings_members.only_owner_invite_title")}
          >
            {`+ ${t("settings_members.invite_member")}`}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">{t("settings_members.org_label")}</label>
        <select
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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

      {members.some((m) => !isGuid(m.userId)) && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/40">
          {t("settings_members.warn_missing_guid")}
        </div>
      )}
      {pageError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30">
          {pageError}
        </div>
      )}

      {inviteOpen && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/95">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("settings_members.invite_member")}</div>
            <button className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={() => setInviteOpen(false)} aria-label={t("common.close")}>
              ✕
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">{t("settings_members.invite_emails_label")}</label>
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder={t("settings_members.invite_placeholder")}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm placeholder:text-zinc-400 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !inviteBusy) void onInvite();
                }}
              />
            </div>

            <div className="flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "Admin" | "Member" | "Viewer")}
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                title={t("settings_members.invite_role_title")}
              >
                <option value="Admin">Admin</option>
                <option value="Member">Member</option>
                <option value="Viewer">Viewer</option>
              </select>

              <button
                onClick={() => void onInvite()}
                disabled={inviteBusy || !selectedOrgId}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {inviteBusy ? t("common.inviting") : t("common.invite")}
              </button>
            </div>
          </div>

          {inviteMsg && <div className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{inviteMsg}</div>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg ring-1 ring-zinc-200 shadow-sm dark:ring-white/10">
        <table className="min-w-full bg-white dark:bg-zinc-950">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
              <th className="px-3 py-2 text-sm font-medium">{t("settings_members.col_member")}</th>
              <th className="px-3 py-2 text-sm font-medium">{t("settings_members.col_last_view")}</th>
              <th className="px-3 py-2 text-sm font-medium">{t("settings_members.col_permissions")}</th>
              <th className="px-3 py-2 text-sm font-medium">{t("settings_members.col_role")}</th>
              <th className="w-[280px] px-3 py-2 text-sm font-medium">{t("settings_members.col_actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  {t("settings_members.loading_members")}
                </td>
              </tr>
            )}
            {!loading && members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  {t("settings_members.no_members")}
                </td>
              </tr>
            )}
            {!loading &&
              members.map((m) => {
                const busy = !!rowBusy[m.memberId];
                const isMe = me && m.email?.toLowerCase() === me.email?.toLowerCase();
                const title = !isGuid(m.userId)
                  ? t("settings_members.no_guid_user")
                  : !isGuid(String(selectedOrgId))
                  ? t("settings_members.invalid_orgid")
                  : currentUserRow?.license !== "Owner"
                  ? t("settings_members.only_owner_transfer")
                  : m.email?.toLowerCase() === me?.email?.toLowerCase()
                  ? t("settings_members.transfer_self_forbidden")
                  : m.license === "Owner"
                  ? t("settings_members.cannot_transfer_to_owner")
                  : t("settings_members.transfer_ownership");

                return (
                  <tr key={m.memberId} className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5">
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900 dark:text-white">{m.displayName}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{m.email}</div>
                    </td>

                    <td className="px-3 py-3 text-sm text-zinc-700 dark:text-zinc-200">{m.lastViewedAgo ?? "—"}</td>

                    <td className="px-3 py-3 text-sm">
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 ring-1 ring-zinc-200 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10">
                        {m.permissions}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <select
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        value={m.license}
                        disabled={busy || m.license === "Owner" || !isOwner}
                        onChange={(e) => handleChangeRole(m.memberId, e.target.value as MemberRow["license"])}
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
                          onClick={() => handleTransferOwnership(m)}
                          title={title}
                          className="px-2 py-1 text-xs font-medium rounded-md border border-sky-300 text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-sky-400/40 dark:text-sky-300 dark:bg-transparent dark:hover:bg-sky-500/10"
                        >
                          {t("settings_members.transfer_ownership")}
                        </button>

                        <button
                          disabled={busy || m.license === "Owner" || isMe === true || !isOwner}
                          onClick={() => handleRemove(m.memberId, m.displayName || m.email)}
                          className="px-2 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-red-500/85 dark:hover:bg-red-500"
                          title={isOwner ? t("settings_members.remove_member_title") : t("settings_members.remove_only_owner")}
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
    </div>
  );
}
