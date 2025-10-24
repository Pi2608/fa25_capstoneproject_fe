"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import s from "../admin.module.css";
import {
  adminGetOrganizations,
  adminUpdateOrganizationStatus,
  type Paged,
} from "@/lib/admin-api";

type OrgStatus = "Active" | "Suspended";

type Organization = {
  orgId: string;
  name: string;
  ownerName: string;
  status: OrgStatus;
  createdAt?: string | null;
  totalMembers?: number | null;
};

export default function OrganizationsPage() {
  const [rows, setRows] = useState<Organization[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<"Tất cả" | OrgStatus>("Tất cả");
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      setLoading(true);
      setErr(null);
      try {
        const res: Paged<Organization> = await adminGetOrganizations<Organization>({
          page,
          pageSize: 10,
          search: search.trim() || undefined,
          status: status === "Tất cả" ? undefined : status,
        });

        if (cancelled) return;
        setRows(res.items ?? []);
        setTotalPages(Math.max(1, res.totalPages ?? 1));
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Không thể tải danh sách tổ chức.";
          setErr(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, search, status]);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value as "Tất cả" | OrgStatus);
    setPage(1);
  };

  const toggleStatus = async (o: Organization) => {
    const next: OrgStatus = o.status === "Suspended" ? "Active" : "Suspended";
    const prev = o.status;

    setRows((r) => r.map((x) => (x.orgId === o.orgId ? { ...x, status: next } : x)));

    try {
      await adminUpdateOrganizationStatus(o.orgId, { status: next });
    } catch {
      setRows((r) => r.map((x) => (x.orgId === o.orgId ? { ...x, status: prev } : x)));
      alert("Không thể cập nhật trạng thái.");
    }
  };

  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Quản lý tổ chức</h3>
          <div className={s.filters}>
            <input
              className={s.input}
              placeholder="Tìm theo tên…"
              value={search}
              onChange={onSearchChange}
            />
            <select className={s.select} value={status} onChange={onStatusChange}>
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Active">Hoạt động</option>
              <option value="Suspended">Đã khóa</option>
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
                  <th>Tên tổ chức</th>
                  <th>Chủ sở hữu</th>
                  <th>Thành viên</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Đang tải...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Không có dữ liệu.</td>
                  </tr>
                ) : (
                  rows.map((o) => (
                    <tr key={o.orgId}>
                      <td>{o.name}</td>
                      <td>{o.ownerName}</td>
                      <td>{o.totalMembers ?? "–"}</td>
                      <td>
                        {o.status === "Suspended" ? (
                          <span className={s.badgeWarn}>Đã khóa</span>
                        ) : (
                          <span className={s.badgeSuccess}>Hoạt động</span>
                        )}
                      </td>
                      <td>
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString("vi-VN")
                          : "–"}
                      </td>
                      <td className={s.rowActions}>
                        <Link href={`/organizations/${o.orgId}`} className={s.linkBtn}>
                          Chi tiết
                        </Link>
                        <button className={s.linkBtn} onClick={() => toggleStatus(o)}>
                          {o.status === "Suspended" ? "Mở khóa" : "Khóa"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className={s.pagination}>
          <button
            className={s.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>
          <div className={s.pageDots}>
            <b>Trang {page}</b> <span>/ {totalPages}</span>
          </div>
          <button
            className={s.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      </section>
    </div>
  );
}
