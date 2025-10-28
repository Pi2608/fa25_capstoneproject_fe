"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../admin.module.css";
import {
  adminGetUsers,
  adminGetUserById,
  adminUpdateUserStatus,
  adminDeleteUser,
} from "@/lib/admin-api";

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

function viStatus(st: BackendStatus) {
  if (st === "Suspended") return "Đã khóa";
  if (st === "Inactive") return "Không hoạt động";
  if (st === "PendingVerification" || st === "Pending") return "Chờ xác minh";
  return "Hoạt động";
}

function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function timeAgoVi(iso?: string | null) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const days = Math.floor(h / 24);
  return `${days} ngày trước`;
}

export default function AccountsPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q);

  const [roleFilter, setRoleFilter] = useState<"Tất cả" | Role>("Tất cả");
  const [statusFilter, setStatusFilter] = useState<
    "Tất cả" | "Hoạt động" | "Đã khóa" | "Không hoạt động" | "Chờ xác minh"
  >("Tất cả");

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
    statusFilter === "Tất cả"
      ? undefined
      : statusFilter === "Đã khóa"
      ? "Suspended"
      : statusFilter === "Không hoạt động"
      ? "Inactive"
      : statusFilter === "Chờ xác minh"
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
    if (roleFilter === "Tất cả") return rows;
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
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Quản lý tài khoản</h3>
          <div className={s.filters}>
            <input
              className={s.input}
              placeholder="Tìm theo tên hoặc email…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              aria-label="Tìm kiếm người dùng"
            />
            <select
              className={s.select}
              value={roleFilter}
              onChange={(e) => {
                setPage(1);
                setRoleFilter(e.target.value as Role | "Tất cả");
              }}
              aria-label="Lọc theo vai trò"
            >
              <option value="Tất cả">Tất cả vai trò</option>
              <option value="Admin">Admin</option>
              <option value="Member">Member</option>
              <option value="User">User</option>
            </select>
            <select
              className={s.select}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "Tất cả"
                    | "Hoạt động"
                    | "Đã khóa"
                    | "Không hoạt động"
                    | "Chờ xác minh"
                )
              }
              aria-label="Lọc theo trạng thái"
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Hoạt động">Hoạt động</option>
              <option value="Đã khóa">Đã khóa</option>
              <option value="Không hoạt động">Không hoạt động</option>
              <option value="Chờ xác minh">Chờ xác minh</option>
            </select>
          </div>
        </div>

        <div className={s.tableWrap}>
          {err ? (
            <div className={s.errorBox}>{err}</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Hoạt động gần nhất</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16 }}>
                      Đang tải…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16 }}>
                      Không tìm thấy tài nguyên.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        {u.userName ||
                          [u.firstName, u.lastName]
                            .filter(Boolean)
                            .join(" ")}
                      </td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>
                        {u.status === "Suspended" ? (
                          <span className={s.badgeWarn}>Đã khóa</span>
                        ) : (
                          <span className={s.badgeSuccess}>
                            {viStatus(u.status)}
                          </span>
                        )}
                      </td>
                      <td>{timeAgoVi(u.lastLoginAt || u.createdAt)}</td>
                      <td className={s.rowActions}>
                        <button
                          className={s.rowActionBtn}
                          onClick={() => openView(u.userId)}
                        >
                          Xem
                        </button>
                        <span className={s.rowActionSep}>|</span>
                        <button
                          className={s.rowActionBtn}
                          onClick={() => openEditStatusModal(u)}
                          disabled={loading}
                        >
                          {u.status === "Suspended"
                            ? "Mở khóa"
                            : "Khóa"}
                        </button>
                        <span className={s.rowActionSep}>|</span>
                        <button
                          className={s.rowActionBtnDanger}
                          onClick={() => askDelete(u.userId)}
                          disabled={loading}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={s.pager}>
          <button
            className={s.pageBtn}
            onClick={prevPage}
            disabled={page <= 1 || loading}
          >
            Trước
          </button>
          <span>
            Trang <b>{page}</b>
            {totalPages > 1 ? ` / ${totalPages}` : ""}
          </span>
          <button
            className={s.pageBtn}
            onClick={nextPage}
            disabled={page >= totalPages || loading}
          >
            Sau
          </button>
        </div>
      </section>

      {viewUserId !== null && (
        <div className={s.modalOverlay}>
          <div className={s.modalCardPro} style={{ maxWidth: 420 }}>
            <div className={s.modalHeadPro}>
              <div className={s.modalHeadLeft}>
                <div className={s.iconCircle}>
                  <span className={s.iconDotOk}>✓</span>
                </div>
                <div className={s.titleBlock}>
                  <div className={s.modalTitlePro}>
                    Thông tin người dùng
                  </div>
                  <div className={s.modalSubtitlePro}>
                    {viewLoading
                      ? "Đang tải chi tiết…"
                      : viewUser?.email || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className={s.modalBodyPro}>
              {viewLoading ? (
                <div style={{ fontSize: 13, color: "#6b6b6b" }}>
                  Đang tải…
                </div>
              ) : viewUser ? (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
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
                    {viStatus(viewUser.status)}
                  </div>
                  <div>
                    <b>Lần hoạt động gần nhất: </b>
                    {timeAgoVi(
                      viewUser.lastLoginAt || viewUser.createdAt
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
                <div
                  style={{
                    fontSize: 13,
                    color: "#ef4444",
                    fontWeight: 500,
                  }}
                >
                  Không tải được thông tin người dùng.
                </div>
              )}
            </div>

            <div className={s.modalFootPro}>
              <button
                className={s.btnGhost}
                onClick={closeView}
                disabled={viewLoading}
              >
                Đóng
              </button>
              <button
                className={s.btnSolid}
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
        <div className={s.modalOverlay}>
          <div className={s.modalCardPro}>
            <div className={s.modalHeadPro}>
              <div className={s.modalHeadLeft}>
                <div className={s.iconCircle}>
                  {draftNextStatus === "Suspended" ? (
                    <span className={s.iconDotWarn}>!</span>
                  ) : (
                    <span className={s.iconDotOk}>✓</span>
                  )}
                </div>
                <div className={s.titleBlock}>
                  <div className={s.modalTitlePro}>
                    Cập nhật trạng thái tài khoản
                  </div>
                  <div className={s.modalSubtitlePro}>
                    Thay đổi quyền truy cập của người dùng{" "}
                    <b>{draftUserName || "Người dùng"}</b>. Hệ thống sẽ lưu lại
                    lý do bạn đưa ra.
                  </div>
                </div>
              </div>
            </div>

            <div className={s.modalBodyPro}>
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>
                  Trạng thái mới
                  <span className={s.requiredMark}>*</span>
                </label>
                <div className={s.fieldControl}>
                  <select
                    className={s.selectField}
                    value={draftNextStatus}
                    disabled={submitting}
                    onChange={(e) =>
                      setDraftNextStatus(
                        e.target.value as BackendStatus
                      )
                    }
                  >
                    <option value="Active">Hoạt động</option>
                    <option value="Suspended">Đã khóa</option>
                  </select>
                </div>
                <div className={s.fieldHint}>
                  "Đã khóa" sẽ chặn người dùng đăng nhập và sử dụng hệ thống.
                </div>
              </div>

              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>
                  Lý do thay đổi
                  <span className={s.requiredMark}>*</span>
                </label>
                <div className={s.fieldControl}>
                  <textarea
                    className={s.textareaField}
                    placeholder="VD: Tài khoản có hoạt động bất thường, tạm khóa để kiểm tra."
                    value={draftReason}
                    disabled={submitting}
                    onChange={(e) => setDraftReason(e.target.value)}
                  />
                </div>
                <div className={s.fieldHint}>
                  Lý do này sẽ được lưu trong lịch sử hoạt động quản trị.
                </div>
              </div>
            </div>

            <div className={s.modalFootPro}>
              <button
                className={s.btnGhost}
                disabled={submitting}
                onClick={closeEditStatusModal}
              >
                Hủy
              </button>
              <button
                className={s.btnSolid}
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
        <div className={s.modalOverlay}>
          <div className={s.modalCardDanger}>
            <div className={s.modalHeadDanger}>
              <div className={s.modalHeadLeft}>
                <div className={s.iconCircleDanger}>
                  <span className={s.iconDotDanger}>!</span>
                </div>
                <div className={s.titleBlock}>
                  <div className={s.modalTitleProDanger}>
                    Xóa tài khoản
                  </div>
                  <div className={s.modalSubtitleProDanger}>
                    Hành động này không thể hoàn tác. Tài khoản sẽ bị
                    xóa vĩnh viễn khỏi hệ thống.
                  </div>
                </div>
              </div>
            </div>

            <div className={s.modalBodyDanger}>
              {deleteErr && (
                <div
                  className={s.dangerBox}
                  style={{ marginBottom: 12 }}
                >
                  {deleteErr}
                </div>
              )}
              <p
                style={{
                  marginBottom: 6,
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Bạn có chắc muốn xóa người dùng này không?
              </p>
              <p
                style={{
                  color: "#6b6b6b",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Người dùng sẽ không thể đăng nhập lại.
              </p>
            </div>

            <div className={s.modalFootDanger}>
              <button
                className={s.btnGhost}
                onClick={cancelDelete}
                disabled={deleting}
              >
                Huỷ
              </button>

              <button
                className={s.btnDangerOutline}
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
