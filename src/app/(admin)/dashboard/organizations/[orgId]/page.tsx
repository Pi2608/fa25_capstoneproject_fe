"use client";

import { JSX, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTheme } from "../../../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { adminGetOrganizationById } from "@/lib/admin-api";

type Raw = Record<string, unknown>;

type OrganizationDetails = {
  orgId: string;
  name: string;
  description: string;
  status: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string | null;
  totalMembers: number;
  totalActiveMemberships: number;
  totalRevenue: number;
  primaryPlanName: string;
};

function pickString(obj: Raw, keys: string[], d = ""): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return d;
}

function pickNumber(obj: Raw, keys: string[], d = 0): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return d;
}

function normalizeOrgDetails(raw: Raw | null | undefined): OrganizationDetails | null {
  if (!raw || typeof raw !== "object") return null;

  const orgId = pickString(raw, ["orgId", "OrgId", "id", "Id"]);
  const name = pickString(raw, ["name", "Name"]);
  const description = pickString(raw, ["description", "Description"]);
  const status = pickString(raw, ["status", "Status"]);
  const ownerUserId = pickString(raw, ["ownerUserId", "OwnerUserId"]);
  const ownerName = pickString(raw, ["ownerName", "OwnerName"]);
  const ownerEmail = pickString(raw, ["ownerEmail", "OwnerEmail"]);
  const createdAt = pickString(raw, ["createdAt", "CreatedAt"]);
  const updatedAt = pickString(raw, ["updatedAt", "UpdatedAt"], "") || null;
  const totalMembers = pickNumber(raw, ["totalMembers", "TotalMembers"], 0);
  const totalActiveMemberships = pickNumber(
    raw,
    ["totalActiveMemberships", "TotalActiveMemberships"],
    0
  );
  const totalRevenue = pickNumber(raw, ["totalRevenue", "TotalRevenue"], 0);
  const primaryPlanName = pickString(raw, ["primaryPlanName", "PrimaryPlanName"]);

  return {
    orgId,
    name,
    description,
    status,
    ownerUserId,
    ownerName,
    ownerEmail,
    createdAt,
    updatedAt,
    totalMembers,
    totalActiveMemberships,
    totalRevenue,
    primaryPlanName,
  };
}

function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.replace("T", " ").slice(0, 16);
  return d.toLocaleString("vi-VN");
}

export default function AdminOrgDetailPage(): JSX.Element {
  const routeParams = useParams<{ orgId: string }>();
  const orgId = routeParams?.orgId ?? "";

  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);

  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    if (!orgId) {
      setLoading(false);
      setError("Thiếu orgId trên URL");
      return () => {
        mounted = false;
      };
    }

    adminGetOrganizationById<Raw>(orgId)
      .then((res) => {
        if (!mounted) return;
        const normalized = normalizeOrgDetails(res);
        setOrg(normalized);
      })
      .catch((err) => {
        console.error("Failed to load organization details:", err);
        if (mounted) setError("Không thể tải thông tin tổ chức");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [orgId]);

  const displayName = org?.name || (loading ? "Đang tải..." : "Tổ chức không xác định");

  const initials =
    (displayName || "?")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="grid gap-5">
      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <div
              className={`
                text-sm font-medium
                flex flex-wrap items-center gap-1
                text-emerald-700 dark:text-emerald-300
              `}
            >
              <Link
                href="/dashboard"
                className="hover:underline hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                Bảng điều khiển
              </Link>
              <span>/</span>
              <Link
                href="/dashboard#top-organizations"
                className="hover:underline hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                Tổ chức nổi bật
              </Link>
              <span>/</span>
              <span className="font-semibold">{displayName}</span>
            </div>
            <h1 className="m-0 text-xl font-extrabold">{displayName}</h1>
          </div>
        </div>
      </section>

      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm`}>
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div
            className={`flex items-center justify-center rounded-xl w-16 h-16 md:w-20 md:h-20 text-xl font-bold ${
              isDark ? "bg-emerald-900 text-emerald-100" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {initials}
          </div>

          <div className="flex-1 grid gap-1">
            <div className="text-lg font-extrabold">{displayName}</div>
            <div className={`text-sm ${theme.textMuted}`}>
              {org?.description || "Chưa có mô tả cho tổ chức này"}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {org?.primaryPlanName && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    isDark
                      ? "border-emerald-700 text-emerald-300"
                      : "border-emerald-500 text-emerald-700"
                  }`}
                >
                  Gói: {org.primaryPlanName}
                </span>
              )}
              {org?.status && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    isDark
                      ? "border-zinc-600 text-zinc-300"
                      : "border-zinc-300 text-zinc-700"
                  }`}
                >
                  Trạng thái: {org.status}
                </span>
              )}
            </div>
            <div className={`text-sm ${theme.textMuted} mt-1`}>
              {org?.ownerName && (
                <>
                  Chủ sở hữu:{" "}
                  <span className="font-medium">
                    {org.ownerName}
                    {org.ownerEmail ? ` (${org.ownerEmail})` : ""}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-1 text-sm min-w-[220px]">
            <div className={`flex justify-between ${theme.textMuted}`}>
              <span>Ngày tạo</span>
              <span className="font-medium">
                {org?.createdAt ? formatDateTime(org.createdAt) : "—"}
              </span>
            </div>
            <div className={`flex justify-between ${theme.textMuted}`}>
              <span>Cập nhật gần nhất</span>
              <span className="font-medium">
                {org?.updatedAt ? formatDateTime(org.updatedAt) : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-1`}>
          <div className={`text-xs ${theme.textMuted}`}>Tổng số thành viên</div>
          <div className="text-2xl font-extrabold">
            {loading ? "…" : (org?.totalMembers ?? 0).toLocaleString()}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-1`}>
          <div className={`text-xs ${theme.textMuted}`}>Thành viên đang hoạt động</div>
          <div className="text-2xl font-extrabold">
            {loading ? "…" : (org?.totalActiveMemberships ?? 0).toLocaleString()}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-1`}>
          <div className={`text-xs ${theme.textMuted}`}>Tổng doanh thu</div>
          <div className="text-2xl font-extrabold">
            {loading ? "…" : `${formatMoney(org?.totalRevenue ?? 0)} đ`}
          </div>
        </div>
      </section>

      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <h2 className="m-0 text-base font-extrabold">Chi tiết tổ chức</h2>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className={`overflow-hidden border ${theme.tableBorder} rounded-lg mt-1`}>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Tên tổ chức</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{org?.name || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Mô tả</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {org?.description || "Chưa có mô tả"}
                </td>
              </tr>
              {/* <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Chủ sở hữu (ID)
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{org?.ownerUserId || "—"}</td>
              </tr> */}
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Chủ sở hữu (tên)
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{org?.ownerName || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Email chủ sở hữu
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{org?.ownerEmail || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Trạng thái</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{org?.status || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Gói hiện tại</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {org?.primaryPlanName || "Không có"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Tổng số thành viên
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {org?.totalMembers != null ? org.totalMembers.toLocaleString() : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Thành viên đang hoạt động
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {org?.totalActiveMemberships != null
                    ? org.totalActiveMemberships.toLocaleString()
                    : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Tổng doanh thu</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {org ? `${formatMoney(org.totalRevenue)} đ` : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Ngày tạo</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {org?.createdAt ? formatDateTime(org.createdAt) : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 ${theme.tableHeader} font-semibold`}>Cập nhật gần nhất</td>
                <td className={`p-3 ${theme.tableCell}`}>
                  {org?.updatedAt ? formatDateTime(org.updatedAt) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
