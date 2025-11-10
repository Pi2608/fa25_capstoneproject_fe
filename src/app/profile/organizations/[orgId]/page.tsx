"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import { useAuth } from "@/contexts/AuthContext";
import { Workspace } from "@/types/workspace";
import { getOrganizationMaps } from "@/lib/api-maps";
import {
  deleteOrganization,
  getOrganizationById,
  getOrganizationMembers,
  GetOrganizationMembersResDto,
  inviteMember,
  InviteMemberOrganizationReqDto,
  OrganizationDetailDto,
  removeMember,
  updateMemberRole,
  bulkCreateStudents,
  type BulkCreateStudentsRes,
} from "@/lib/api-organizations";
import { CurrentMembershipDto, getMyMembership } from "@/lib/api-membership";
import { getProjectsByOrganization } from "@/lib/api-workspaces";
import ManageWorkspaces from "@/components/ManageWorkspaces";

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

function userMessage(err: unknown): string {
  const e = parseApiError(err);
  const code = String(e.type || e.title || "").toLowerCase();
  const text = String(e.detail || e.message || "").toLowerCase();
  const status = e.status ?? 0;

  const quotaHit =
    code.includes("userquotaexceeded") ||
    code.includes("organization.userquotaexceeded") ||
    text.includes("maximum user limit") ||
    text.includes("max user") ||
    text.includes("quota") ||
    text.includes("limit") && text.includes("user");

  if (quotaHit) {
    return "Tổ chức đã đạt giới hạn thành viên của gói hiện tại. Hãy nâng cấp gói hoặc xoá bớt thành viên để tiếp tục mời.";
  }

  if (status === 409 || code.includes("conflict") || text.includes("already") && text.includes("member")) {
    return "Email này đã được mời hoặc đã là thành viên của tổ chức.";
  }
  if (status === 403 || code.includes("forbidden")) {
    return "Bạn không có quyền thực hiện thao tác này. Hãy liên hệ Owner/Admin.";
  }
  if (status === 404) {
    return "Không tìm thấy tổ chức hoặc lời mời. Vui lòng tải lại trang.";
  }
  if (status === 400) {
    return "Dữ liệu không hợp lệ. Vui lòng kiểm tra email và thử lại.";
  }
  if (status === 429) {
    return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
  }
  if (status >= 500) {
    return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
  }

  if (e.detail && !/stack|trace|exception/i.test(e.detail)) return e.detail;
  if (e.message && !/stack|trace|exception/i.test(e.message)) return e.message;
  return "Không thể thực hiện yêu cầu. Vui lòng thử lại.";
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
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
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);
  const title = useMemo(() => org?.orgName ?? "—", [org?.orgName]);
  const [importOpen, setImportOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [domain, setDomain] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<BulkCreateStudentsRes | null>(null);

  const { userId: myId, userEmail: myEmail } = useAuth();

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

  const isAdminOrOwner = useMemo(() => {
    const list = asMemberArray(members?.members ?? []);
    return list.some((m) => {
      const role = (m.role ?? m.memberType ?? "").toLowerCase();
      const isAO = role === "owner" || role === "admin";
      if (!isAO) return false;
      const matchById =
        myId && typeof m.memberId === "string" && m.memberId.toLowerCase() === myId.toLowerCase();
      const matchByEmail =
        myEmail && typeof m.email === "string" && m.email.toLowerCase() === myEmail.toLowerCase();
      return Boolean(matchById || matchByEmail);
    });
  }, [members, myId, myEmail]);

  const planAllows = [2, 3].includes(Number(membership?.planId ?? 0));

  const disabledImport = !(isAdminOrOwner && planAllows);
  const tooltipText = !isAdminOrOwner
    ? "Chỉ Owner/Admin mới dùng chức năng này"
    : "Nâng cấp gói (plan 2 hoặc 3) để sử dụng";

  const refreshMembers = useCallback(async () => {
    const memRes = await getOrganizationMembers(orgId);
    setMembers(memRes);
  }, [orgId]);

  const ROLE_OPTIONS = ["Owner", "Admin", "Member", "Viewer"] as const;

  const onChangeRole = useCallback(
    async (memberId?: string | null, currentRole?: string | null, newRole?: string) => {
      if (!memberId || !newRole || newRole === currentRole) return;
      if (!isOwner) {
        setInviteMsg("Bạn không có quyền đổi vai trò. Hãy liên hệ Owner/Admin.");
        return;
      }

      try {
        setRoleBusyId(memberId);
        await updateMemberRole({ orgId, memberId, newRole });
        await refreshMembers();
        setInviteMsg("Đã cập nhật vai trò thành viên.");
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
      if (!memberId) {
        setInviteMsg("Không xác định được thành viên để xoá.");
        return;
      }
      if (!isOwner) {
        setInviteMsg("Bạn không có quyền xoá thành viên. Hãy liên hệ Owner/Admin.");
        return;
      }
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
        const [orgRes, memRes, workspacesData] = await Promise.all([
          getOrganizationById(orgId),
          getOrganizationMembers(orgId),
          getProjectsByOrganization(orgId),
        ]);
        if (!alive) return;
        setOrg(orgRes.organization);
        setMembers(memRes);
        setWorkspaces(workspacesData);
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

  useEffect(() => {
    let alive = true;
    async function loadMembership() {
      if (!orgId) return;
      try {
        setLoadingMembership(true);
        const membershipData = await getMyMembership(orgId);
        if (!alive) return;
        setMembership(membershipData);
      } catch {
        if (!alive) return;
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
    if (!isOwner) {
      setInviteMsg("Chỉ Owner mới được mời thành viên.");
      return;
    }
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
      setInviteMsg(userMessage(e));
    } finally {
      setInviteBusy(false);
    }
  }, [inviteInput, orgId, refreshMembers]);

  const onDeleteOrg = useCallback(async () => {
    if (!org) return;
    if (!isOwner) {
      setDeleteErr("Bạn không có quyền xoá workspace.");
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

  const onImportStudents = useCallback(async () => {
    if (!isAdminOrOwner) {
      setImportMsg("Chỉ Owner/Admin được dùng chức năng này.");
      return;
    }
    if (!planAllows) {
      setImportMsg("Tính năng yêu cầu gói có planId = 2 hoặc 3.");
      return;
    }
    if (!excelFile) {
      setImportMsg("Hãy chọn file Excel (.xlsx).");
      return;
    }
    if (!domain.trim()) {
      setImportMsg("Hãy nhập domain (ví dụ: se1739.edu).");
      return;
    }

    try {
      setImportBusy(true);
      setImportMsg("Đang xử lý...");
      setImportResult(null);

      const res = await bulkCreateStudents(orgId, excelFile, domain.trim());

      setImportResult(res);
      setImportMsg(`Tạo thành công ${res.totalCreated} tài khoản, bỏ qua ${res.totalSkipped}.`);
    } catch (e) {
      setImportMsg(safeMessage(e));
      setImportResult(null);
    } finally {
      setImportBusy(false);
    }
  }, [isAdminOrOwner, planAllows, excelFile, domain, orgId]);

  const downloadCreatedCsv = () => {
    if (!importResult) return;
    const rows = [
      ["email", "fullName", "password", "class"],
      ...importResult.createdAccounts.map((a) => [a.email, a.fullName, a.password, a.class]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "created_students.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyCreatedList = async () => {
    if (!importResult) return;
    const text = importResult.createdAccounts
      .map((a) => `${a.email}\t${a.password}\t${a.fullName}\t${a.class}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setImportMsg("Đã sao chép danh sách tài khoản vào clipboard.");
  };

  const onRemoveMember = useCallback(
    async (memberId?: string | null) => {
      if (!memberId) {
        setInviteMsg("Không xác định được thành viên để xoá.");
        return;
      }
      if (!isOwner) {
        setInviteMsg("Bạn không có quyền xoá thành viên. Hãy liên hệ Owner/Admin.");
        return;
      }

      if (!confirm("Xoá thành viên này khỏi workspace?")) return;

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
        setPermMsg(
          "Bạn đang có quyền hạn chế trong workspace này. Để quản lý cài đặt workspace, hãy liên hệ quản trị viên để được cấp quyền đầy đủ."
        );
        return;
      }
      setPermMsg(null);
      action();
    },
    [isOwner]
  );

  const handleWorkspaceSettings = useCallback(() => {
    requireOwner(() => {
      router.push(`/profile/organizations/${orgId}/settings`);
    });
  }, [requireOwner, router, orgId]);

  const handleWorkspaceAnalytics = useCallback(() => {
    requireOwner(() => {
      router.push(`/profile/organizations/${orgId}/analytics`);
    });
  }, [requireOwner, router, orgId]);

  const copyWorkspaceUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href);
  }, []);
  const copyWorkspaceId = useCallback(() => {
    if (!orgId || typeof window === "undefined") return;
    void navigator.clipboard.writeText(String(orgId));
  }, [orgId]);

  if (loading) return <div className="min-h-[60vh] animate-pulse text-zinc-400 px-4">Đang tải…</div>;
  if (err || !org) return <div className="max-w-3xl px-4 text-red-400">{err ?? "Không tìm thấy workspace."}</div>;

  const memberRows: MemberLike[] = asMemberArray(members?.members ?? []);

  return (
    <div className="min-w-0 relative px-4">
      {permMsg && !isOwner && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {permMsg}{" "}
          <button onClick={() => setPermMsg(null)} className="ml-2 rounded bg-amber-500/20 px-2 py-[2px] text-amber-100">
            Đóng
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
            <button
              onClick={() => setViewOpen((v) => !v)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
            >
              Hiển thị ▾
            </button>
            {viewOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl p-2"
                onMouseLeave={() => setViewOpen(false)}
              >
                <div className="px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Kiểu hiển thị</div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${viewMode === m ? "text-emerald-300" : "text-zinc-200"
                      }`}
                    onClick={() => setViewMode(m)}
                  >
                    {m === "grid" ? "Lưới" : "Danh sách"}
                  </button>
                ))}
                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Sắp xếp theo</div>
                {(
                  [
                    ["recentlyModified", "Chỉnh sửa gần đây"],
                    ["dateCreated", "Ngày tạo"],
                    ["lastViewed", "Xem gần đây"],
                    ["name", "Tên"],
                    ["author", "Tác giả"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortKey === k ? "text-emerald-300" : "text-zinc-200"
                      }`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}
                <div className="mt-2 px-2 py-1 text-xs uppercase tracking-wide text-zinc-400">Thứ tự</div>
                {(["desc", "asc"] as SortOrder[]).map((o) => (
                  <button
                    key={o}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${sortOrder === o ? "text-emerald-300" : "text-zinc-200"
                      }`}
                    onClick={() => setSortOrder(o)}
                  >
                    {o === "desc" ? "Giảm dần" : "Tăng dần"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => (isOwner ? setShareOpen(true) : setPermMsg("Chỉ Owner mới dùng Chia sẻ"))}
            disabled={!isOwner}
            aria-disabled={!isOwner}
            className={`px-3 py-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-sm
              ${!isOwner ? "opacity-50 cursor-not-allowed text-emerald-300/60" : "text-emerald-300 hover:bg-emerald-500/20"}`}
          >
            Chia sẻ
          </button>

          {isOwner ? (
            <button
              onClick={handleWorkspaceSettings}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10"
              title="Cài đặt workspace"
            >
              Cài đặt
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled
              title="Chỉ Owner"
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm opacity-60 cursor-not-allowed"
            >
              Cài đặt
            </button>
          )}

          <div className="relative z-50">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title="Thêm"
            >
              ⋯
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 rounded-lg border border-white/10 bg-zinc-900/95 shadow-xl overflow-hidden"
                onMouseLeave={() => setMoreOpen(false)}
              >
                <button onClick={copyWorkspaceUrl} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200" role="menuitem">
                  Sao chép URL workspace
                </button>
                <button onClick={copyWorkspaceId} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200" role="menuitem">
                  Sao chép ID workspace (API)
                </button>
                <button onClick={handleWorkspaceAnalytics} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 text-zinc-200" role="menuitem">
                  Xem phân tích
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
                    Xoá workspace…
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workspaces Section */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workspace</h2>
          <div className="flex items-center gap-2">
            <ManageWorkspaces orgId={orgId} canManage={isAdminOrOwner} />

            {isOwner && (
              <span className="relative inline-block group">
                <button
                  onClick={() => setImportOpen(true)}
                  disabled={disabledImport}
                  aria-disabled={disabledImport}
                  className={`px-3 py-2 rounded-lg text-sm transition ${disabledImport
                    ? "border border-white/10 bg-white/5 text-zinc-300 opacity-70 cursor-not-allowed"
                    : "border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:shadow-[0_0_0_2px_rgba(16,185,129,0.25)]"
                    }`}
                >
                  Nhập danh sách sinh viên (.xlsx)
                </button>

                {disabledImport && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full opacity-0 group-hover:opacity-100 group-hover:translate-y-[calc(100%+6px)] transition-all duration-150 ease-out z-50 whitespace-nowrap rounded-md border border-white/10 bg-zinc-900/95 px-3 py-1.5 text-xs text-zinc-100 shadow-lg"
                  >
                    {tooltipText}
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-zinc-900/95 border-l border-t border-white/10" />
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {workspaces.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-zinc-400 mb-4">Chưa có workspace nào. Tạo workspace đầu tiên để tổ chức dự án.</p>
            <button
              onClick={() => router.push(`/profile/workspaces`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-900 font-semibold hover:bg-emerald-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tạo workspace
            </button>
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.slice(0, 4).map((workspace: Workspace) => (
              <div
                key={workspace.workspaceId}
                className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4 cursor-pointer"
                onClick={() => router.push(`/profile/organizations/${orgId}/workspaces/${workspace.workspaceId}`)}
              >
                <div className="h-24 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{workspace.workspaceName}</div>
                  <div className="text-xs text-zinc-400 truncate">{workspace.description ?? "Không có mô tả"}</div>
                </div>
              </div>
            ))}
            {workspaces.length > 4 && (
              <div className="group rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-800/60 transition p-4 cursor-pointer" onClick={() => router.push(`/profile/workspaces`)}>
                <div className="h-24 w-full rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-3 grid place-items-center text-zinc-400 text-xs">
                  <div className="text-center">
                    <div className="text-lg font-bold">+{workspaces.length - 4}</div>
                    <div className="text-xs">thêm</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">Xem tất cả workspace</div>
                  <div className="text-xs text-zinc-400">Xem toàn bộ {workspaces.length} workspace</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Workspace Overview */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tổng quan workspace</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-2xl font-bold text-emerald-300">{workspaces.length}</div>
            <div className="text-sm text-zinc-400">Workspace</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-2xl font-bold text-emerald-300">{memberRows.length}</div>
            <div className="text-sm text-zinc-400">Thành viên</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-2xl font-bold text-emerald-300">{membership?.planName || "Basic"}</div>
            <div className="text-sm text-zinc-400">Gói</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-2xl font-bold text-emerald-300">—</div>
            <div className="text-sm text-zinc-400">Hành động</div>
          </div>
        </div>
      </section>

      {shareOpen && isOwner && (
        <div className="absolute top-12 right-0 w-[28rem] rounded-xl border border-white/10 bg-zinc-900/95 shadow-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-zinc-200">Chia sẻ workspace</div>
            <button className="text-zinc-500 hover:text-white" onClick={() => setShareOpen(false)} aria-label="Đóng chia sẻ">
              ✕
            </button>
          </div>
          <div className="mb-3">
            <label className="block text-xs text-zinc-400 mb-1">Email</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="Thêm cộng tác viên"
                className="flex-1 rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !inviteBusy) void onInvite();
                }}
                disabled={!isOwner}
              />
              <button
                onClick={() => void onInvite()}
                disabled={inviteBusy}
                className="px-3 py-2 rounded-md bg-emerald-500 text-zinc-900 font-semibold text-sm hover:bg-emerald-400 disabled:opacity-60"
              >
                {inviteBusy ? "Đang mời..." : "Mời"}
              </button>
            </div>
            {inviteMsg && <div className="mt-2 text-xs text-zinc-300">{inviteMsg}</div>}
          </div>
          <div className="divide-y divide-white/10 text-sm max-h-56 overflow-auto rounded-md border border-white/5">
            {memberRows.map((m, index) => {
              const key = (m.memberId ?? m.email ?? `member-${index}`) as string;
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
                      title="Vai trò / Xoá"
                    >
                      {roleLabel} <span aria-hidden>▾</span>
                    </button>
                  </div>

                  {expanded && (
                    <div className="mb-2 rounded-md border border-white/10 bg-zinc-900/70 p-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-zinc-400">Vai trò</label>
                        <select
                          className="flex-1 rounded-md bg-zinc-800 border border-white/10 px-2 py-1 text-xs text-zinc-100"
                          value={roleLabel}
                          disabled={roleBusyId === m.memberId}
                          onChange={(e) => onChangeRole(m.memberId ?? null, roleLabel, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => askRemoveMember(m.memberId ?? null, m.fullName || m.email || "Người dùng")}
                          disabled={removeBusyId === m.memberId}
                          className="shrink-0 text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                          title="Xoá thành viên"
                        >
                          {removeBusyId === m.memberId ? "Đang xoá…" : "Xoá"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {memberRows.length === 0 && <div className="py-6 text-center text-zinc-400">Chưa có thành viên</div>}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Chỉ người được mời mới xem được workspace này</span>
            <button
              className="text-emerald-300 hover:underline"
              onClick={() => {
                if (typeof window !== "undefined") void navigator.clipboard.writeText(window.location.href);
              }}
            >
              Sao chép liên kết
            </button>
          </div>
        </div>
      )}

      {removeDialog.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[30rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Xoá thành viên</h2>
            <p className="text-sm text-zinc-300 mt-2">
              Bạn sắp xoá <span className="font-semibold">{removeDialog.label ?? "thành viên"}</span> khỏi workspace này.
              Hành động này sẽ gỡ quyền truy cập của họ vào tất cả dự án trong workspace.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm" onClick={() => setRemoveDialog({ open: false })}>
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

      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true">
          <div className="w-[40rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Nhập danh sách sinh viên (.xlsx)</h2>
              <button onClick={() => setImportOpen(false)} className="text-zinc-400 hover:text-white" aria-label="Đóng">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">File Excel (.xlsx)</label>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100 file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-zinc-900 hover:file:bg-emerald-500"
                />
                {excelFile && <div className="mt-1 text-xs text-zinc-400">Đã chọn: {excelFile.name}</div>}
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="vd: se1739.edu"
                  className="w-full rounded-md bg-zinc-800 border border-white/10 px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              {importMsg && <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">{importMsg}</div>}
            </div>

            {importResult && importResult.createdAccounts.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-200">
                    <b>{importResult.totalCreated}</b> tài khoản mới, bỏ qua <b>{importResult.totalSkipped}</b>.
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyCreatedList} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm">
                      Sao chép
                    </button>
                    <button onClick={downloadCreatedCsv} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400">
                      Tải CSV
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-auto rounded-lg border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-zinc-300">
                      <tr>
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-left px-3 py-2">Họ tên</th>
                        <th className="text-left px-3 py-2">Mật khẩu</th>
                        <th className="text-left px-3 py-2">Lớp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.createdAccounts.map((acc) => (
                        <tr key={acc.userId} className="border-t border-white/5">
                          <td className="px-3 py-2 text-zinc-100">{acc.email}</td>
                          <td className="px-3 py-2 text-zinc-100">{acc.fullName}</td>
                          <td className="px-3 py-2 text-emerald-300 font-mono">{acc.password}</td>
                          <td className="px-3 py-2 text-zinc-100">{acc.class}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm" onClick={() => setImportOpen(false)} disabled={importBusy}>
                Huỷ
              </button>
              <button
                onClick={() => void onImportStudents()}
                disabled={importBusy}
                className="px-3 py-2 rounded-lg bg-emerald-500 text-zinc-900 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {importBusy ? "Đang nhập..." : "Nhập danh sách"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className="w-[32rem] max-w-[95vw] rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Xoá workspace</h2>
            <p className="text-sm text-zinc-300 mt-2">
              Bạn sắp xoá workspace <span className="font-semibold">{title}</span>. Hành động này không thể hoàn tác. Nhập{" "}
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
                Huỷ
              </button>
              <button
                disabled={deleteBusy || deleteConfirm !== title}
                className="px-3 py-2 rounded-lg bg-red-500 text-zinc-900 text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
                onClick={() => void onDeleteOrg()}
              >
                {deleteBusy ? "Đang xoá..." : "Xoá workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
