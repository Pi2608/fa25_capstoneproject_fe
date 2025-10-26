"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../admin.module.css";
import { adminGetUsers, adminUpdateUserStatus } from "@/lib/admin-api";


type Role = "Admin" | "RegisteredUser" | string;
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

const viStatus = (st: BackendStatus) =>
  st === "Suspended"
    ? "Đã khóa"
    : st === "Inactive"
      ? "Không hoạt động"
      : st === "PendingVerification" || st === "Pending"
        ? "Chờ xác minh"
        : "Hoạt động";

const toBackendToggle = (st: BackendStatus): BackendStatus =>
  st === "Suspended" ? "Active" : "Suspended";


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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await adminGetUsers<User>({
          page,
          pageSize: PAGE_SIZE,
          search: debouncedQ.trim() || undefined,
          status: serverStatus,
        });

        if (cancelled) return;
        setRows(Array.isArray(data.items) ? data.items : []);
        setTotalPages(Math.max(1, Number(data.totalPages ?? 1)));

        if (page > (data.totalPages ?? 1)) {
          setPage(1);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const message =
          e instanceof Error ? e.message : "Không thể tải danh sách người dùng.";
        setErr(message);
        setRows([]);
        setTotalPages(1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, debouncedQ, serverStatus]);

  const filtered = useMemo(() => {
    if (roleFilter === "Tất cả") return rows;
    return rows.filter((u) => u.role === roleFilter);
  }, [rows, roleFilter]);

  const onToggleStatus = async (u: User) => {
    const next: BackendStatus =
      u.status === "Suspended" || u.status === "Pending" || u.status === "PendingVerification"
        ? "Active"
        : "Suspended";

    const prev = u.status;
    setRows(arr => arr.map(x => x.userId === u.userId ? { ...x, status: next } : x));

    try {
      await adminUpdateUserStatus(u.userId, {
        userId: u.userId,
        status: next,
        reason: next === "Suspended" ? "Admin manually suspended account" : "Reactivated by admin"
      });
    } catch (e: unknown) {
      setRows(arr => arr.map(x => x.userId === u.userId ? { ...x, status: prev } : x));
      alert(e instanceof Error ? e.message : "Không thể cập nhật trạng thái.");
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
                  e.target
                    .value as
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
                        <button className={s.linkBtn}>Xem</button>
                        <button className={s.linkBtn}>Sửa</button>
                        <button
                          className={s.linkBtn}
                          onClick={() => onToggleStatus(u)}
                          disabled={loading}
                        >
                          {u.status === "Suspended" ? "Mở khóa" : "Khóa"}
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
    </div>
  );
}
