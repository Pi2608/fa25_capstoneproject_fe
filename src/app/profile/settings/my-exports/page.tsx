"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import {
  getMyOrganizations,
  MyOrganizationDto,
} from "@/lib/api-organizations";
import {
  getOrganizationExports,
  type ExportResponse,
} from "@/lib/api-maps";
import { useI18n } from "@/i18n/I18nProvider";

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function getStatusBadgeClass(status: string, isDark: boolean): string {
  const statusLower = status.toLowerCase();
  if (statusLower === "pendingapproval" || statusLower === "pending") {
    return isDark
      ? "bg-yellow-500/20 text-yellow-300 ring-yellow-400/30"
      : "bg-yellow-100 text-yellow-800 ring-yellow-200";
  }
  if (statusLower === "processing") {
    return isDark
      ? "bg-blue-500/20 text-blue-300 ring-blue-400/30"
      : "bg-blue-100 text-blue-800 ring-blue-200";
  }
  if (statusLower === "approved") {
    return isDark
      ? "bg-green-500/20 text-green-300 ring-green-400/30"
      : "bg-green-100 text-green-800 ring-green-200";
  }
  if (statusLower === "rejected" || statusLower === "failed") {
    return isDark
      ? "bg-red-500/20 text-red-300 ring-red-400/30"
      : "bg-red-100 text-red-800 ring-red-200";
  }
  return isDark
    ? "bg-gray-500/20 text-gray-300 ring-gray-400/30"
    : "bg-gray-100 text-gray-800 ring-gray-200";
}

function isOrgList(u: unknown): u is MyOrganizationDto[] {
  return Array.isArray(u);
}

function isOrgEnvelope(u: unknown): u is { organizations: MyOrganizationDto[] } {
  if (typeof u !== "object" || u === null) return false;
  const v = (u as { organizations?: unknown }).organizations;
  return Array.isArray(v);
}

function getStatusLabel(status: string, t: any): string {
  const s = status.toLowerCase();
  if (s === "pendingapproval" || s === "pending") {
    return t("my_exports", "status_pending");
  }
  if (s === "processing") {
    return t("my_exports", "status_processing");
  }
  if (s === "approved") {
    return t("my_exports", "status_approved");
  }
  if (s === "rejected") {
    return t("my_exports", "status_rejected");
  }
  if (s === "failed") {
    return t("my_exports", "status_failed");
  }
  return status;
}

export default function MyExportsPage() {
  const { isLoggedIn } = useAuthStatus();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const { t } = useI18n();

  const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
  const [orgError, setOrgError] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [exports, setExports] = useState<ExportResponse[]>([]);
  const [exportsError, setExportsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      if (!isLoggedIn) return;

      try {
        const orgRes = await getMyOrganizations();
        if (cancelled) return;

        const items: MyOrganizationDto[] = isOrgList(orgRes)
          ? orgRes
          : isOrgEnvelope(orgRes)
          ? orgRes.organizations
          : [];

        setOrgs(items);
        setOrgError(false);

        if (items.length > 0) {
          setSelectedOrgId((prev) => prev ?? items[0].orgId);
        }
      } catch {
        if (cancelled) return;
        setOrgError(true);
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const loadExports = useCallback(async (orgId: string) => {
    setLoading(true);
    setExportsError(false);
    try {
      const res = await getOrganizationExports(orgId);
      const exportsArray = res.exports ?? [];
      setExports(exportsArray);
    } catch (error) {
      setExports([]);
      setExportsError(true);
      console.error("Failed to load exports:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      void loadExports(selectedOrgId);
    } else {
      setExports([]);
    }
  }, [selectedOrgId, loadExports]);

  const approvedCount = useMemo(
    () => exports.filter((e) => e.status === "Approved").length,
    [exports]
  );

  const pendingCount = useMemo(
    () =>
      exports.filter(
        (e) => e.status === "PendingApproval" || e.status === "Pending"
      ).length,
    [exports]
  );

  return (
    <div className="p-4">
      {/* Header + badges */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          {t("my_exports", "header_title")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30">
            {t("my_exports", "badge_total", { count: exports.length })}
          </span>
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-800 ring-1 ring-green-300 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/30">
            {t("my_exports", "badge_approved", { count: approvedCount })}
          </span>
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-400/30">
            {t("my_exports", "badge_pending", { count: pendingCount })}
          </span>
        </div>
      </div>

      {/* Org selector */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("my_exports", "label_org")}
        </label>
        <select
          className={`rounded-md border px-2 py-1 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.select} ${
            isDark ? "dark:hover:bg-zinc-800" : ""
          }`}
          value={selectedOrgId ?? ""}
          onChange={(e) => setSelectedOrgId(e.target.value || null)}
        >
          {orgs.map((o) => (
            <option key={o.orgId} value={o.orgId}>
              {o.orgName}
            </option>
          ))}
        </select>
        {orgError && (
          <span className="rounded px-2 py-1 text-xs text-red-700 ring-1 ring-red-200 bg-red-50 dark:text-red-200 dark:ring-red-400/40 dark:bg-red-900/30">
            {t("my_exports", "error_org_load")}
          </span>
        )}
      </div>

      {/* Error exports */}
      {exportsError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30">
          {t("my_exports", "error_exports_load")}
        </div>
      )}

      {/* Table */}
      <div
        className={`overflow-x-auto rounded-lg ring-1 shadow-sm ${
          isDark ? "ring-white/10" : "ring-gray-200"
        }`}
      >
        <table
          className={`min-w-full ${
            isDark ? "bg-zinc-950" : "bg-white"
          }`}
        >
          <thead>
            <tr className={themeClasses.tableHeader}>
              <th className="px-3 py-2 text-sm font-medium text-left">
                {t("my_exports", "table_id")}
              </th>
              <th className="px-3 py-2 text-sm font-medium text-left">
                {t("my_exports", "table_map_name")}
              </th>
              <th className="px-3 py-2 text-sm font-medium text-left">
                {t("my_exports", "table_format")}
              </th>
              <th className="px-3 py-2 text-sm font-medium text-left">
                {t("my_exports", "table_status")}
              </th>
              <th className="px-3 py-2 text-sm font-medium text-left">
                {t("my_exports", "table_created_at")}
              </th>
              <th className="px-3 py-2 text-sm font-medium text-left">
                {t("my_exports", "table_actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className={`px-3 py-6 text-center text-sm ${themeClasses.textMuted}`}
                >
                  {t("my_exports", "loading_text")}
                </td>
              </tr>
            )}
            {!loading && exports.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className={`px-3 py-6 text-center text-sm ${themeClasses.textMuted}`}
                >
                  {t("my_exports", "empty_text")}
                </td>
              </tr>
            )}
            {!loading &&
              exports.map((exp) => (
                <tr
                  key={exp.exportId}
                  className={`border-t ${themeClasses.tableCell} ${
                    isDark ? "hover:bg-white/5" : "hover:bg-gray-50"
                  }`}
                >
                  <td
                    className={`px-3 py-3 text-sm font-mono ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    #{exp.exportId}
                  </td>
                  <td className="px-3 py-3">
                    <div
                      className={`font-medium ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {exp.mapName ||
                        t("my_exports", "mapname_untitled")}
                    </div>
                    <div
                      className={`text-xs ${themeClasses.textMuted}`}
                    >
                      {exp.userName || exp.userId}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <span className="uppercase font-mono font-bold text-xs">
                      {exp.format}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${getStatusBadgeClass(
                        exp.status,
                        isDark
                      )}`}
                    >
                      {getStatusLabel(exp.status, t)}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-3 text-sm ${themeClasses.textMuted}`}
                  >
                    {formatDate(exp.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {exp.canDownload && exp.fileUrl ? (
                      <a
                        href={exp.fileUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {t("my_exports", "download_btn")}
                      </a>
                    ) : (
                      <span
                        className={`text-xs ${themeClasses.textMuted}`}
                      >
                        {exp.status === "Rejected"
                          ? t("my_exports", "download_rejected")
                          : t("my_exports", "download_not_ready")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
