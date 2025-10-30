"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import s from "../admin.module.css";
import {
  adminGetOrganizations,
  adminUpdateOrganizationStatus,
  adminDeleteOrganization,
  type Paged,
  type OrgStatus,
} from "@/lib/admin-api";

type Organization = {
  orgId: string;
  name: string;
  ownerName: string;
  status: OrgStatus;
  createdAt?: string | null;
  totalMembers?: number | null;
};

type EditDraft = {
  orgId: string;
  currentStatus: OrgStatus;
  nextStatus: OrgStatus;
  reason: string;
};

export default function OrganizationsPage() {
  const [rows, setRows] = useState<Organization[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<"Tất cả" | OrgStatus>("Tất cả");
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      setLoading(true);
      setErr(null);

      try {
        const res: Paged<Organization> =
          await adminGetOrganizations<Organization>({
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
            e instanceof Error
              ? e.message
              : "Không thể tải danh sách tổ chức.";
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

  const openEditModal = (org: Organization) => {
    const toggledStatus: OrgStatus =
      org.status === "Suspended" ? "Active" : "Suspended";

    setDraft({
      orgId: org.orgId,
      currentStatus: org.status,
      nextStatus: toggledStatus,
      reason: "",
    });
  };

  const closeEditModal = () => {
    if (submitting) return;
    setDraft(null);
  };

  const onDraftStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      nextStatus: e.target.value as OrgStatus,
    });
  };

  const onDraftReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      reason: e.target.value,
    });
  };

  const submitUpdate = async () => {
    if (!draft) return;
    if (!draft.reason.trim()) {
      alert("Vui lòng nhập lý do.");
      return;
    }

    setSubmitting(true);

    const prevStatus: OrgStatus = draft.currentStatus;
    const newStatus: OrgStatus = draft.nextStatus;
    const orgId = draft.orgId;
    const reasonText = draft.reason.trim();

    // optimistic UI
    setRows((list) =>
      list.map((x) =>
        x.orgId === orgId ? { ...x, status: newStatus } : x
      )
    );

    try {
      await adminUpdateOrganizationStatus(orgId, {
        orgId,
        status: newStatus,
        reason: reasonText,
      });
      setDraft(null);
    } catch {
      // rollback
      setRows((list) =>
        list.map((x) =>
          x.orgId === orgId ? { ...x, status: prevStatus } : x
        )
      );
      alert("Không thể cập nhật trạng thái tổ chức.");
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (org: Organization) => {
    setDeleteTarget(org);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    const orgId = deleteTarget.orgId;

    try {
      await adminDeleteOrganization(orgId);

      // remove from list
      setRows((list) => list.filter((x) => x.orgId !== orgId));

      setDeleteTarget(null);
    } catch {
      alert("Không thể xóa tổ chức. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
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
            <select
              className={s.select}
              value={status}
              onChange={onStatusChange}
            >
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
                        <Link
                          href={`/organizations/${o.orgId}`}
                          className={s.rowActionBtn}
                        >
                          Chi tiết
                        </Link>

                        <span className={s.rowActionSep}>|</span>

                        <button
                          className={s.rowActionBtn}
                          onClick={() => openEditModal(o)}
                        >
                          Sửa
                        </button>

                        <span className={s.rowActionSep}>|</span>

                        <button
                          className={s.rowActionBtnDanger}
                          onClick={() => openDeleteModal(o)}
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

      {/* Modal cập nhật trạng thái tổ chức */}
      {draft && (
        <div className={s.modalOverlay}>
          <div className={s.modalCardPro}>
            <div className={s.modalHeadPro}>
              <div className={s.modalHeadLeft}>
                <div className={s.iconCircle}>
                  {draft.nextStatus === "Suspended" ? (
                    <span className={s.iconDotWarn}>!</span>
                  ) : (
                    <span className={s.iconDotOk}>✓</span>
                  )}
                </div>
                <div className={s.titleBlock}>
                  <div className={s.modalTitlePro}>
                    Cập nhật trạng thái tổ chức
                  </div>
                  <div className={s.modalSubtitlePro}>
                    Thay đổi trạng thái hoạt động của tổ chức. Hệ thống sẽ ghi
                    nhận lý do để phục vụ kiểm tra và đối soát.
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
                    value={draft.nextStatus}
                    disabled={submitting}
                    onChange={onDraftStatusChange}
                  >
                    <option value="Active">Hoạt động</option>
                    <option value="Suspended">Đã khóa</option>
                  </select>
                </div>
                <div className={s.fieldHint}>
                  "Đã khóa" sẽ tạm chặn quyền truy cập của toàn bộ thành viên
                  trong tổ chức này.
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
                    placeholder="VD: Hoạt động bất thường, cần tạm ngưng để kiểm tra thanh toán."
                    value={draft.reason}
                    disabled={submitting}
                    onChange={onDraftReasonChange}
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
                onClick={closeEditModal}
              >
                Hủy
              </button>
              <button
                className={s.btnSolid}
                disabled={submitting}
                onClick={submitUpdate}
              >
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={s.modalOverlay}>
          <div className={s.modalCardDanger}>
            <div className={s.modalHeadDanger}>
              <div className={s.modalHeadLeft}>
                <div className={s.iconCircleDanger}>
                  <span className={s.iconDotDanger}>!</span>
                </div>
                <div className={s.titleBlock}>
                  <div className={s.modalTitleProDanger}>
                    Xóa tổ chức này?
                  </div>
                  <div className={s.modalSubtitleProDanger}>
                    Thao tác này sẽ xóa vĩnh viễn tổ chức
                    <span className={s.orgNameHighlight}>
                      {" "}{deleteTarget.name}
                    </span>{" "}
                    và toàn bộ dữ liệu liên quan. Hành động này không thể hoàn tác.
                  </div>
                </div>
              </div>
            </div>

            <div className={s.modalBodyDanger}>
              <div className={s.dangerBox}>
                Vui lòng xác nhận rằng bạn hiểu hậu quả và muốn tiếp tục.
              </div>
            </div>

            <div className={s.modalFootDanger}>
              <button
                className={s.btnGhost}
                disabled={deleting}
                onClick={closeDeleteModal}
              >
                Hủy
              </button>

              <button
                className={s.btnDangerOutline}
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
