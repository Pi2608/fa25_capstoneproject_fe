"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import {
  getOrganizationById,
  type OrganizationDetailDto,
  getOrganizationMembers,
  type GetOrganizationMembersResDto,
  inviteMember,
  type InviteMemberOrganizationReqDto,
  deleteOrganization,
  getUserAccessTools,
  type UserAccessTool,
} from "@/lib/api";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Yêu cầu thất bại";
}

type JwtPayload = Record<string, unknown>;
function getMyIdentityFromToken(): { userId?: string | null; email?: string | null } {
  if (typeof window === "undefined") return { userId: null, email: null };
  const token = localStorage.getItem("token");
  if (!token) return { userId: null, email: null };
  const parts = token.split(".");
  if (parts.length !== 3) return { userId: null, email: null };
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    const p = JSON.parse(json) as JwtPayload;

    const email =
      (typeof p.email === "string" && p.email) ||
      (typeof p.Email === "string" && p.Email) ||
      (typeof p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] === "string" &&
        (p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] as string)) ||
      null;

    const userId =
      (typeof p.userId === "string" && p.userId) ||
      (typeof p.uid === "string" && p.uid) ||
      (typeof p.sub === "string" && p.sub) ||
      (typeof p.nameid === "string" && p.nameid) ||
      (typeof p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] === "string" &&
        (p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] as string)) ||
      null;

    return { userId, email };
  } catch {
    return { userId: null, email: null };
  }
}

type ViewMode = "grid" | "list";
type SortKey = "recentlyModified" | "dateCreated" | "lastViewed" | "name" | "author";
type SortOrder = "asc" | "desc";

/** Kiểu tối thiểu cho member để tránh any */
type MemberLike = {
  memberId?: string | null;
  email?: string | null;
  fullName?: string | null;
  role?: string | null;
  memberType?: string | null;
};

function asMemberArray(x: unknown): MemberLike[] {
  if (!Array.isArray(x)) return [];
  return x.map((m) => {
    const r: MemberLike = {};
    if (m && typeof m === "object") {
      const o = m as Record<string, unknown>;
      r.memberId = typeof o.memberId === "string" ? o.memberId : null;
      r.email = typeof o.email === "string" ? o.email : null;
      r.fullName = typeof o.fullName === "string" ? o.fullName : null;
      r.role = typeof o.role === "string" ? o.role : null;
      r.memberType = typeof o.memberType === "string" ? o.memberType : null;
    }
    return r;
  });
}

export default function OrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
  const [members, setMembers] = useState<GetOrganizationMembersResDto | null>(null);
  const [tools, setTools] = useState<UserAccessTool[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const [permMsg, setPermMsg] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const title = useMemo(() => org?.orgName ?? "—", [org?.orgName]);

  const me = useMemo(getMyIdentityFromToken, []);
  const myEmail = me.email ?? null;
  const myId = me.userId ?? null;

  const isOwner = useMemo(() => {
    const list = asMemberArray(members?.members ?? []);
    return list.some((m) => {
      const role = (m.role ?? m.memberType ?? "").toLowerCase();
      if (role !== "owner") return false;

      const matchById =
        myId && typeof m.memberId === "string" && m.memberId.toLowerCase() === myId.toLowerCase();
      const matchByEmail =
        myEmail && typeof m.email === "string" && m.email.toLowerCase() === myEmail.toLowerCase();

      return Boolean(matchById || matchByEmail);
    });
  }, [members, myEmail, myId]);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        setLoading(true);
        setErr(null);

        const [orgRes, memRes] = await Promise.all([getOrganizationById(orgId), getOrganizationMembers(orgId)]);
        if (!alive) return;

        setOrg(orgRes.organization);
        setMembers(memRes);

        try {
          const ats = await getUserAccessTools();
          if (!alive) return;
          setTools(ats);
        } catch (e) {
          console.warn("Load user access tools failed:", safeMessage(e));
        }
      } catch (e) {
        if (!alive) return;
        setErr(safeMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (orgId) void loadAll();
    return () => {
      alive = false;
    };
  }, [orgId]);

  const refreshMembers = useCallback(async () => {
    const memRes = await getOrganizationMembers(orgId);
    setMembers(memRes);
  }, [orgId]);

  const onInvite = useCallback(async () => {
    const emails = inviteInput
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setInviteMsg("Hãy nhập ít nhất 1 email.");
      return;
    }
    const invalid = emails.find((e) => !isValidEmail(e));
    if (invalid) {
      setInviteMsg(`Email không hợp lệ: ${invalid}`);
      return;
    }

    setInviteBusy(true);
    setInviteMsg(null);
    try {
      for (const email of emails) {
        const body: InviteMemberOrganizationReqDto = { orgId, memberEmail: email, memberType: "Member" };
        await inviteMember(body);
      }
      setInviteMsg(`Đã gửi lời mời tới ${emails.join(", ")}.`);
      setInviteInput("");
      await refreshMembers();
    } catch (e) {
      setInviteMsg(safeMessage(e));
    } finally {
      setInviteBusy(false);
    }
  }, [inviteInput, orgId, refreshMembers]);

  const onDeleteOrg = useCallback(async () => {
    if (!org) return;
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await deleteOrganization(org.orgId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-changed"));
      }
      router.push("/profile");
    } catch (e) {
      setDeleteErr(safeMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }, [org, router]);

  const requireOwner = useCallback(
    (action: () => void) => {
      if (!isOwner) {
        setPermMsg(
          "You have limited access in this workspace. To create or edit maps, ask your admin for full access."
        );
        return;
      }
      setPermMsg(null);
      action();
    },
    [isOwner]
  );

  const clickNewMap = useCallback(() => {
    requireOwner(() => router.push(`/profile/organizations/${orgId}/maps/new`));
  }, [orgId, router, requireOwner]);

  const clickNewFolder = useCallback(() => {
    requireOwner(() => {
      alert("Create Folder (stub) - thêm route khi backend sẵn sàng.");
    });
  }, [requireOwner]);

  const clickNewView = useCallback(() => {
    requireOwner(() => {
      alert("Create View (stub) - thêm route khi backend sẵn sàng.");
    });
  }, [requireOwner]);

  const copyProjectUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href);
  }, []);
  const copyProjectId = useCallback(() => {
    if (!orgId || typeof window === "undefined") return;
    void navigator.clipboard.writeText(String(orgId));
  }, [orgId]);

  if (loading) {
    return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  }
  if (err || !org) {
    return <div className="max-w-3xl px-4 text-red-400">{err ?? "Không tìm thấy tổ chức."}</div>;
  }

  const memberRows: MemberLike[] = asMemberArray(members?.members ?? []);

  return (
    <div className="min-w-0 relative px-4">
      {permMsg && !isOwner && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {permMsg}{" "}
          <button
            onClick={() => setPermMsg(null)}
            className="ml-2 rounded bg-amber-500/20 px-2 py-[2px] text-amber-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold">{title}</h1>

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setViewOpen((v) => !v)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            >
              View ▾
            </button>
            {viewOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl p-2"
                onMouseLeave={() => setViewOpen(false)}
              >
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Show items as</div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${
                      viewMode === m ? "text-emerald-300" : "text-zinc-200"
                    }`}
                    onClick={() => setViewMode(m)}
                  >
                    {m === "grid" ? "Grid" : "List"}
                  </button>
                ))}

                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Sort by</div>
                {(
                  [
                    ["recentlyModified", "Recently modified"],
                    ["dateCreated", "Date created"],
                    ["lastViewed", "Last viewed"],
                    ["name", "Name"],
                    ["author", "Author"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${
                      sortKey === k ? "text-emerald-300" : "text-zinc-200"
                    }`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}

                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Order</div>
                {(["desc", "asc"] as SortOrder[]).map((o) => (
                  <button
                    key={o}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${
                      sortOrder === o ? "text-emerald-300" : "text-zinc-200"
                    }`}
                    onClick={() => setSortOrder(o)}
                  >
                    {o === "desc" ? "Descending" : "Ascending"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShareOpen(true)}
            className="px-3 py-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 text-sm hover:bg-emerald-500/20"
          >
            Share
          </button>

          <button
            onClick={clickNewFolder}
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10"
            title="New folder"
          >
            New folder
          </button>
          {/* <button
            onClick={clickNewView}
            className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10"
            title="New view"
          >
            New view
          </button> */}
          <button
            onClick={clickNewMap}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400"
          >
            New map
          </button>

          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title="More"
            >
              ⋯
            </button>

            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl overflow-hidden"
                onMouseLeave={() => setMoreOpen(false)}
              >
                <button
                  onClick={copyProjectUrl}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200"
                  role="menuitem"
                >
                  Copy project URL
                </button>
                <button
                  onClick={copyProjectId}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200"
                  role="menuitem"
                >
                  Copy project ID for API
                </button>
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-red-300"
                  role="menuitem"
                >
                  Delete project…
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold">Access Tools</h2>
        {tools.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No access tools granted yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((t) => (
              <li
                key={t.id}
                className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 hover:bg-zinc-800/60 transition"
              >
                <div className="flex items-start gap-3">
                  {t.iconUrl ? (
                    <Image
                      src={t.iconUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-md bg-zinc-800/70 p-1 object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-zinc-800/50" />
                  )}

                  <div className="flex-1">
                    <div className="text-base font-semibold">{t.name}</div>
                    <div className="text-sm text-zinc-400">
                      {t.description ? String(t.description) : "No description"}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-white/5 pt-2">
                      <span className={t.isActive ? "text-emerald-400" : "text-red-400"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                      <span>
                        Expires:{" "}
                        {/^(?:0001-01-01|0001)/.test(t.expiredAt)
                          ? "No expiry"
                          : new Date(t.expiredAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { t: "Getting started in 30 seconds" },
            { t: "Uploading your data" },
            { t: "Styling your data" },
            { t: "Easily share your maps" },
          ].map((c, i) => (
            <div
              key={String(i)}
              className="rounded-lg border border-white/10 bg-zinc-900/50 p-4 h-32 flex items-center justify-center text-center text-sm text-zinc-300"
            >
              {c.t}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center py-10">
          <p className="text-zinc-400 mb-3">No maps in this project yet!</p>
          <button
            onClick={clickNewMap}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
          >
            Create a map here
          </button>
        </div>
      </div>

      {shareOpen && (
        <div className="absolute top-12 right-0 w-[28rem] rounded-xl border border-white/10 bg-zinc-900/95 shadow-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-zinc-200">Share project</div>
            <button
              className="text-zinc-500 hover:text-white"
              onClick={() => setShareOpen(false)}
              aria-label="Close share"
            >
              ✕
            </button>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-zinc-400 mb-1">Emails</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="Add collaborators (you can paste multiple emails)"
                className="flex-1 rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !inviteBusy) void onInvite();
                }}
              />
              <button
                onClick={() => void onInvite()}
                disabled={inviteBusy}
                className="px-3 py-2 rounded-md bg-emerald-500 text-zinc-900 font-semibold text-sm hover:bg-emerald-400 disabled:opacity-60"
              >
                {inviteBusy ? "Inviting..." : "Invite"}
              </button>
            </div>
            {inviteMsg && <div className="mt-2 text-xs text-zinc-300">{inviteMsg}</div>}
          </div>

          <div className="divide-y divide-white/10 text-sm max-h-56 overflow-auto rounded-md border border-white/5">
            {memberRows.map((m) => {
              const roleLabel = (m.role ?? m.memberType ?? "") || "";
              return (
                <div key={m.memberId ?? m.email ?? Math.random().toString(36)} className="flex items-center justify-between py-2 px-2">
                  <div>
                    <div className="font-medium text-zinc-100">{m.fullName || m.email || "—"}</div>
                    <div className="text-xs text-zinc-400">{m.email ?? "—"}</div>
                  </div>
                  <span className="text-xs text-zinc-400">{roleLabel}</span>
                </div>
              );
            })}
            {memberRows.length === 0 && (
              <div className="py-6 text-center text-zinc-400">No members yet</div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Only invited users see this project</span>
            <button
              className="text-emerald-300 hover:underline"
              onClick={() => {
                if (typeof window !== "undefined") void navigator.clipboard.writeText(window.location.href);
              }}
            >
              Copy link
            </button>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Delete project</h2>
            <p className="text-sm text-zinc-300 mt-2">
              Bạn sắp xóa tổ chức <span className="font-semibold">{title}</span>. Hành động này không thể hoàn tác. Nhập{" "}
              <span className="font-mono">{title}</span> để xác nhận.
            </p>

            <input
              autoFocus
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={title}
              className="mt-4 w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
            />

            {deleteErr && <div className="mt-3 text-sm text-red-300">{deleteErr}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteErr(null);
                  setDeleteConfirm("");
                }}
              >
                Hủy
              </button>
              <button
                disabled={deleteBusy || deleteConfirm !== title}
                className="px-3 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
                onClick={() => void onDeleteOrg()}
              >
                {deleteBusy ? "Đang xóa..." : "Xóa tổ chức"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
