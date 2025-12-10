"use client";

import { JSX, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTheme } from "../../../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { adminGetUserById } from "@/lib/admin-api";

type Raw = Record<string, unknown>;

type UserDetails = {
  userId: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
  role: string;
  createdAt: string;
  lastLoginAt: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  totalOrganizations: number;
  totalActiveMemberships: number;
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

function pickBool(obj: Raw, keys: string[], d = false): boolean {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (v.toLowerCase() === "true") return true;
      if (v.toLowerCase() === "false") return false;
    }
    if (typeof v === "number") {
      if (v === 1) return true;
      if (v === 0) return false;
    }
  }
  return d;
}

function normalizeUserDetails(raw: Raw | null | undefined): UserDetails | null {
  if (!raw || typeof raw !== "object") return null;

  const userId = pickString(raw, ["userId", "UserId", "id", "Id"]);
  const userName = pickString(raw, ["userName", "UserName", "username", "displayName"]);
  const email = pickString(raw, ["email", "Email"]);
  const firstName = pickString(raw, ["firstName", "FirstName"]);
  const lastName = pickString(raw, ["lastName", "LastName"]);
  const phone = pickString(raw, ["phone", "Phone", "phoneNumber", "PhoneNumber"]);
  const status = pickString(raw, ["status", "Status"]);
  const role = pickString(raw, ["role", "Role"]);
  const createdAt = pickString(raw, ["createdAt", "CreatedAt"]);
  const lastLoginAt = pickString(raw, ["lastLoginAt", "LastLoginAt", "lastLogin", "LastLogin"]);

  const isEmailVerified = pickBool(raw, ["isEmailVerified", "IsEmailVerified"]);
  const isPhoneVerified = pickBool(raw, ["isPhoneVerified", "IsPhoneVerified"]);
  const totalOrganizations = pickNumber(raw, ["totalOrganizations", "TotalOrganizations"], 0);
  const totalActiveMemberships = pickNumber(
    raw,
    ["totalActiveMemberships", "TotalActiveMemberships"],
    0
  );

  return {
    userId,
    userName,
    email,
    firstName,
    lastName,
    phone,
    status,
    role,
    createdAt,
    lastLoginAt,
    isEmailVerified,
    isPhoneVerified,
    totalOrganizations,
    totalActiveMemberships,
  };
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.replace("T", " ").slice(0, 16);
  return d.toLocaleString("vi-VN");
}

function formatBool(v: boolean | null | undefined): string {
  if (v === true) return "Đã xác thực";
  if (v === false) return "Chưa xác thực";
  return "—";
}

export default function AdminUserDetailPage(): JSX.Element {
  const routeParams = useParams<{ userId: string }>();
  const userId = routeParams?.userId ?? "";

  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    if (!userId) {
      setLoading(false);
      setError("Thiếu userId trên URL");
      return () => {
        mounted = false;
      };
    }

    adminGetUserById<Raw>(userId)
      .then((res) => {
        if (!mounted) return;
        const normalized = normalizeUserDetails(res);
        setUser(normalized);
      })
      .catch((err) => {
        console.error("Failed to load user details:", err);
        if (mounted) setError("Không thể tải thông tin người dùng");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  const displayName =
    user?.userName ||
    (user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : "") ||
    user?.email ||
    (loading ? "Đang tải..." : "Người dùng không xác định");

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
                href="/dashboard#top-accounts"
                className="hover:underline hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                Tài khoản nổi bật
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
            className={`flex items-center justify-center rounded-full w-16 h-16 md:w-20 md:h-20 text-xl font-bold ${
              isDark ? "bg-emerald-900 text-emerald-100" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {initials}
          </div>

          <div className="flex-1 grid gap-1">
            <div className="text-lg font-extrabold">{displayName}</div>
            <div className={`text-sm ${theme.textMuted}`}>
              {user?.email || (loading ? "…" : "Không có email")}
            </div>
            <div className={`text-sm ${theme.textMuted}`}>
              {user?.phone ? `Số điện thoại: ${user.phone}` : "Không có số điện thoại"}
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              {user?.role && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    isDark
                      ? "border-emerald-700 text-emerald-300"
                      : "border-emerald-500 text-emerald-700"
                  }`}
                >
                  {user.role}
                </span>
              )}
              {user?.status && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    isDark
                      ? "border-zinc-600 text-zinc-300"
                      : "border-zinc-300 text-zinc-700"
                  }`}
                >
                  {user.status}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-1 text-sm min-w-[220px]">
            <div className={`flex justify-between ${theme.textMuted}`}>
              <span>Ngày tạo</span>
              <span className="font-medium">
                {user?.createdAt ? formatDateTime(user.createdAt) : "—"}
              </span>
            </div>
            <div className={`flex justify-between ${theme.textMuted}`}>
              <span>Đăng nhập gần nhất</span>
              <span className="font-medium">
                {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-1`}>
          <div className={`text-xs ${theme.textMuted}`}>Tổng số tổ chức</div>
          <div className="text-2xl font-extrabold">
            {loading ? "…" : (user?.totalOrganizations ?? 0).toLocaleString()}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-1`}>
          <div className={`text-xs ${theme.textMuted}`}>Thành viên đang hoạt động</div>
          <div className="text-2xl font-extrabold">
            {loading ? "…" : (user?.totalActiveMemberships ?? 0).toLocaleString()}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-1`}>
          <div className={`text-xs ${theme.textMuted}`}>Trạng thái xác thực</div>
          <div className="text-sm font-medium flex flex-col gap-1">
            <span>Email: {formatBool(user?.isEmailVerified)}</span>
            <span>Điện thoại: {formatBool(user?.isPhoneVerified)}</span>
          </div>
        </div>
      </section>

      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <h2 className="m-0 text-base font-extrabold">Chi tiết tài khoản</h2>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className={`overflow-hidden border ${theme.tableBorder} rounded-lg mt-1`}>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>ID người dùng</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.userId || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Họ</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.lastName || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Tên</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.firstName || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Tên hiển thị</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.userName || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Email</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.email || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Số điện thoại</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.phone || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Vai trò</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.role || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Trạng thái</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>{user?.status || "—"}</td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Email đã xác thực
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {formatBool(user?.isEmailVerified)}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Số điện thoại đã xác thực
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {formatBool(user?.isPhoneVerified)}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>Ngày tạo</td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {user?.createdAt ? formatDateTime(user.createdAt) : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Đăng nhập gần nhất
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 border-b ${theme.tableHeader} font-semibold`}>
                  Tổng số tổ chức
                </td>
                <td className={`p-3 border-b ${theme.tableCell}`}>
                  {user?.totalOrganizations != null
                    ? user.totalOrganizations.toLocaleString()
                    : "—"}
                </td>
              </tr>
              <tr>
                <td className={`p-3 ${theme.tableHeader} font-semibold`}>
                  Thành viên đang hoạt động
                </td>
                <td className={`p-3 ${theme.tableCell}`}>
                  {user?.totalActiveMemberships != null
                    ? user.totalActiveMemberships.toLocaleString()
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
