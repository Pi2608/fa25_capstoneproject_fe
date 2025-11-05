"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

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
    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs
                      bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200
                      dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30">
      {text}
    </span>
  );
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Request failed";
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
      } catch { }
      try {
        const res = await getMyOrganizations();
        if (!alive) return;
        const items: MyOrganizationDto[] = isOrgList(res) ? res : isOrgEnvelope(res) ? res.organizations : [];
        setOrgs(items);
        setOrgErr(null);
        if (items.length) setSelectedOrgId((prev) => prev ?? items[0].orgId);
      } catch {
        if (!alive) return;
        setOrgErr("Failed to load organizations.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  const isGuid = (s: string) =>
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(s).trim());

  function extractGuidDeep(obj: unknown, keyRegex = /(userId|user_id|userid|accountId|account_id|id)$/i): string {
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

  const loadMembers = useCallback(async (orgId: string) => {
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
          displayName: x.fullName || "Unknown",
          email: x.email || "—",
          lastViewedAgo: "—",
          permissions: "Projects",
          license: role as MemberRow["license"],
          joinedAt: x.joinedAt,
        };
      });
      setMembers(rows);
    } catch {
      setMembers([]);
      setPageError("Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      alert("Failed to update role.");
    } finally {
      setBusy(memberId, false);
    }
  };

  const handleTransferOwnership = async (target: MemberRow) => {
    if (!selectedOrgId) return;

    if (target.email?.toLowerCase() === me?.email?.toLowerCase()) {
      alert("Không thể chuyển quyền sở hữu cho chính bạn.");
      return;
    }
    if (!isGuid(String(selectedOrgId))) {
      alert("orgId không hợp lệ (không phải GUID).");
      return;
    }
    if (!isGuid(target.userId)) {
      alert("userId không hợp lệ (không phải GUID).");
      return;
    }
    if (!confirm(`Chuyển quyền sở hữu cho ${target.displayName || target.email}?`)) return;

    setBusy(target.memberId, true);
    try {
      const res = await transferOwnership(String(selectedOrgId).trim(), target.userId.trim());

      await loadMembers(selectedOrgId);
      alert(res?.result || "Chuyển quyền sở hữu thành công.");
    } catch (e) {
      alert(safeMessage(e) || "Chuyển quyền sở hữu thất bại.");
    } finally {
      setBusy(target.memberId, false);
    }
  };


  const handleRemove = async (memberId: string, nameOrEmail: string) => {
    if (!selectedOrgId || !isOwner) return;
    if (!confirm(`Remove ${nameOrEmail} from this organization?`)) return;
    setBusy(memberId, true);
    try {
      await removeMember({ orgId: selectedOrgId, memberId });
      setMembers((list) => list.filter((m) => m.memberId !== memberId));
    } catch {
      alert("Failed to remove member.");
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
      setInviteMsg("Please enter at least 1 email.");
      return;
    }
    const invalid = emails.find((e) => !isValidEmail(e));
    if (invalid) {
      setInviteMsg(`Invalid email: ${invalid}`);
      return;
    }
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      for (const email of emails) {
        await inviteMember({ orgId: selectedOrgId, memberEmail: email, memberType: inviteRole });
      }
      setInviteMsg(`Invitation sent to ${emails.join(", ")}.`);
      setInviteInput("");
      await loadMembers(selectedOrgId);
    } catch (e) {
      setInviteMsg(safeMessage(e));
    } finally {
      setInviteBusy(false);
    }
  }, [inviteInput, inviteRole, selectedOrgId, loadMembers]);

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Members</h2>
        <div className="flex items-center gap-2">
          <StatPill text={`${members.length} members out of 25`} />
          <StatPill text={`${editorsCount} editors out of 3`} />
          <button
            className="ml-2 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500
             disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => isOwner && setInviteOpen(true)}
            disabled={inviteBusy || !isOwner}
            title={isOwner ? "Invite members" : "Only owner can invite members"}
          >
            + Invite members
          </button>

        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">Organization</label>
        <select
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 shadow-sm
                     hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                     dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
          <span className="rounded px-2 py-1 text-xs text-red-700 ring-1 ring-red-200 bg-red-50
                           dark:text-red-200 dark:ring-red-400/40 dark:bg-red-900/30">
            {orgErr}
          </span>
        )}
      </div>

      {/* warnings / errors */}
      {members.some((m) => !isGuid(m.userId)) && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200
                        dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/40">
          Một số thành viên thiếu userId dạng GUID nên không thể chuyển quyền. Cần cập nhật API getOrganizationMembers
          để trả về GUID user.
        </div>
      )}
      {pageError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200
                        dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30">
          {pageError}
        </div>
      )}

      {/* invite box */}
      {inviteOpen && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm
                        dark:border-white/10 dark:bg-zinc-900/95">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Invite members</div>
            <button className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={() => setInviteOpen(false)} aria-label="Close invite">
              ✕
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Emails</label>
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="Add collaborators (paste multiple emails, separated by commas or spaces)"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm
                           placeholder:text-zinc-400 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                           dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !inviteBusy) void onInvite();
                }}
              />
            </div>

            <div className="flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "Admin" | "Member" | "Viewer")}
                className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-800 shadow-sm
                           hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                           dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                title="Role for invited members"
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
                {inviteBusy ? "Inviting..." : "Invite"}
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
              <th className="px-3 py-2 text-sm font-medium">Person</th>
              <th className="px-3 py-2 text-sm font-medium">Last viewed a map</th>
              <th className="px-3 py-2 text-sm font-medium">Permissions</th>
              <th className="px-3 py-2 text-sm font-medium">License</th>
              <th className="w-[280px] px-3 py-2 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  Loading members…
                </td>
              </tr>
            )}
            {!loading && members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  No members found.
                </td>
              </tr>
            )}
            {!loading &&
              members.map((m) => {
                const busy = !!rowBusy[m.memberId];
                const isMe = me && m.email?.toLowerCase() === me.email?.toLowerCase();
                const title = !isGuid(m.userId)
                  ? "Không có userId dạng GUID"
                  : !isGuid(String(selectedOrgId))
                    ? "orgId không phải GUID"
                    : currentUserRow?.license !== "Owner"
                      ? "Chỉ Owner mới được chuyển quyền"
                      : m.email?.toLowerCase() === me?.email?.toLowerCase()
                        ? "Không thể chuyển cho chính bạn"
                        : m.license === "Owner"
                          ? "Không thể chuyển cho Owner hiện tại"
                          : "Transfer ownership";

                return (
                  <tr
                    key={m.memberId}
                    className="border-t border-zinc-200 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900 dark:text-white">{m.displayName}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{m.email}</div>
                    </td>

                    <td className="px-3 py-3 text-sm text-zinc-700 dark:text-zinc-200">
                      {m.lastViewedAgo ?? "—"}
                    </td>

                    <td className="px-3 py-3 text-sm">
                      <span
                        className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-700 ring-1 ring-zinc-200
                   dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10"
                      >
                        {m.permissions}
                      </span>
                    </td>

                    {/* License */}
                    <td className="px-3 py-3 text-sm">
                      <select
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 shadow-sm
                   hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40
                   disabled:opacity-60 disabled:cursor-not-allowed
                   dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                        value={m.license}
                        disabled={busy || m.license === "Owner" || !isOwner}
                        onChange={(e) => handleChangeRole(m.memberId, e.target.value as MemberRow["license"])}
                        title={
                          !isOwner
                            ? "Only owner can change roles"
                            : m.license === "Owner"
                              ? "Owner role cannot be changed"
                              : "Change role"
                        }
                      >
                        <option value="Owner">Owner</option>
                        <option value="Admin">Admin</option>
                        <option value="Member">Member</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          disabled={busy || !canTransfer(m)}
                          onClick={() => handleTransferOwnership(m)}
                          title={title}
                          className={`px-2 py-1 text-xs font-medium rounded-md
                      border border-sky-300 text-sky-700 bg-white hover:bg-sky-50
                      disabled:opacity-50 disabled:cursor-not-allowed
                      dark:border-sky-400/40 dark:text-sky-300 dark:bg-transparent dark:hover:bg-sky-500/10`}
                        >
                          Transfer ownership
                        </button>

                        <button
                          disabled={busy || m.license === "Owner" || isMe === true || !isOwner}
                          onClick={() => handleRemove(m.memberId, m.displayName || m.email)}
                          className={`px-2 py-1 text-xs font-medium rounded-md
                      bg-red-600 text-white hover:bg-red-500
                      disabled:opacity-60 disabled:cursor-not-allowed
                      dark:bg-red-500/85 dark:hover:bg-red-500`}
                          title={isOwner ? "Remove member" : "Only owner can remove members"}
                        >
                          Remove
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
