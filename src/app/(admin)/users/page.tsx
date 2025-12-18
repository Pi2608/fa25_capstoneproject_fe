"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adminGetUsers,
  adminGetUserById,
  adminUpdateUserStatus,
  adminDeleteUser,
} from "@/lib/admin-api";
import { useTheme } from "../layout";
import { useI18n } from "@/i18n/I18nProvider";

type Role = "Admin" | "RegisteredUser" | "Member" | "User" | string;
type BackendStatus =
  | "Active"
  | "Suspended"
  | "Inactive"
  | "Pending"
  | "PendingVerification"
  | string;

type User = {
  userId: string;
  userName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: Role;
  status: BackendStatus;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  totalOrganizations?: number;
  totalActiveMemberships?: number;
};

const PAGE_SIZE = 10;

function viStatus(st: BackendStatus, t: (ns: string, key: string) => string) {
  if (st === "Suspended") return t("admin", "status_suspended");
  if (st === "Inactive") return t("admin", "status_inactive");
  if (st === "PendingVerification" || st === "Pending") return t("admin", "status_pending");
  return t("admin", "status_active");
}

function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function timeAgoVi(iso?: string | null, t?: (ns: string, key: string, params?: Record<string, any>) => string) {
  if (!iso) return "–";
  if (iso === "0001-01-01T00:00:00" || iso.startsWith("0001-01-01")) {
    return t ? t("admin", "time_never_logged_in") : "Chưa đăng nhập";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  if (d.getTime() < 0) {
    return t ? t("admin", "time_never_logged_in") : "Chưa đăng nhập";
  }

  const diff = new Date().getTime() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t ? t("admin", "time_just_now") : "vừa xong";
  if (m < 60) return t ? t("admin", "time_minutes_ago", { count: m }) : `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return t ? t("admin", "time_hours_ago", { count: h }) : `${h} giờ trước`;
  const days = Math.floor(h / 24);
  return t ? t("admin", "time_days_ago", { count: days }) : `${days} ngày trước`;
}

export default function AccountsPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [rows, setRows] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q);

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const [draftUserId, setDraftUserId] = useState<string | null>(null);
  const [draftUserName, setDraftUserName] = useState<string>("");
  const [draftCurrentStatus, setDraftCurrentStatus] = useState<BackendStatus>("Active");
  const [draftNextStatus, setDraftNextStatus] = useState<BackendStatus>("Active");
  const [draftReason, setDraftReason] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);

  const serverStatus: BackendStatus | undefined =
    statusFilter === "all"
      ? undefined
      : statusFilter === "suspended"
      ? "Suspended"
      : statusFilter === "inactive"
      ? "Inactive"
      : statusFilter === "pending"
      ? "PendingVerification"
      : "Active";

  async function loadPageData(
    newPage: number,
    keyword: string,
    statusB?: BackendStatus
  ) {
    setLoading(true);
    setErr(null);
    try {
      const data = await adminGetUsers<User>({
        page: newPage,
        pageSize: PAGE_SIZE,
        search: keyword.trim() || undefined,
        status: statusB,
      });

      const list = Array.isArray(data.items) ? data.items : [];
      const tp = Math.max(1, Number(data.totalPages ?? 1));

      setRows(list);
      setTotalPages(tp);

      if (newPage > (data.totalPages ?? 1)) {
        setPage(1);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Không thể tải danh sách người dùng.";
      setErr(message);
      setRows([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData(page, debouncedQ, serverStatus);
  }, [page, debouncedQ, serverStatus]);

  const filtered = useMemo(() => {
    if (roleFilter === "all") return rows;
    return rows.filter((u) => u.role === roleFilter);
  }, [rows, roleFilter]);

  const refreshCurrentPage = async () => {
    await loadPageData(page, debouncedQ, serverStatus);
  };

  const openEditStatusModal = (u: User) => {
    const toggledStatus: BackendStatus =
      u.status === "Suspended" ||
      u.status === "Pending" ||
      u.status === "PendingVerification"
        ? "Active"
        : "Suspended";

    setDraftUserId(u.userId);
    setDraftUserName(
      u.userName ||
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        ""
    );
    setDraftCurrentStatus(u.status);
    setDraftNextStatus(toggledStatus);
    setDraftReason("");
  };

  const closeEditStatusModal = () => {
    if (submitting) return;
    setDraftUserId(null);
    setDraftUserName("");
    setDraftCurrentStatus("Active");
    setDraftNextStatus("Active");
    setDraftReason("");
  };

  const submitUpdateStatus = async () => {
    if (!draftUserId) return;
    if (!draftReason.trim()) {
      alert("Vui lòng nhập lý do.");
      return;
    }

    setSubmitting(true);

    const prevStatus = draftCurrentStatus;
    const newStatus = draftNextStatus;
    const id = draftUserId;
    const reasonText = draftReason.trim();

    setRows((arr) =>
      arr.map((x) => (x.userId === id ? { ...x, status: newStatus } : x))
    );

    try {
      await adminUpdateUserStatus(id, {
        userId: id,
        status: newStatus,
        reason: reasonText,
      });
      closeEditStatusModal();
    } catch (e) {
      setRows((arr) =>
        arr.map((x) => (x.userId === id ? { ...x, status: prevStatus } : x))
      );
      alert(
        e instanceof Error
          ? e.message
          : "Không thể cập nhật trạng thái tài khoản."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openView = async (userId: string) => {
    setViewUserId(userId);
    setViewUser(null);
    setViewLoading(true);
    try {
      const detail = await adminGetUserById<User>(userId);
      setViewUser(detail as User);
    } catch {
      setViewUser(null);
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    if (viewLoading) return;
    setViewUserId(null);
    setViewUser(null);
  };

  const askDelete = (userId: string) => {
    setDeleteErr(null);
    setPendingDeleteId(userId);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setPendingDeleteId(null);
    setDeleteErr(null);
  };

  const doDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      setDeleting(true);
      setDeleteErr(null);
      await adminDeleteUser(pendingDeleteId);
      const deletedId = pendingDeleteId;
      setPendingDeleteId(null);
      setRows((curr) => curr.filter((u) => u.userId !== deletedId));
      await refreshCurrentPage();
    } catch (e) {
      setDeleteErr(
        e instanceof Error
          ? e.message
          : "Không thể xóa người dùng. Tài khoản có thể đang được sử dụng ở nơi khác."
      );
    } finally {
      setDeleting(false);
    }
  };

  const prevPage = () => setPage((p) => Math.max(1, p - 1));
  const nextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="grid gap-5">
      <section className={`${isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Quản lý tài khoản</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 min-w-[160px] ${
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              }`}
              placeholder="Tìm theo tên hoặc email…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              aria-label="Tìm kiếm người dùng"
            />
            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              }`}
              value={roleFilter}
              onChange={(e) => {
                setPage(1);
                setRoleFilter(e.target.value);
              }}
              aria-label="Filter by role"
            >
              <option value="all">{t("admin", "all_roles")}</option>
              <option value="Admin">Admin</option>
              <option value="Member">Member</option>
              <option value="User">User</option>
            </select>
            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              }`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">{t("admin", "all_statuses")}</option>
              <option value="active">{t("admin", "status_active")}</option>
              <option value="suspended">{t("admin", "status_suspended")}</option>
              <option value="inactive">{t("admin", "status_inactive")}</option>
              <option value="pending">{t("admin", "status_pending")}</option>
            </select>
          </div>
        </div>

        <div className={`overflow-auto border rounded-lg mt-2 ${
          isDark ? "border-zinc-800" : "border-gray-200"
        }`}>
          {err ? (
            <div className="p-4 text-center text-red-500 font-semibold text-sm">{err}</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Họ tên</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Email</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Vai trò</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Trạng thái</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}></th>
                </tr>
              </thead>
              <tbody>
                {loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`p-4 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}>
                      Đang tải…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`p-4 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}>
                      Không tìm thấy tài nguyên.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.userId}>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        {u.userName ||
                          [u.firstName, u.lastName]
                            .filter(Boolean)
                            .join(" ")}
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{u.email}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{u.role}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        {u.status === "Suspended" ? (
                          <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">{t("admin", "status_suspended")}</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">
                            {viStatus(u.status, t)}
                          </span>
                        )}
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                        <button
                            className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0"
                          onClick={() => openView(u.userId)}
                        >
                          Xem
                        </button>
                          <span className="text-zinc-400">|</span>
                        <button
                            className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50"
                          onClick={() => openEditStatusModal(u)}
                          disabled={loading}
                        >
                          {u.status === "Suspended"
                            ? "Mở khóa"
                            : "Khóa"}
                        </button>
                          <span className="text-zinc-400">|</span>
                        <button
                            className="text-red-600 hover:underline cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50"
                          onClick={() => askDelete(u.userId)}
                          disabled={loading}
                        >
                          Xóa
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
              isDark
                ? "border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={prevPage}
            disabled={page <= 1 || loading}
          >
            Trước
          </button>
          <span className="text-sm">
            Trang <b>{page}</b>
            {totalPages > 1 ? ` / ${totalPages}` : ""}
          </span>
          <button
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
              isDark
                ? "border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={nextPage}
            disabled={page >= totalPages || loading}
          >
            Sau
          </button>
        </div>
      </section>

      {viewUserId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/16 border border-green-500/25 flex-shrink-0">
                  <span className="text-green-600 font-semibold">✓</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="m-0 text-lg font-semibold leading-tight">
                    Thông tin người dùng
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    {viewLoading
                      ? "Đang tải chi tiết…"
                      : viewUser?.email || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {viewLoading ? (
                <div className="text-sm text-zinc-500">
                  Đang tải…
                </div>
              ) : viewUser ? (
                <div className="grid gap-3 text-sm leading-relaxed">
                  <div>
                    <b>Tên hiển thị: </b>
                    {viewUser.userName ||
                      [viewUser.firstName, viewUser.lastName]
                        .filter(Boolean)
                        .join(" ") ||
                      "—"}
                  </div>
                  <div>
                    <b>Email: </b>
                    {viewUser.email || "—"}
                  </div>
                  <div>
                    <b>Vai trò: </b>
                    {viewUser.role || "—"}
                  </div>
                  <div>
                    <b>Trạng thái: </b>
                    {viStatus(viewUser.status, t)}
                  </div>
                  <div>
                    <b>Lần hoạt động gần nhất: </b>
                    {timeAgoVi(
                      viewUser.lastLoginAt || viewUser.createdAt,
                      t
                    )}
                  </div>
                  <div>
                    <b>Tổ chức tham gia: </b>
                    {viewUser.totalOrganizations ?? 0}
                  </div>
                  <div>
                    <b>Membership đang active: </b>
                    {viewUser.totalActiveMemberships ?? 0}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-500 font-medium">
                  Không tải được thông tin người dùng.
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                onClick={closeView}
                disabled={viewLoading}
              >
                Đóng
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-green-600 to-green-700 text-white shadow-sm disabled:opacity-50"
                disabled={viewLoading || !viewUser || loading}
                onClick={() => {
                  closeView();
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {draftUserId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${
                  draftNextStatus === "Suspended"
                    ? "bg-red-500/18 border-red-500/40"
                    : "bg-green-500/16 border-green-500/25"
                }`}>
                  {draftNextStatus === "Suspended" ? (
                    <span className="text-red-600 font-semibold">!</span>
                  ) : (
                    <span className="text-green-600 font-semibold">✓</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="m-0 text-lg font-semibold leading-tight">
                    Cập nhật trạng thái tài khoản
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    Thay đổi quyền truy cập của người dùng{" "}
                    <b>{draftUserName || "Người dùng"}</b>. Hệ thống sẽ lưu lại
                    lý do bạn đưa ra.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Trạng thái mới
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div>
                  <select
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                    value={draftNextStatus}
                    disabled={submitting}
                    onChange={(e) =>
                      setDraftNextStatus(
                        e.target.value as BackendStatus
                      )
                    }
                  >
                    <option value="Active">{t("admin", "status_active")}</option>
                    <option value="Suspended">{t("admin", "status_suspended")}</option>
                  </select>
                </div>
                <div className="text-zinc-500 text-xs">
                  {t("admin", "user_suspended_note")}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Lý do thay đổi
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <div>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-y min-h-[92px] disabled:opacity-50"
                    placeholder="VD: Tài khoản có hoạt động bất thường, tạm khóa để kiểm tra."
                    value={draftReason}
                    disabled={submitting}
                    onChange={(e) => setDraftReason(e.target.value)}
                  />
                </div>
                <div className="text-zinc-500 text-xs">
                  Lý do này sẽ được lưu trong lịch sử hoạt động quản trị.
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                disabled={submitting}
                onClick={closeEditStatusModal}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-green-600 to-green-700 text-white shadow-sm disabled:opacity-50"
                disabled={submitting}
                onClick={submitUpdateStatus}
              >
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-red-500/20 max-w-lg w-full mx-4">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/18 border border-red-500/40 flex-shrink-0">
                  <span className="text-red-600 font-semibold">!</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="m-0 text-lg font-semibold leading-tight text-red-600">
                    Xóa tài khoản
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    Hành động này không thể hoàn tác. Tài khoản sẽ bị
                    xóa vĩnh viễn khỏi hệ thống.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-b border-zinc-200">
              {deleteErr && (
                <div className="p-3 mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {deleteErr}
                </div>
              )}
              <p className="mb-2 text-sm leading-relaxed">
                Bạn có chắc muốn xóa người dùng này không?
              </p>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Người dùng sẽ không thể đăng nhập lại.
              </p>
            </div>

            <div className="p-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Huỷ
              </button>

              <button
                className="px-4 py-2 rounded-lg border border-red-500/40 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                onClick={doDelete}
                disabled={deleting}
              >
                {deleting ? "Đang xoá…" : "Xoá tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
