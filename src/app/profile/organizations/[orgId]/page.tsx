"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { Workspace } from "@/types/workspace";
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
import { joinSession, getSession, type ParticipantDto } from "@/lib/api-ques";
import ManageWorkspaces from "@/components/ManageWorkspaces";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
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

function userMessage(err: unknown, t: (k: string, vars?: Record<string, unknown>) => string): string {
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
    (text.includes("limit") && text.includes("user"));

  if (quotaHit) return t("org_detail.err_quota");

  if (status === 409 || code.includes("conflict") || (text.includes("already") && text.includes("member"))) {
    return t("org_detail.err_already_member");
  }
  if (status === 403 || code.includes("forbidden")) {
    return t("org_detail.err_forbidden");
  }
  if (status === 404) {
    return t("org_detail.err_not_found");
  }
  if (status === 400) {
    return t("org_detail.err_bad_request");
  }
  if (status === 429) {
    return t("org_detail.err_rate_limited");
  }
  if (status >= 500) {
    return t("org_detail.err_server");
  }

  if (e.detail && !/stack|trace|exception/i.test(e.detail)) return e.detail;
  if (e.message && !/stack|trace|exception/i.test(e.message)) return e.message;
  return t("org_detail.err_generic");
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
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
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

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinDevice, setJoinDevice] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [joinErr, setJoinErr] = useState<string | null>(null);

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

  const isViewerOnly = useMemo(() => {
    const list = asMemberArray(members?.members ?? []);
    return list.some((m) => {
      const role = (m.role ?? m.memberType ?? "").toLowerCase();
      if (role !== "viewer") return false;

      const matchById =
        myId && typeof m.memberId === "string" && m.memberId.toLowerCase() === myId.toLowerCase();
      const matchByEmail =
        myEmail && typeof m.email === "string" && m.email.toLowerCase() === myEmail.toLowerCase();

      return Boolean(matchById || matchByEmail);
    });
  }, [members, myId, myEmail]);

  const canAccessQuestionBanks = useMemo(() => {
    const list = asMemberArray(members?.members ?? []);
    return list.some((m) => {
      const role = (m.role ?? m.memberType ?? "").toLowerCase();
      // chỉ Owner / Admin / Member
      if (role !== "owner" && role !== "admin" && role !== "member") return false;

      const matchById =
        myId && typeof m.memberId === "string" && m.memberId.toLowerCase() === myId.toLowerCase();
      const matchByEmail =
        myEmail && typeof m.email === "string" && m.email.toLowerCase() === myEmail.toLowerCase();

      return Boolean(matchById || matchByEmail);
    });
  }, [members, myId, myEmail]);
  const planAllows = [2, 3].includes(Number(membership?.planId ?? 0));

  const disabledImport = !(isAdminOrOwner && planAllows);
  const tooltipText = !isAdminOrOwner ? t("org_detail.tip_only_owner_admin") : t("org_detail.tip_upgrade_plan");

  const refreshMembers = useCallback(async () => {
    const memRes = await getOrganizationMembers(orgId);
    setMembers(memRes);
  }, [orgId]);

  const ROLE_OPTIONS = ["Owner", "Admin", "Member", "Viewer"] as const;

  const onChangeRole = useCallback(
    async (memberId?: string | null, currentRole?: string | null, newRole?: string) => {
      if (!memberId || !newRole || newRole === currentRole) return;
      if (!isOwner) {
        setInviteMsg(t("org_detail.err_no_permission_role"));
        return;
      }

      try {
        setRoleBusyId(memberId);
        await updateMemberRole({ orgId, memberId, newRole });
        await refreshMembers();
        setInviteMsg(t("org_detail.msg_role_updated"));
      } catch (e) {
        setInviteMsg(safeMessage(e, t("org_detail.action_failed")));
      } finally {
        setRoleBusyId(null);
      }
    },
    [isOwner, orgId, refreshMembers, t]
  );

  const askRemoveMember = useCallback(
    (memberId?: string | null, label?: string | null) => {
      if (!memberId) {
        setInviteMsg(t("org_detail.err_member_unknown"));
        return;
      }
      if (!isOwner) {
        setInviteMsg(t("org_detail.err_no_permission_remove"));
        return;
      }
      setRemoveDialog({ open: true, memberId, label });
    },
    [isOwner, t]
  );

  const doRemoveMember = useCallback(async () => {
    const memberId = removeDialog.memberId;
    if (!memberId) return;

    try {
      setRemoveBusyId(memberId);
      await removeMember({ orgId, memberId });
      await refreshMembers();
      setInviteMsg(t("org_detail.msg_member_removed"));
    } catch (e) {
      setInviteMsg(safeMessage(e, t("org_detail.action_failed")));
    } finally {
      setRemoveBusyId(null);
      setOpenMemberMenu(null);
      setRemoveDialog({ open: false });
    }
  }, [removeDialog.memberId, orgId, refreshMembers, t]);

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
        setErr(safeMessage(e, t("org_detail.load_failed")));
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (orgId) void loadAll();
    return () => {
      alive = false;
    };
  }, [orgId, t]);

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
      setInviteMsg(t("org_detail.err_only_owner_invite"));
      return;
    }
    const emails = inviteInput
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setInviteMsg(t("org_detail.err_enter_at_least_one_email"));
      return;
    }
    const invalid = emails.find((e) => !isValidEmail(e));
    if (invalid) {
      setInviteMsg(t("org_detail.err_invalid_email", { email: invalid }));
      return;
    }
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      for (const email of emails) {
        const body: InviteMemberOrganizationReqDto = { orgId, memberEmail: email, memberType: "Member" };
        await inviteMember(body);
      }
      setInviteMsg(t("org_detail.msg_invited", { count: emails.length, list: emails.join(", ") }));
      setInviteInput("");
      await refreshMembers();
    } catch (e) {
      setInviteMsg(safeMessage(e, t("org_detail.action_failed")));
    } finally {
      setInviteBusy(false);
    }
  }, [inviteInput, orgId, refreshMembers, isOwner, t]);

  const onDeleteOrg = useCallback(async () => {
    if (!org) return;
    if (!isOwner) {
      setDeleteErr(t("org_detail.err_no_permission_delete"));
      return;
    }
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      await deleteOrganization(org.orgId);
      if (typeof window === "undefined") {
      } else {
        window.dispatchEvent(new Event("auth-changed"));
      }
      router.push("/profile");
    } catch (e) {
      setDeleteErr(safeMessage(e, t("org_detail.delete_failed")));
    } finally {
      setDeleteBusy(false);
    }
  }, [org, router, isOwner, t]);

  const onImportStudents = useCallback(async () => {
    if (!isAdminOrOwner) {
      setImportMsg(t("org_detail.err_only_owner_admin"));
      return;
    }
    if (!planAllows) {
      setImportMsg(t("org_detail.err_plan_required"));
      return;
    }
    if (!excelFile) {
      setImportMsg(t("org_detail.err_select_excel"));
      return;
    }
    if (!domain.trim()) {
      setImportMsg(t("org_detail.err_enter_domain"));
      return;
    }

    try {
      setImportBusy(true);
      setImportMsg(t("org_detail.import_processing"));
      setImportResult(null);

      const res = await bulkCreateStudents(orgId, excelFile, domain.trim());

      setImportResult(res);
      setImportMsg(t("org_detail.import_done", { created: res.totalCreated, skipped: res.totalSkipped }));
    } catch (e) {
      setImportMsg(safeMessage(e, t("org_detail.action_failed")));
      setImportResult(null);
    } finally {
      setImportBusy(false);
    }
  }, [isAdminOrOwner, planAllows, excelFile, domain, orgId, t]);

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
    setImportMsg(t("org_detail.import_copied"));
  };

  const onRemoveMember = useCallback(
    async (memberId?: string | null) => {
      if (!memberId) {
        setInviteMsg(t("org_detail.err_member_unknown"));
        return;
      }
      if (!isOwner) {
        setInviteMsg(t("org_detail.err_no_permission_remove"));
        return;
      }

      if (!confirm(t("org_detail.confirm_remove_member"))) return;

      try {
        setRemoveBusyId(memberId);
        await removeMember({ orgId, memberId });
        await refreshMembers();
        setInviteMsg(t("org_detail.msg_member_removed"));
      } catch (e) {
        setInviteMsg(safeMessage(e, t("org_detail.action_failed")));
      } finally {
        setRemoveBusyId(null);
        setOpenMemberMenu(null);
      }
    },
    [isOwner, orgId, refreshMembers, t]
  );

  const requireOwner = useCallback(
    (action: () => void) => {
      if (!isOwner) {
        setPermMsg(t("org_detail.msg_limited_perm"));
        return;
      }
      setPermMsg(null);
      action();
    },
    [isOwner, t]
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

  const handleJoinLesson = useCallback(async () => {
    const code = joinCode.trim();
    const name = joinName.trim();
    const device = joinDevice.trim();

    if (!code || !name || !device) {
      setJoinErr(
        "Vui lòng nhập đầy đủ mã tiết học, tên hiển thị và thông tin thiết bị."
      );
      setJoinMsg(null);
      return;
    }
    try {
      setJoinBusy(true);
      setJoinErr(null);
      setJoinMsg(null);

      const participant: ParticipantDto = await joinSession({
        sessionCode: code,
        displayName: name,
        deviceInfo: device,
      });

      const session = await getSession(participant.sessionId);

      if (!session.mapId) {
        throw new Error(
          "Session không có mapId, không thể mở bản đồ cho học sinh."
        );
      }

      // Lưu thông tin student + participant vào sessionStorage
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("imos_student_name", name);
        window.sessionStorage.setItem("imos_session_code", code);
        window.sessionStorage.setItem("imos_participant_id", participant.id);
      }

      setJoinMsg("Tham gia tiết học thành công!");

      router.push(
        `/storymap/view/${session.mapId}?sessionId=${participant.sessionId}`
      );

    } catch (e) {
      console.error("join session failed", e);
      setJoinErr(
        "Không tham gia được tiết học. Vui lòng kiểm tra thông tin và thử lại."
      );
      setJoinMsg(null);
    } finally {
      setJoinBusy(false);
    }

  }, [joinCode, joinName, joinDevice, router]);

  if (loading) return <div className={`min-h-[60vh] animate-pulse px-4 ${themeClasses.textMuted}`}>{t("org_detail.loading")}</div>;

  if (err || !org) return <div className={`max-w-3xl px-4 ${isDark ? "text-red-400" : "text-red-600"}`}>{err ?? t("org_detail.not_found")}</div>;

  const memberRows: MemberLike[] = asMemberArray(members?.members ?? []);

  if (isViewerOnly) {
    return (
      <div className="min-w-0 relative px-4">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{org.orgName}</h1>
        </div>

        <section className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className={`rounded-xl border p-4 lg:col-span-2 ${
            isDark 
              ? "border-emerald-500/40 bg-emerald-500/5" 
              : "border-emerald-300 bg-emerald-50"
          }`}>
            <h2 className={`text-base font-semibold mb-1 ${
              isDark ? "text-emerald-200" : "text-emerald-700"
            }`}>
              Tham gia tiết học
            </h2>
            <p className={`text-xs mb-3 ${
              isDark ? "text-emerald-100/80" : "text-emerald-700/80"
            }`}>
              Nhập mã tiết học do giáo viên cung cấp để tham gia phiên tương tác.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Mã tiết học (VD: 331809)"
                className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${themeClasses.input}`}
              />

              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Tên hiển thị của bạn"
                className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${themeClasses.input}`}
              />

              <input
                type="text"
                value={joinDevice}
                onChange={(e) => setJoinDevice(e.target.value)}
                placeholder="Thông tin thiết bị (VD: Laptop phòng máy 01)"
                className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/60 ${themeClasses.input}`}
              />

              <button
                type="button"
                onClick={() => void handleJoinLesson()}
                disabled={joinBusy}
                className="mt-1 inline-flex items-center justify-center rounded-md bg-emerald-500 text-white font-semibold text-sm px-4 py-2 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {joinBusy ? "Đang tham gia..." : "Tham gia tiết học"}
              </button>
            </div>


            {(joinErr || joinMsg) && (
              <p
                className={`mt-2 text-xs ${
                  joinErr 
                    ? (isDark ? "text-red-300" : "text-red-600") 
                    : (isDark ? "text-emerald-300" : "text-emerald-600")
                  }`}
              >
                {joinErr || joinMsg}
              </p>
            )}
          </div>

          <div className={`rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className={`text-2xl font-bold ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>
              {memberRows.length}
            </div>
            <div className={`text-sm ${themeClasses.textMuted}`}>
              {t("org_detail.stat_members")}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 relative px-4">
      {permMsg && !isOwner && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          isDark 
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200" 
            : "border-amber-300 bg-amber-50 text-amber-800"
        }`}>
          {permMsg}{" "}
          <button onClick={() => setPermMsg(null)} className={`ml-2 rounded px-2 py-[2px] ${
            isDark ? "bg-amber-500/20 text-amber-100" : "bg-amber-200 text-amber-900"
          }`}>
            {t("org_detail.btn_close")}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h1 className={`text-2xl sm:text-3xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{org.orgName}</h1>
          <span className={`text-xs rounded-full px-2 py-1 ${
            isDark 
              ? "text-zinc-400 bg-emerald-500/20" 
              : "text-gray-600 bg-emerald-100"
          }`}>
            <h3 className={`text-sm font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>{membership?.planName}</h3>
          </span>
        </div>

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setViewOpen((v) => !v)}
              className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`}
            >
              {t("org_detail.view")} ▾
            </button>
            {viewOpen && (
              <div
                className={`absolute right-0 mt-2 w-64 rounded-lg border shadow-xl p-2 ${themeClasses.panel}`}
                onMouseLeave={() => setViewOpen(false)}
              >
                <div className={`px-2 py-1 text-xs uppercase tracking-wide ${themeClasses.textMuted}`}>{t("org_detail.view_mode")}</div>
                {(["grid", "list"] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${
                      viewMode === m 
                        ? (isDark ? "text-emerald-300" : "text-emerald-600") 
                        : (isDark ? "text-zinc-200" : "text-gray-700")
                      }`}
                    onClick={() => setViewMode(m)}
                  >
                    {m === "grid" ? t("org_detail.mode_grid") : t("org_detail.mode_list")}
                  </button>
                ))}
                <div className={`mt-2 px-2 py-1 text-xs uppercase tracking-wide ${themeClasses.textMuted}`}>{t("org_detail.sort_by")}</div>
                {(
                  [
                    ["recentlyModified", t("org_detail.sort_recently_modified")],
                    ["dateCreated", t("org_detail.sort_date_created")],
                    ["lastViewed", t("org_detail.sort_last_viewed")],
                    ["name", t("org_detail.sort_name")],
                    ["author", t("org_detail.sort_author")],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${
                      sortKey === k 
                        ? (isDark ? "text-emerald-300" : "text-emerald-600") 
                        : (isDark ? "text-zinc-200" : "text-gray-700")
                      }`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}
                <div className={`mt-2 px-2 py-1 text-xs uppercase tracking-wide ${themeClasses.textMuted}`}>{t("org_detail.order")}</div>
                {(["desc", "asc"] as SortOrder[]).map((o) => (
                  <button
                    key={o}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-white/5 ${
                      sortOrder === o 
                        ? (isDark ? "text-emerald-300" : "text-emerald-600") 
                        : (isDark ? "text-zinc-200" : "text-gray-700")
                      }`}
                    onClick={() => setSortOrder(o)}
                  >
                    {o === "desc" ? t("org_detail.order_desc") : t("org_detail.order_asc")}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => (isOwner ? setShareOpen(true) : setPermMsg(t("org_detail.only_owner_share")))}
            disabled={!isOwner}
            aria-disabled={!isOwner}
            className={`px-3 py-2 rounded-lg border text-sm ${
              !isOwner 
                ? (isDark ? "opacity-50 cursor-not-allowed text-emerald-300/60 border-emerald-400/30 bg-emerald-500/10" : "opacity-50 cursor-not-allowed text-emerald-600/60 border-emerald-300 bg-emerald-50")
                : (isDark ? "text-emerald-300 hover:bg-emerald-500/20 border-emerald-400/30 bg-emerald-500/10" : "text-emerald-600 hover:bg-emerald-100 border-emerald-300 bg-emerald-50")
            }`}
          >
            {t("org_detail.share")}
          </button>

          {isOwner ? (
            <button
              onClick={handleWorkspaceSettings}
              className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`}
              title={t("org_detail.settings_title")}
            >
              {t("org_detail.settings")}
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled
              title={t("org_detail.only_owner")}
              className={`px-3 py-2 rounded-lg border text-sm opacity-60 cursor-not-allowed ${themeClasses.button}`}
            >
              {t("org_detail.settings")}
            </button>
          )}

          <div className="relative z-50">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              title={t("org_detail.more")}
            >
              ⋯
            </button>
            {moreOpen && (
              <div
                role="menu"
                className={`absolute right-0 mt-2 w-60 rounded-lg border shadow-xl overflow-hidden ${themeClasses.panel}`}
                onMouseLeave={() => setMoreOpen(false)}
              >
                <button onClick={copyWorkspaceUrl} className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${isDark ? "text-zinc-200" : "text-gray-700"}`} role="menuitem">
                  {t("org_detail.copy_ws_url")}
                </button>
                <button onClick={copyWorkspaceId} className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${isDark ? "text-zinc-200" : "text-gray-700"}`} role="menuitem">
                  {t("org_detail.copy_ws_id")}
                </button>
                <button onClick={handleWorkspaceAnalytics} className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${isDark ? "text-zinc-200" : "text-gray-700"}`} role="menuitem">
                  {t("org_detail.view_analytics")}
                </button>

                {isOwner && (
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      setDeleteOpen(true);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 ${isDark ? "text-red-300" : "text-red-600"}`}
                    role="menuitem"
                  >
                    {t("org_detail.delete_ws_ellipsis")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("org_detail.section_ws")}</h2>
          <div className="flex items-center gap-2">
            <ManageWorkspaces orgId={orgId} canManage={isAdminOrOwner} />
            {canAccessQuestionBanks && (
              <>
                <button
                  onClick={() =>
                    router.push(`/profile/organizations/${orgId}/question-banks`)
                  }
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-500 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:border-emerald-600"
                >
                  Bộ câu hỏi
                </button>

                <button
                  onClick={() =>
                    router.push(`/profile/organizations/${orgId}/sessions`)
                  }
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-500 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:border-emerald-600"
                >
                  Danh sách session
                </button>

                <button
                  onClick={() =>
                    router.push(`/profile/organizations/${orgId}/sessions/create`)
                  }
                  className="px-3 py-2 rounded-lg text-sm font-semibold border border-sky-500 bg-sky-500 text-white shadow-sm hover:bg-sky-600 hover:border-sky-600"
                >
                  Tạo session
                </button>

              </>
            )}

            {isOwner && (
              <span className="relative inline-block group">
                <button
                  onClick={() => setImportOpen(true)}
                  disabled={disabledImport}
                  aria-disabled={disabledImport}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    disabledImport
                      ? (isDark 
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300 cursor-not-allowed" 
                          : "border-emerald-200 bg-emerald-50 text-emerald-500 cursor-not-allowed")
                      : (isDark
                          ? "border-emerald-400 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                          : "border-emerald-500 bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,0.45)] hover:bg-emerald-400 hover:border-emerald-400")
                    }`}
                >
                  {t("org_detail.import_students_btn")}
                </button>


                {disabledImport && (
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2 translate-y-full opacity-0 group-hover:opacity-100 group-hover:translate-y-[calc(100%+6px)] transition-all duration-150 ease-out z-50 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs shadow-lg ${themeClasses.panel}`}
                  >
                    {tooltipText}
                    <span className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-l border-t ${isDark ? "bg-zinc-900/95 border-white/10" : "bg-white border-gray-200"}`} />
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {workspaces.length === 0 && (
          <div className={`rounded-xl border p-6 text-center ${themeClasses.panel}`}>
            <p className={`mb-4 ${themeClasses.textMuted}`}>{t("org_detail.no_ws")}</p>
            <button
              onClick={() => router.push(`/profile/workspaces`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t("org_detail.create_ws")}
            </button>
          </div>
        )}

        {workspaces.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.slice(0, 4).map((workspace: Workspace) => (
              <div
                key={workspace.workspaceId}
                className={`group rounded-xl border transition p-4 cursor-pointer ${themeClasses.panel} ${isDark ? "hover:bg-zinc-800/60" : "hover:bg-gray-50"}`}
                onClick={() => router.push(`/profile/organizations/${orgId}/workspaces/${workspace.workspaceId}`)}
              >
                <div className={`h-24 w-full rounded-lg border mb-3 grid place-items-center text-xs ${
                  isDark 
                    ? "bg-gradient-to-br from-zinc-800 to-zinc-900 border-white/5 text-zinc-400" 
                    : "bg-gradient-to-br from-gray-100 to-gray-200 border-gray-200 text-gray-500"
                }`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className={`truncate font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{workspace.workspaceName}</div>
                  <div className={`text-xs truncate ${themeClasses.textMuted}`}>{workspace.description ?? t("org_detail.no_description")}</div>
                </div>
              </div>
            ))}
            {workspaces.length > 4 && (
              <div
                className={`group rounded-xl border transition p-4 cursor-pointer ${themeClasses.panel} ${isDark ? "hover:bg-zinc-800/60" : "hover:bg-gray-50"}`}
                onClick={() => router.push(`/profile/workspaces`)}
              >
                <div className={`h-24 w-full rounded-lg border mb-3 grid place-items-center text-xs ${
                  isDark 
                    ? "bg-gradient-to-br from-zinc-800 to-zinc-900 border-white/5 text-zinc-400" 
                    : "bg-gradient-to-br from-gray-100 to-gray-200 border-gray-200 text-gray-500"
                }`}>
                  <div className="text-center">
                    <div className="text-lg font-bold">+{workspaces.length - 4}</div>
                    <div className="text-xs">{t("org_detail.more_lower")}</div>
                  </div>
                </div>
                <div className="min-w-0">
                  <div className={`truncate font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("org_detail.view_all_ws")}</div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>{t("org_detail.view_all_ws_count", { count: workspaces.length })}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("org_detail.section_overview")}</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className={`text-2xl font-bold ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>{workspaces.length}</div>
            <div className={`text-sm ${themeClasses.textMuted}`}>{t("org_detail.stat_ws")}</div>
          </div>
          <div className={`rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className={`text-2xl font-bold ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>{memberRows.length}</div>
            <div className={`text-sm ${themeClasses.textMuted}`}>{t("org_detail.stat_members")}</div>
          </div>
          <div className={`rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className={`text-2xl font-bold ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>{membership?.planName || "Basic"}</div>
            <div className={`text-sm ${themeClasses.textMuted}`}>{t("org_detail.stat_plan")}</div>
          </div>
          <div className={`rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className={`text-2xl font-bold ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>—</div>
            <div className={`text-sm ${themeClasses.textMuted}`}>{t("org_detail.stat_actions")}</div>
          </div>
        </div>
      </section>

      {shareOpen && isOwner && (
        <div className={`absolute top-12 right-0 w-[28rem] rounded-xl border shadow-xl p-4 ${themeClasses.panel}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-gray-900"}`}>{t("org_detail.share_ws")}</div>
            <button className={`${isDark ? "text-zinc-500 hover:text-white" : "text-gray-500 hover:text-gray-900"}`} onClick={() => setShareOpen(false)} aria-label={t("org_detail.close_share")}>
              ✕
            </button>
          </div>
          <div className="mb-3">
            <label className={`block text-xs mb-1 ${themeClasses.textMuted}`}>Email</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder={t("org_detail.ph_add_collaborator")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !inviteBusy) void onInvite();
                }}
                disabled={!isOwner}
              />
              <button
                onClick={() => void onInvite()}
                disabled={inviteBusy}
                className="px-3 py-2 rounded-md bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400 disabled:opacity-60"
              >
                {inviteBusy ? t("org_detail.inviting") : t("org_detail.invite")}
              </button>
            </div>
            {inviteMsg && <div className={`mt-2 text-xs ${isDark ? "text-zinc-300" : "text-gray-700"}`}>{inviteMsg}</div>}
          </div>
          <div className={`divide-y text-sm max-h-56 overflow-auto rounded-md border ${themeClasses.tableBorder} ${themeClasses.panel}`}>
            {memberRows.map((m, index) => {
              const key = (m.memberId ?? m.email ?? `member-${index}`) as string;
              const roleLabel = (m.role ?? m.memberType ?? "") || "Member";
              const expanded = expandedMemberId === key;

              return (
                <div key={key} className="px-2">
                  <div className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className={`font-medium truncate ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{m.fullName || m.email || "—"}</div>
                      <div className={`text-xs truncate ${themeClasses.textMuted}`}>{m.email ?? "—"}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedMemberId(expanded ? null : key)}
                      className={`ml-3 shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${themeClasses.button}`}
                      title={t("org_detail.role_remove")}
                    >
                      {t(
                        roleLabel === "Owner"
                          ? "org_detail.role_owner"
                          : roleLabel === "Admin"
                            ? "org_detail.role_admin"
                            : roleLabel === "Viewer"
                              ? "org_detail.role_viewer"
                              : "org_detail.role_member"
                      )}{" "}
                      <span aria-hidden>▾</span>
                    </button>
                  </div>

                  {expanded && (
                    <div className={`mb-2 rounded-md border p-2 ${isDark ? "bg-zinc-900/70 border-white/10" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex items-center gap-2">
                        <label className={`text-xs ${themeClasses.textMuted}`}>{t("org_detail.role")}</label>
                        <select
                          className={`flex-1 rounded-md border px-2 py-1 text-xs ${themeClasses.select}`}
                          value={roleLabel}
                          disabled={roleBusyId === m.memberId}
                          onChange={(e) => onChangeRole(m.memberId ?? null, roleLabel, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {t(
                                r === "Owner"
                                  ? "org_detail.role_owner"
                                  : r === "Admin"
                                    ? "org_detail.role_admin"
                                    : r === "Viewer"
                                      ? "org_detail.role_viewer"
                                      : "org_detail.role_member"
                              )}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => askRemoveMember(m.memberId ?? null, m.fullName || m.email || t("org_detail.user"))}
                          disabled={removeBusyId === m.memberId}
                          className={`shrink-0 text-xs px-2 py-1 rounded border disabled:opacity-60 ${
                            isDark 
                              ? "border-red-500/30 text-red-300 hover:bg-red-500/10" 
                              : "border-red-300 text-red-600 hover:bg-red-50"
                          }`}
                          title={t("org_detail.remove_member")}
                        >
                          {removeBusyId === m.memberId ? t("org_detail.removing") : t("org_detail.remove")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {memberRows.length === 0 && <div className={`py-6 text-center ${themeClasses.textMuted}`}>{t("org_detail.no_members")}</div>}
          </div>
          <div className={`mt-3 flex items-center justify-between text-xs ${themeClasses.textMuted}`}>
            <span>{t("org_detail.share_note")}</span>
            <button
              className={`hover:underline ${isDark ? "text-emerald-300" : "text-emerald-600"}`}
              onClick={() => {
                if (typeof window !== "undefined") void navigator.clipboard.writeText(window.location.href);
              }}
            >
              {t("org_detail.copy_link")}
            </button>
          </div>
        </div>
      )}

      {removeDialog.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className={`w-[30rem] max-w-[95vw] rounded-xl border p-5 shadow-2xl ${themeClasses.panel}`}>
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("org_detail.remove_member")}</h2>
            <p className={`text-sm mt-2 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
              {t("org_detail.remove_member_desc", { name: removeDialog.label ?? t("org_detail.member") })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`} onClick={() => setRemoveDialog({ open: false })}>
                {t("org_detail.cancel")}
              </button>
              <button
                onClick={() => void doRemoveMember()}
                disabled={removeBusyId === removeDialog.memberId}
                className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
              >
                {removeBusyId === removeDialog.memberId ? t("org_detail.removing") : t("org_detail.remove_member")}
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" role="dialog" aria-modal="true">
          <div className={`w-[40rem] max-w-[95vw] rounded-xl border p-5 shadow-2xl ${themeClasses.panel}`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("org_detail.import_students_title")}</h2>
              <button onClick={() => setImportOpen(false)} className={`${isDark ? "text-zinc-400 hover:text-white" : "text-gray-500 hover:text-gray-900"}`} aria-label={t("org_detail.close")}>
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs mb-1 ${themeClasses.textMuted}`}>{t("org_detail.excel_label")}</label>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                  className={`w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-emerald-500 ${themeClasses.input}`}
                />
                {excelFile && <div className={`mt-1 text-xs ${themeClasses.textMuted}`}>{t("org_detail.selected_file", { name: excelFile.name })}</div>}
              </div>

              <div>
                <label className={`block text-xs mb-1 ${themeClasses.textMuted}`}>Domain</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder={t("org_detail.ph_domain")}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
                />
              </div>

              {importMsg && <div className={`rounded-md border px-3 py-2 text-sm ${isDark ? "border-white/10 bg-white/5 text-zinc-200" : "border-gray-200 bg-gray-50 text-gray-700"}`}>{importMsg}</div>}
            </div>

            {importResult && importResult.createdAccounts.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`text-sm ${isDark ? "text-zinc-200" : "text-gray-700"}`}>
                    {t("org_detail.import_summary", { created: importResult.totalCreated, skipped: importResult.totalSkipped })}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyCreatedList} className={`px-3 py-1.5 rounded-lg border text-sm ${themeClasses.button}`}>
                      {t("org_detail.copy")}
                    </button>
                    <button onClick={downloadCreatedCsv} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400">
                      {t("org_detail.download_csv")}
                    </button>
                  </div>
                </div>

                <div className={`max-h-56 overflow-auto rounded-lg border ${themeClasses.tableBorder}`}>
                  <table className="w-full text-sm">
                    <thead className={`${isDark ? "bg-white/5" : "bg-gray-50"} ${themeClasses.tableHeader}`}>
                      <tr>
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-left px-3 py-2">{t("org_detail.fullname")}</th>
                        <th className="text-left px-3 py-2">{t("org_detail.password")}</th>
                        <th className="text-left px-3 py-2">{t("org_detail.class")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.createdAccounts.map((acc) => (
                        <tr key={acc.userId} className={`border-t ${themeClasses.tableBorder}`}>
                          <td className={`px-3 py-2 ${themeClasses.tableCell}`}>{acc.email}</td>
                          <td className={`px-3 py-2 ${themeClasses.tableCell}`}>{acc.fullName}</td>
                          <td className={`px-3 py-2 font-mono ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>{acc.password}</td>
                          <td className={`px-3 py-2 ${themeClasses.tableCell}`}>{acc.class}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`} onClick={() => setImportOpen(false)} disabled={importBusy}>
                {t("org_detail.cancel")}
              </button>
              <button
                onClick={() => void onImportStudents()}
                disabled={importBusy}
                className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {importBusy ? t("org_detail.importing") : t("org_detail.import_list")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOwner && deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
          <div className={`w-[32rem] max-w-[95vw] rounded-xl border p-5 shadow-2xl ${themeClasses.panel}`}>
            <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("org_detail.delete_ws")}</h2>
            <p className={`text-sm mt-2 ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
              {t("org_detail.delete_ws_desc", { title })}
            </p>
            <input
              autoFocus
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={title}
              className={`mt-4 w-full rounded-md border px-3 py-2 text-sm ${themeClasses.input}`}
            />
            {deleteErr && <div className={`mt-3 text-sm ${isDark ? "text-red-300" : "text-red-600"}`}>{deleteErr}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                className={`px-3 py-2 rounded-lg border text-sm ${themeClasses.button}`}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteErr(null);
                  setDeleteConfirm("");
                }}
              >
                {t("org_detail.cancel")}
              </button>
              <button
                disabled={deleteBusy || deleteConfirm !== title}
                className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 disabled:opacity-60"
                onClick={() => void onDeleteOrg()}
              >
                {deleteBusy ? t("org_detail.deleting") : t("org_detail.delete_ws")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
