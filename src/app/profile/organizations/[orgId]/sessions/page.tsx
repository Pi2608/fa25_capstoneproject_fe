"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMySessions,
  getAllSessionsByOrganization,
  getSessionByCode,
  deleteSession,
  type SessionDto,
} from "@/lib/api-ques";
import { getMyOrganizations, type MyOrganizationDto } from "@/lib/api-organizations";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

type TabKey = "my" | "all";
type SortBy = "createdAt" | "name" | "status";
type Order = "asc" | "desc";

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN");
}

function normalizeStatusEnum(status?: string | null, t?: (ns: string, key: string) => string): string {
  if (!t) return "—";
  const raw = (status || "").toLowerCase();
  if (!raw) return "—";
  if (raw === "waiting" || raw === "pending") return t("org_sessions", "status_waiting");
  if (raw === "in_progress" || raw === "running") return t("org_sessions", "status_in_progress");
  if (raw === "paused") return t("org_sessions", "status_paused");
  if (raw === "completed" || raw === "ended") return t("org_sessions", "status_completed");
  if (raw === "cancelled" || raw === "canceled") return t("org_sessions", "status_cancelled");
  return status || "—";
}

function renderQuestionBankNames(session: SessionDto): string {
  const qbList = (session as any).questionBanks as
    | { questionBankId: string; questionBankName?: string | null }[]
    | undefined;

  if (Array.isArray(qbList) && qbList.length > 0) {
    const names = qbList
      .map((qb) => qb.questionBankName)
      .filter((name): name is string => Boolean(name));

    if (names.length > 0) {
      return names.join(", ");
    }
  }

  if (session.questionBankName) {
    return session.questionBankName;
  }

  return "—";
}

export default function OrgSessionsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [isOwner, setIsOwner] = useState(false);
  
  // Tab 1: My sessions
  const [mySessions, setMySessions] = useState<SessionDto[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);

  // Tab 2: All org sessions (owner only)
  const [allSessions, setAllSessions] = useState<SessionDto[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);

  // Filters/Sort for Tab 2
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [order, setOrder] = useState<Order>("desc");
  const [filterHostId, setFilterHostId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterHasQB, setFilterHasQB] = useState("");
  const [hosts, setHosts] = useState<Map<string, string>>(new Map());

  // Delete & search
  const [sessionToDelete, setSessionToDelete] = useState<SessionDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load my sessions
  useEffect(() => {
    let alive = true;

    async function loadMySessions() {
      try {
        setMyLoading(true);
        setMyError(null);
        const data = await getMySessions(orgId);
        if (!alive) return;
        setMySessions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load my sessions", e);
        if (!alive) return;
        setMyError("Không tải được danh sách session. Vui lòng thử lại.");
      } finally {
        if (alive) setMyLoading(false);
      }
    }

    void loadMySessions();
    return () => {
      alive = false;
    };
  }, [orgId]);

  // Check owner and load all sessions if owner
  useEffect(() => {
    let alive = true;

    async function checkOwnerAndLoad() {
      try {
        const response = await getMyOrganizations();
        const currentOrg = response.organizations?.find((o: MyOrganizationDto) => o.orgId === orgId);
        
        if (!alive) return;

        const ownerStatus = currentOrg?.myRole === "Owner" || currentOrg?.myRole === "Admin";
        setIsOwner(ownerStatus);

        if (ownerStatus) {
          await loadAllSessions();
        }
      } catch (e) {
        console.error("Failed to check owner status", e);
        if (!alive) return;
        setIsOwner(false);
      }
    }

    void checkOwnerAndLoad();
    return () => {
      alive = false;
    };
  }, [orgId]);

  // Load all org sessions with filters/sort
  async function loadAllSessions() {
    try {
      setAllLoading(true);
      setAllError(null);
      
      const hasQB = filterHasQB === "" ? undefined : filterHasQB === "yes";
      const data = await getAllSessionsByOrganization(
        orgId,
        sortBy,
        order,
        filterHostId || undefined,
        filterStatus || undefined,
        hasQB
      );
      
      setAllSessions(Array.isArray(data) ? data : []);

      // Build hosts map
      const hostMap = new Map<string, string>();
      (data || []).forEach((session) => {
        if (session.hostUserId && session.hostUserName) {
          hostMap.set(session.hostUserId, session.hostUserName);
        }
      });
      setHosts(hostMap);
    } catch (e) {
      console.error("Failed to load all sessions", e);
      setAllError(t("org_sessions", "error_load_failed"));
    } finally {
      setAllLoading(false);
    }
  }

  // Reload all sessions when filters/sort change
  useEffect(() => {
    if (isOwner && activeTab === "all") {
      void loadAllSessions();
    }
  }, [sortBy, order, filterHostId, filterStatus, filterHasQB, isOwner, activeTab]);

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      setIsDeleting(true);
      await deleteSession(sessionToDelete.sessionId);
      setMySessions((prev) =>
        prev.filter((item) => item.sessionId !== sessionToDelete.sessionId)
      );
      setAllSessions((prev) =>
        prev.filter((item) => item.sessionId !== sessionToDelete.sessionId)
      );
      setSessionToDelete(null);
    } catch (err) {
      console.error("Delete session failed", err);
      alert(t("org_sessions", "delete_error_msg"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearch = async () => {
    const code = searchCode.trim();
    if (!code) {
      setSearchError(t("org_sessions", "search_error_empty"));
      return;
    }
    try {
      setSearchError(null);
      setSearching(true);
      const session = await getSessionByCode(code);
      router.push(`/profile/organizations/${orgId}/sessions/${session.sessionId}`);
    } catch (err) {
      console.error("Search session by code failed", err);
      setSearchError(t("org_sessions", "search_error_not_found"));
    } finally {
      setSearching(false);
    }
  };

  const displaySessions = activeTab === "my" ? mySessions : allSessions;
  const isLoading = activeTab === "my" ? myLoading : allLoading;
  const error = activeTab === "my" ? myError : allError;

  return (
    <div className={`min-w-0 px-4 pb-10 ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/profile/organizations/${orgId}`)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${themeClasses.button}`}
            >
              {t("org_sessions", "header_back")}
            </button>
            <div>
              <h1 className={`text-2xl font-semibold sm:text-3xl ${isDark ? "text-zinc-100" : "text-emerald-700"}`}>
                {t("org_sessions", "header_title")}
              </h1>
            </div>
          </div>

          <button
            onClick={() => router.push(`/profile/organizations/${orgId}/sessions/create`)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            {t("org_sessions", "header_create_btn")}
          </button>
        </div>

        {/* Search bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder={t("org_sessions", "search_placeholder")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {searching ? t("org_sessions", "search_searching") : t("org_sessions", "search_button")}
          </button>
          {searchError && <p className="text-xs text-red-500">{searchError}</p>}
        </div>

        {/* Tabs */}
        {isOwner && (
          <div className="mb-4">
            <div className={`inline-flex rounded-full p-1 text-xs ${isDark ? "bg-zinc-900" : "bg-zinc-100"}`}>
              {(["my", "all"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                    activeTab === tab
                      ? isDark
                        ? "bg-zinc-800 text-emerald-300 shadow-sm"
                        : "bg-white text-emerald-600 shadow-sm"
                      : isDark
                      ? "text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300"
                      : "text-zinc-600 hover:bg-white hover:text-emerald-600"
                  }`}
                >
                  {tab === "my" ? t("org_sessions", "tab_my") : t("org_sessions", "tab_all")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters for Tab 2 (All sessions) */}
        {isOwner && activeTab === "all" && (
          <div className={`rounded-lg border p-4 ${themeClasses.panel}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Sort By */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${themeClasses.textMuted}`}>
                  {t("org_sessions", "filter_sort_by_label")}
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className={`w-full rounded border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                >
                  <option value="createdAt">{t("org_sessions", "filter_sort_by_date")}</option>
                  <option value="name">{t("org_sessions", "filter_sort_by_name")}</option>
                  <option value="status">{t("org_sessions", "filter_sort_by_status")}</option>
                </select>
              </div>

              {/* Order */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${themeClasses.textMuted}`}>
                  {t("org_sessions", "filter_order_label")}
                </label>
                <select
                  value={order}
                  onChange={(e) => setOrder(e.target.value as Order)}
                  className={`w-full rounded border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                >
                  <option value="desc">{t("org_sessions", "filter_order_newest")}</option>
                  <option value="asc">{t("org_sessions", "filter_order_oldest")}</option>
                </select>
              </div>

              {/* Filter by Host */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${themeClasses.textMuted}`}>
                  {t("org_sessions", "filter_host_label")}
                </label>
                <select
                  value={filterHostId}
                  onChange={(e) => setFilterHostId(e.target.value)}
                  className={`w-full rounded border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                >
                  <option value="">{t("org_sessions", "filter_host_all")}</option>
                  {Array.from(hosts.entries()).map(([userId, name]) => (
                    <option key={userId} value={userId}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Status */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${themeClasses.textMuted}`}>
                  {t("org_sessions", "filter_status_label")}
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`w-full rounded border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                >
                  <option value="">{t("org_sessions", "filter_status_all")}</option>
                  <option value="WAITING">{t("org_sessions", "filter_status_waiting")}</option>
                  <option value="IN_PROGRESS">{t("org_sessions", "filter_status_in_progress")}</option>
                  <option value="PAUSED">{t("org_sessions", "filter_status_paused")}</option>
                  <option value="COMPLETED">{t("org_sessions", "filter_status_completed")}</option>
                  <option value="CANCELLED">{t("org_sessions", "filter_status_cancelled")}</option>
                </select>
              </div>

              {/* Filter by Question Banks */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${themeClasses.textMuted}`}>
                  {t("org_sessions", "filter_qb_label")}
                </label>
                <select
                  value={filterHasQB}
                  onChange={(e) => setFilterHasQB(e.target.value)}
                  className={`w-full rounded border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                >
                  <option value="">{t("org_sessions", "filter_qb_all")}</option>
                  <option value="yes">{t("org_sessions", "filter_qb_with")}</option>
                  <option value="no">{t("org_sessions", "filter_qb_without")}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading && (
          <div className={`min-h-[40vh] flex items-center justify-center text-sm ${themeClasses.textMuted}`}>
            {t("org_sessions", "loading_text")}
          </div>
        )}

        {!isLoading && error && (
          <div className="min-h-[40vh] flex items-center justify-center">
            <p className="text-sm text-red-500 dark:text-red-300">{error}</p>
          </div>
        )}

        {!isLoading && !error && displaySessions.length === 0 && (
          <EmptyState
            illustration="teaching"
            title={activeTab === "my" ? t("org_sessions", "empty_my_title") : t("org_sessions", "empty_all_title")}
            description={
              activeTab === "my"
                ? t("org_sessions", "empty_my_desc")
                : t("org_sessions", "empty_all_desc")
            }
            action={
              activeTab === "my"
                ? {
                    label: t("org_sessions", "empty_action_btn"),
                    onClick: () =>
                      router.push(`/profile/organizations/${orgId}/sessions/create`),
                  }
                : undefined
            }
          />
        )}

        {!isLoading && !error && displaySessions.length > 0 && (
          <div className={`rounded-2xl border shadow-sm ${themeClasses.panel}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={`${isDark ? "bg-zinc-900/70" : "bg-zinc-50/70"} ${themeClasses.tableHeader}`}>
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_code")}</th>
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_name")}</th>
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_map")}</th>
                    {activeTab === "all" && (
                      <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_host")}</th>
                    )}
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_status")}</th>
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_participants")}</th>
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_created")}</th>
                    <th className="px-4 py-2 font-semibold text-left">{t("org_sessions", "th_question_banks")}</th>
                    <th className="px-4 py-2 font-semibold text-right">{t("org_sessions", "th_actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {displaySessions.map((session) => (
                    <tr
                      key={session.sessionId}
                      className={`border-t cursor-pointer hover:bg-opacity-50 ${themeClasses.tableBorder}`}
                      onClick={() =>
                        router.push(
                          `/profile/organizations/${orgId}/sessions/${session.sessionId}`
                        )
                      }
                    >
                      <td className={`px-4 py-2 font-mono ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>
                        {session.sessionCode}
                      </td>
                      <td className="px-4 py-2">{session.sessionName || "—"}</td>
                      <td className="px-4 py-2">{session.mapName || "—"}</td>
                      {activeTab === "all" && (
                        <td className="px-4 py-2 text-sm">{session.hostUserName || "—"}</td>
                      )}
                      <td className="px-4 py-2 text-sm">{normalizeStatusEnum(session.status, t)}</td>
                      <td className="px-4 py-2">{session.totalParticipants ?? 0}</td>
                      <td className="px-4 py-2 text-xs">{formatDate(session.createdAt)}</td>
                      <td className="px-4 py-2 text-sm">{renderQuestionBankNames(session)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          className={`px-2 py-1 text-xs rounded-lg border ${
                            isDark
                              ? "border-red-400 text-red-300 hover:bg-red-500/10"
                              : "border-red-500 text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {t("org_sessions", "btn_delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Delete Dialog */}
        {sessionToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className={`w-full max-w-md rounded-2xl p-6 shadow-xl ${themeClasses.panel}`}>
              <h2 className={`text-lg font-semibold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                {t("org_sessions", "delete_title")}
              </h2>
              <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                {t("org_sessions", "delete_confirm_msg")}{" "}
                <span className="font-semibold">{sessionToDelete.sessionName || "session này"}</span>?
                <span className="text-red-500 font-medium block mt-2">{t("org_sessions", "delete_warning")}</span>
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => !isDeleting && setSessionToDelete(null)}
                  disabled={isDeleting}
                  className={`px-4 py-2 text-sm rounded-lg border ${themeClasses.button}`}
                >
                  {t("org_sessions", "delete_cancel_btn")}
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
                >
                  {isDeleting ? t("org_sessions", "delete_deleting_btn") : t("org_sessions", "delete_confirm_btn")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
