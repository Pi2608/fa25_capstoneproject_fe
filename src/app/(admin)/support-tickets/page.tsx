"use client";

import {
  adminGetSupportTickets,
  adminGetSupportTicketById,
  adminUpdateSupportTicket,
  adminCloseSupportTicket,
  type Paged,
} from "@/lib/admin-api";
import { useEffect, useState } from "react";
import s from "../admin.module.css";

type TicketStatus = "Open" | "Pending" | "Closed";
type Priority = "Low" | "Medium" | "High" | string;

type Ticket = {
  ticketId: string;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: Priority;
  createdAt?: string;
  requesterName?: string;
  description?: string;
  lastUpdatedAt?: string;
};

type EditableTicketFields = {
  subject: string;
  category: string;
  priority: string;
  status: TicketStatus;
};

export default function SupportTicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"Tất cả" | TicketStatus>("Tất cả");
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);

  const [editDraft, setEditDraft] = useState<EditableTicketFields | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingList(true);
      setListError(null);
      try {
        const res = await adminGetSupportTickets<Ticket>({
          page,
          pageSize: 10,
          status: statusFilter === "Tất cả" ? undefined : statusFilter,
        });
        const data = res as Paged<Ticket>;
        if (cancelled) return;
        setRows(data.items ?? []);
        setTotalPages(Math.max(1, data.totalPages ?? 1));
      } catch (e: unknown) {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : "Không thể tải danh sách yêu cầu hỗ trợ.";
          setListError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter]);

  const reloadRowInList = (updated: Ticket) => {
    setRows((arr) =>
      arr.map((x) => (x.ticketId === updated.ticketId ? updated : x))
    );
  };

  const openDetail = async (ticketId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailTicket(null);
    setEditDraft(null);

    try {
      const data = await adminGetSupportTicketById<Ticket>(ticketId);
      setDetailTicket(data);
      setEditDraft({
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        status: data.status,
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Không thể tải chi tiết yêu cầu.";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailTicket(null);
    setEditDraft(null);
    setDetailError(null);
  };

  const onStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as "Tất cả" | TicketStatus);
    setPage(1);
  };

  const onDraftChange = (field: keyof EditableTicketFields, value: string) => {
    setEditDraft((prev) =>
      prev
        ? {
            ...prev,
            [field]:
              field === "status"
                ? (value as TicketStatus)
                : value,
          }
        : prev
    );
  };

  const saveUpdate = async () => {
    if (!detailTicket || !editDraft) return;
    setSavingUpdate(true);
    setDetailError(null);

    const body = {
        subject: editDraft.subject,
        category: editDraft.category,
        priority: editDraft.priority,
        status: editDraft.status,
    };

    try {
      const updated = await adminUpdateSupportTicket<typeof body, Ticket>(
        detailTicket.ticketId,
        body
      );

      setDetailTicket(updated);
      setEditDraft({
        subject: updated.subject,
        category: updated.category,
        priority: updated.priority,
        status: updated.status,
      });
      reloadRowInList(updated);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Không thể cập nhật yêu cầu.";
      setDetailError(msg);
    } finally {
      setSavingUpdate(false);
    }
  };

  const performCloseTicket = async () => {
    if (!detailTicket) return;
    const ok = confirm(`Đóng yêu cầu "${detailTicket.subject}"?`);
    if (!ok) return;

    setClosingTicket(true);
    setDetailError(null);

    const prevDetail = detailTicket;
    const prevRows = rows;

    const optimisticClosed: Ticket = {
      ...detailTicket,
      status: "Closed",
    };
    setDetailTicket(optimisticClosed);
    reloadRowInList(optimisticClosed);

    try {
      await adminCloseSupportTicket(detailTicket.ticketId, {
        resolution: "Đã xử lý",
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : "Không thể đóng yêu cầu.";
      alert(msg);
      setDetailTicket(prevDetail);
      setRows(prevRows);
    } finally {
      setClosingTicket(false);
    }
  };

  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Yêu cầu hỗ trợ</h3>
          <div className={s.filters}>
            <select
              className={s.select}
              value={statusFilter}
              onChange={onStatusFilterChange}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Open">Đang mở</option>
              <option value="Pending">Đang chờ</option>
              <option value="Closed">Đã đóng</option>
            </select>
          </div>
        </div>

        <div className={s.tableWrap}>
          {listError ? (
            <div className={s.errorBox}>{listError}</div>
          ) : (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Người gửi</th>
                  <th>Danh mục</th>
                  <th>Độ ưu tiên</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loadingList && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Đang tải...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Không có yêu cầu nào.</td>
                  </tr>
                ) : (
                  rows.map((t) => (
                    <tr key={t.ticketId}>
                      <td>{t.subject}</td>
                      <td>{t.requesterName ?? "Ẩn danh"}</td>
                      <td>{t.category}</td>
                      <td>{t.priority}</td>
                      <td>
                        {t.status === "Closed" ? (
                          <span className={s.badgeWarn}>Đã đóng</span>
                        ) : t.status === "Pending" ? (
                          <span className={s.badgePending}>Đang chờ</span>
                        ) : (
                          <span className={s.badgeSuccess}>Đang mở</span>
                        )}
                      </td>
                      <td className={s.rowActions}>
                        <button
                          className={s.linkBtn}
                          onClick={() => openDetail(t.ticketId)}
                        >
                          Xem
                        </button>
                        {t.status !== "Closed" && (
                          <button
                            className={s.linkBtn}
                            onClick={() => {
                              setDetailTicket(t);
                              setEditDraft({
                                subject: t.subject,
                                category: t.category,
                                priority: t.priority,
                                status: t.status,
                              });
                              setDetailOpen(true);
                            }}
                          >
                            Sửa nhanh
                          </button>
                        )}
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
            className={s.linkBtn}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button
            className={s.linkBtn}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      </section>

      {detailOpen && (
        <div className={s.modalBackdrop}>
          <div className={s.modalCard}>
            <div className={s.modalHead}>
              <h4>Chi tiết yêu cầu</h4>
              <button className={s.linkBtn} onClick={closeDetail}>
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className={s.sectionBox}>Đang tải chi tiết…</div>
            ) : detailError ? (
              <div className={s.errorBox}>{detailError}</div>
            ) : detailTicket && editDraft ? (
              <div className={s.sectionBoxCol}>
                <div className={s.fieldCol}>
                  <label className={s.label}>Tiêu đề</label>
                  <input
                    className={s.input}
                    value={editDraft.subject}
                    onChange={(e) => onDraftChange("subject", e.target.value)}
                  />
                </div>

                <div className={s.fieldCol}>
                  <label className={s.label}>Danh mục</label>
                  <input
                    className={s.input}
                    value={editDraft.category}
                    onChange={(e) => onDraftChange("category", e.target.value)}
                  />
                </div>

                <div className={s.fieldCol}>
                  <label className={s.label}>Độ ưu tiên</label>
                  <input
                    className={s.input}
                    value={editDraft.priority}
                    onChange={(e) => onDraftChange("priority", e.target.value)}
                  />
                </div>

                <div className={s.fieldCol}>
                  <label className={s.label}>Trạng thái</label>
                  <select
                    className={s.select}
                    value={editDraft.status}
                    onChange={(e) => onDraftChange("status", e.target.value)}
                  >
                    <option value="Open">Đang mở</option>
                    <option value="Pending">Đang chờ</option>
                    <option value="Closed">Đã đóng</option>
                  </select>
                </div>

                <div className={s.fieldCol}>
                  <label className={s.label}>Mô tả</label>
                  <div className={s.readonlyBox}>
                    {detailTicket.description ?? "(Không có mô tả)"}
                  </div>
                </div>

                <div className={s.fieldCol}>
                  <label className={s.label}>Người gửi</label>
                  <div className={s.readonlyBox}>
                    {detailTicket.requesterName ?? "Ẩn danh"}
                  </div>
                </div>

                <div className={s.fieldRow}>
                  <button
                    className={s.primaryBtn}
                    disabled={savingUpdate}
                    onClick={saveUpdate}
                  >
                    {savingUpdate ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>

                  <span className={s.divider}>|</span>

                  {detailTicket.status !== "Closed" ? (
                    <button
                      className={s.dangerBtn}
                      disabled={closingTicket}
                      onClick={performCloseTicket}
                    >
                      {closingTicket ? "Đang đóng..." : "Đóng yêu cầu"}
                    </button>
                  ) : (
                    <button className={s.dangerBtn} disabled>
                      Đã đóng
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={s.sectionBox}>Không có dữ liệu.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
