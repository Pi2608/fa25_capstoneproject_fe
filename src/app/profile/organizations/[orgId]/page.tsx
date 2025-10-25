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
  getOrganizationMaps,
  removeMember,
  updateMemberRole,
  createMap,
  type CreateMapRequest,
  getMyMembership,
  type CurrentMembershipDto,
} from "@/lib/api";
type MapRow = Awaited<ReturnType<typeof getOrganizationMaps>>[number];

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
  const p = useParams<{ orgId: string }>();
  const orgId = p?.orgId ?? "";

  const router = useRouter();

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
  const [members, setMembers] = useState<GetOrganizationMembersResDto | null>(null);
  const [tools, setTools] = useState<UserAccessTool[]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [creatingMap, setCreatingMap] = useState(false);
  const [membership, setMembership] = useState<CurrentMembershipDto | null>(null);
  const [loadingMembership, setLoadingMembership] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean;
    memberId?: string | null;
    label?: string | null;
  }>({ open: false });

  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [openMemberMenu, setOpenMemberMenu] = useState<string | null>(null);

  const [permMsg, setPermMsg] = useState<string | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortKey, setSortKey] = useState<SortKey>("dateCreated");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);
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

  const refreshMembers = useCallback(async () => {
    const memRes = await getOrganizationMembers(orgId);
    setMembers(memRes);
  }, [orgId]);

  const ROLE_OPTIONS = ["Owner", "Admin", "Member", "Viewer"] as const;

  const onChangeRole = useCallback(
    async (memberId?: string | null, currentRole?: string | null, newRole?: string) => {
      if (!memberId || !newRole || newRole === currentRole) return;
      if (!isOwner) { setInviteMsg("Bạn không có quyền đổi quyền. Hãy hỏi Owner/Admin."); return; }

      try {
        setRoleBusyId(memberId);
        await updateMemberRole({ orgId, memberId, newRole });
        await refreshMembers();
        setInviteMsg("Đã cập nhật quyền thành viên.");
      } catch (e) {
        setInviteMsg(safeMessage(e));
      } finally {
        setRoleBusyId(null);
      }
    },
    [isOwner, orgId, refreshMembers]
  );

  const askRemoveMember = useCallback(
    (memberId?: string | null, label?: string | null) => {
      if (!memberId) { setInviteMsg("Không xác định được thành viên để xoá."); return; }
      if (!isOwner) { setInviteMsg("Bạn không có quyền xoá thành viên. Hãy hỏi Owner/Admin."); return; }
      setRemoveDialog({ open: true, memberId, label });
    },
    [isOwner]
  );

  const doRemoveMember = useCallback(async () => {
    const memberId = removeDialog.memberId;
    if (!memberId) return;

    try {
      setRemoveBusyId(memberId);
      await removeMember({ orgId, memberId });
      await refreshMembers();
      setInviteMsg("Đã xoá thành viên.");
    } catch (e) {
      setInviteMsg(safeMessage(e));
    } finally {
      setRemoveBusyId(null);
      setOpenMemberMenu(null);
      setRemoveDialog({ open: false });
    }
  }, [removeDialog.memberId, orgId, refreshMembers]);

  useEffect(() => {
    let alive = true;
    async function loadAll() {
      try {
        setLoading(true);
        setErr(null);
        const [orgRes, memRes, mapsRes] = await Promise.all([
          getOrganizationById(orgId),
          getOrganizationMembers(orgId),
          getOrganizationMaps(orgId),
        ]);
        if (!alive) return;
        setOrg(orgRes.organization);
        setMembers(memRes);
        setMaps(mapsRes);
        // Access tools functionality removed
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

  // Load membership data
  useEffect(() => {
    let alive = true;
    async function loadMembership() {
      if (!orgId) return;
      
      try {
        setLoadingMembership(true);
        const membershipData = await getMyMembership(orgId);
        if (!alive) return;
        setMembership(membershipData);
      } catch (error) {
        if (!alive) return;
        console.log("No membership found for organization:", error);
        setMembership(null);
      } finally {
        if (alive) setLoadingMembership(false);
      }
    }
    
    void loadMembership();
    return () => {
      alive = false;
    };
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

  // ... ở trong OrgDetailPage, sau onInvite(...)
  const onDeleteOrg = useCallback(async () => {
    if (!org) return;
    if (!isOwner) {
      setDeleteErr("Bạn không có quyền xóa tổ chức.");
      return;
    }
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
  }, [org, router, isOwner]);

  const onRemoveMember = useCallback(
    async (memberId?: string | null) => {
      if (!memberId) {
        setInviteMsg("Không xác định được thành viên để xoá.");
        return;
      }
      if (!isOwner) {
        setInviteMsg("Bạn không có quyền xoá thành viên. Hãy hỏi Owner/Admin.");
        return;
      }

      if (!confirm("Remove this member from the project?")) return;

      try {
        setRemoveBusyId(memberId);
        await removeMember({ orgId, memberId });
        await refreshMembers();
        setInviteMsg("Đã xoá thành viên.");
      } catch (e) {
        setInviteMsg(safeMessage(e));
      } finally {
        setRemoveBusyId(null);
        setOpenMemberMenu(null);
      }
    },
    [isOwner, orgId, refreshMembers]
  );

  const requireOwner = useCallback(
    (action: () => void) => {
      if (!isOwner) {
        setPermMsg("You have limited access in this workspace. To create or edit maps, ask your admin for full access.");
        return;
      }
      setPermMsg(null);
      action();
    },
    [isOwner]
  );

  const createAndGo = useCallback(() => {
    requireOwner(async () => {
      if (!orgId || creatingMap) return;
      try {
        setCreatingMap(true);

        const body: CreateMapRequest = {
          orgId,
          name: "Untitled Map",
          description: "",
          isPublic: false,
          baseMapProvider: "OSM",
          defaultBounds: undefined,
          viewState: undefined,
        };

        const created = await createMap(body);
        const newId = created.mapId;
        if (!newId) throw new Error("Không xác định được ID bản đồ mới.");

        const n = encodeURIComponent(body.name ?? "Untitled Map");
        router.push(`/maps/${newId}?created=1&name=${n}`);
      } catch (e) {
        setInviteMsg(safeMessage(e));
      } finally {
        setCreatingMap(false);
      }
    });
  }, [orgId, creatingMap, requireOwner, router]);

  const clickNewMap = useCallback(() => {
    void createAndGo();
  }, [createAndGo]);


  const clickNewFolder = useCallback(() => {
    requireOwner(() => {
      alert("Create Folder (stub)");
    });
  }, [requireOwner]);

  const clickNewView = useCallback(() => {
    requireOwner(() => {
      alert("Create View (stub)");
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

  const sortedMaps = useMemo(() => {
    const arr = [...maps];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
      }
      if (sortKey === "author") {
        return (a.ownerId || "").localeCompare(b.ownerId || "", undefined, { sensitivity: "base" });
      }
      const ad = new Date(a.createdAt ?? 0).getTime();
      const bd = new Date(b.createdAt ?? 0).getTime();
      return ad - bd;
    });
    if (sortOrder === "desc") arr.reverse();
    return arr;
  }, [maps, sortKey, sortOrder]);

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  if (err || !org) return <div className="max-w-3xl px-4 text-red-400">{err ?? "Không tìm thấy tổ chức."}</div>;

  const memberRows: MemberLike[] = asMemberArray(members?.members ?? []);

  return (
    <div className="min-w-0 relative px-4">
      {permMsg && !isOwner && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {permMsg}{" "}
          <button onClick={() => setPermMsg(null)} className="ml-2 rounded bg-amber-500/20 px-2 py-[2px] text-amber-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold">{org.orgName}</h1>
          <span className="text-xs text-zinc-400 bg-emerald-500/20 rounded-full px-2 py-1">
            <h3 className="text-sm font-semibold text-emerald-300">{membership?.planName}</h3>
          </span>
        </div>

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button onClick={() => setViewOpen((v) => !v)} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm">
              View ▾
            </button>
            {viewOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl p-2" onMouseLeave={() => setViewOpen(false)}>
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Show items as</div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${viewMode === m ? "text-emerald-300" : "text-zinc-200"}`}
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
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortKey === k ? "text-emerald-300" : "text-zinc-200"}`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}
                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Order</div>
                {(["desc", "asc"] as SortOrder[]).map((o) => (
                  <button
                    key={o}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortOrder === o ? "text-emerald-300" : "text-zinc-200"}`}
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

          <button onClick={clickNewFolder} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10" title="New folder">
            New folder
          </button>

          {/* <button onClick={clickNewView} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10" title="New view">
            New view
          </button> */}
          <button
            onClick={createAndGo}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
            disabled={creatingMap}
          >
            {creatingMap ? "Creating…" : "New map"}
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
              <div role="menu" className="absolute right-0 mt-2 w-60 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl overflow-hidden" onMouseLeave={() => setMoreOpen(false)}>
                <button onClick={copyProjectUrl} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200" role="menuitem">
                  Copy project URL
                </button>
                <button onClick={copyProjectId} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200" role="menuitem">
                  Copy project ID for API
                </button>

                {isOwner && (
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Maps</h2>

        {sortedMaps.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-zinc-400 mb-4">No maps in this project yet.</p>
            <button
              onClick={createAndGo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400 disabled:opacity-60"
              disabled={creatingMap}
            >
              {creatingMap ? "Creating…" : "Create a map here"}
            </button>
          </div>
        )}

        {sortedMaps.length > 0 && viewMode === "grid" && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedMaps.map((m) => (
              <li
                key={m.id}
                className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4 cursor-pointer"
                onClick={() => router.push(`/maps/${m.id}`)}
                title={m.name}
              >
                <div className="h-32 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                  Preview
                </div>
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.name || "Untitled"}</div>
                    <div className="text-xs text-zinc-400">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/maps/${m.id}`);
                    }}
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {sortedMaps.length > 0 && viewMode === "list" && (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-zinc-300">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Author</th>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {sortedMaps.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="px-3 py-2">
                      <button className="text-emerald-300 hover:underline" onClick={() => router.push(`/maps/${m.id}`)}>
                        {m.name || "Untitled"}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{m.ownerId || "—"}</td>
                    <td className="px-3 py-2 text-zinc-400">{m.createdAt ? new Date(m.createdAt).toLocaleString() : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                        onClick={() => router.push(`/maps/${m.id}`)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-6">
        <button
          type="button"
          onClick={() => setToolsOpen((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
          aria-expanded={toolsOpen}
          aria-controls="access-tools-panel"
        >
          <span className="text-lg font-semibold">
            Access Tools
            <span className="ml-2 text-xs font-normal text-zinc-400">{tools.length ? `(${tools.length})` : ""}</span>
          </span>
          <span className={["inline-block transition-transform duration-200", toolsOpen ? "rotate-180" : "rotate-0"].join(" ")} aria-hidden>
            ▾
          </span>
        </button>

        {toolsOpen && (
          <div id="access-tools-panel" className="mt-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            {tools.length === 0 ? (
              <p className="text-sm text-zinc-400">No access tools granted yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map((t) => (
                  <li key={t.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 hover:bg-zinc-800/60 transition">
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
                        <div className="text-sm text-zinc-400">{t.description ? String(t.description) : "No description"}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400 border-t border-white/5 pt-2">
                          <span className={t.isActive ? "text-emerald-400" : "text-red-400"}>{t.isActive ? "Active" : "Inactive"}</span>
                          <span>
                            Expires:{" "}
                            {/^(?:0001-01-01|0001)/.test(t.expiredAt) ? "No expiry" : new Date(t.expiredAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {shareOpen && (
        <div className="absolute top-12 right-0 w-[28rem] rounded-xl border border-white/10 bg-zinc-900/95 shadow-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-zinc-200">Share project</div>
            <button className="text-zinc-500 hover:text-white" onClick={() => setShareOpen(false)} aria-label="Close share">
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
              const key = (m.memberId ?? m.email ?? Math.random().toString(36)) as string;
              const roleLabel = (m.role ?? m.memberType ?? "") || "Member";
              const expanded = expandedMemberId === key;

              return (
                <div key={key} className="px-2">
                  <div className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-100 truncate">{m.fullName || m.email || "—"}</div>
                      <div className="text-xs text-zinc-400 truncate">{m.email ?? "—"}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedMemberId(expanded ? null : key)}
                      className="ml-3 shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10"
                      title="Role / Remove"
                    >
                      {roleLabel} <span aria-hidden>▾</span>
                    </button>
                  </div>

                  {expanded && (
                    <div className="mb-2 rounded-md border border-white/10 bg-zinc-900/70 p-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-400">Role</label>
                        <select
                          className="flex-1 rounded-md bg-zinc-800 border border-white/10 px-2 py-1 text-xs text-zinc-100"
                          value={roleLabel}
                          disabled={roleBusyId === m.memberId}
                          onChange={(e) => onChangeRole(m.memberId ?? null, roleLabel, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => askRemoveMember(m.memberId ?? null, m.fullName || m.email || "Người dùng")}
                          disabled={removeBusyId === m.memberId}
                          className="shrink-0 text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                          title="Remove member"
                        >
                          {removeBusyId === m.memberId ? "Removing…" : "Remove"}
                        </button>
                      </div>
                    </div>
                  )}
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

      {removeDialog.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[30rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Xoá thành viên</h2>
            <p className="text-sm text-zinc-300 mt-2">
              Bạn sắp xoá <span className="font-semibold">{removeDialog.label ?? "thành viên"}</span> khỏi dự án này.
              Hành động này sẽ gỡ quyền truy cập của họ vào tất cả bản đồ trong tổ chức.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={() => setRemoveDialog({ open: false })}
              >
                Huỷ
              </button>
              <button
                onClick={() => void doRemoveMember()}
                disabled={removeBusyId === removeDialog.memberId}
                className="px-3 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {removeBusyId === removeDialog.memberId ? "Đang xoá..." : "Xoá thành viên"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && deleteOpen && (
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
