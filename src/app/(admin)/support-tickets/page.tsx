"use client";

import {
  adminGetSupportTickets,
  adminGetSupportTicketById,
  adminUpdateSupportTicket,
  adminCloseSupportTicket,
} from "@/lib/admin-api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import s from "../admin.module.css";

type TicketStatus = "Open" | "Pending" | "Closed";
type Priority = "Low" | "Medium" | "High" | string;

type Ticket = {
  ticketId: number;
  title: string;
  description?: string;
  status: TicketStatus | string;
  priority: Priority | string;
  category: string;
  userName?: string;
  userEmail?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  messageCount?: number;
  lastMessage?: string | null;
};

type TicketListResponse = {
  items: Ticket[];
  totalPages?: number;
};

type EditableTicketFields = {
  title: string;
  category: string;
  priority: string;
  status: TicketStatus;
};

export default function SupportTicketsPage() {
  const router = useRouter();

  // List state
  const [rows, setRows] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"Tất cả" | TicketStatus>("Tất cả");
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Detail state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [editDraft, setEditDraft] = useState<EditableTicketFields | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  // Load list
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingList(true);
      setListError(null);
      try {
        const data = await adminGetSupportTickets<TicketListResponse | Ticket[]>({
          page,
          pageSize: 10,
          status: statusFilter === "Tất cả" ? undefined : statusFilter,
        });

        if (cancelled) return;

        const normalized: TicketListResponse = Array.isArray(data)
          ? { items: data, totalPages: 1 }
          : data;

        setRows(normalized.items ?? []);
        setTotalPages(Math.max(1, normalized.totalPages ?? 1));
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

  // Helpers
  const renderStatusBadge = (status: TicketStatus | string) => {
    if (status === "Closed") {
      return <span className={s.badgeWarn}>Đã đóng</span>;
    }
    if (status === "Pending") {
      return <span className={s.badgePending}>Đang chờ</span>;
    }
    return <span className={s.badgeSuccess}>Đang mở</span>;
  };

  const onStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as "Tất cả" | TicketStatus);
    setPage(1);
  };

  const loadTicketDetail = async (ticketId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailTicket(null);
    setEditDraft(null);

    try {
      const t = await adminGetSupportTicketById<Ticket>(ticketId);
      setDetailTicket(t);
      setEditDraft({
        title: t.title,
        category: t.category,
        priority: String(t.priority ?? ""),
        status: (t.status as TicketStatus) ?? "Open",
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Không thể tải chi tiết phiếu hỗ trợ.";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const onDraftChange = (field: keyof EditableTicketFields, value: string) => {
    setEditDraft((prev) =>
      prev
        ? {
          ...prev,
          [field]: field === "status" ? (value as TicketStatus) : value,
        }
        : prev,
    );
  };

  const saveUpdate = async () => {
    if (!detailTicket || !editDraft) return;

    setSavingUpdate(true);
    setDetailError(null);

    const body = {
      title: editDraft.title,
      category: editDraft.category,
      priority: editDraft.priority,
      status: editDraft.status,
    };

    try {
      const updated = await adminUpdateSupportTicket<typeof body, Ticket>(
        detailTicket.ticketId,
        body,
      );

      setDetailTicket(updated);
      setEditDraft({
        title: updated.title,
        category: updated.category,
        priority: String(updated.priority ?? ""),
        status: (updated.status as TicketStatus) ?? "Open",
      });

      // cập nhật lại list
      setRows((prev) =>
        prev.map((x) => (x.ticketId === updated.ticketId ? updated : x)),
      );
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Không thể cập nhật phiếu hỗ trợ.";
      setDetailError(msg);
    } finally {
      setSavingUpdate(false);
    }
  };

  const performCloseTicket = async () => {
    if (!detailTicket) return;
    const ok = confirm(`Đóng yêu cầu "${detailTicket.title}"?`);
    if (!ok) return;

    setClosingTicket(true);
    setDetailError(null);

    const prevTicket = detailTicket;
    const optimisticClosed: Ticket = { ...detailTicket, status: "Closed" };
    setDetailTicket(optimisticClosed);
    setRows((prev) =>
      prev.map((x) =>
        x.ticketId === optimisticClosed.ticketId ? optimisticClosed : x,
      ),
    );

    try {
      await adminCloseSupportTicket(detailTicket.ticketId, {
        resolution: "Đã xử lý",
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Không thể đóng phiếu hỗ trợ.";
      alert(msg);
      setDetailTicket(prevTicket);
      setRows((prev) =>
        prev.map((x) => (x.ticketId === prevTicket.ticketId ? prevTicket : x)),
      );
    } finally {
      setClosingTicket(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailTicket(null);
    setEditDraft(null);
    setDetailError(null);
  };

  const goToDetail = (ticketId: number) => {
    router.push(`/support-tickets/${ticketId}`);
  };

  const goToEdit = (ticketId: number) => {
    router.push(`/support-tickets/${ticketId}/edit`);
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
                      <td>{t.title}</td>
                      <td>{t.userName ?? "Ẩn danh"}</td>
                      <td>{t.category}</td>
                      <td>{t.priority}</td>
                      <td>{renderStatusBadge(t.status)}</td>
                      <td className={s.rowActions}>
                        <button
                          className={s.linkBtn}
                          onClick={() => goToDetail(t.ticketId)}
                        >
                          Xem
                        </button>
                        {t.status !== "Closed" && (
                          <button
                            className={s.linkBtn}
                            onClick={() => goToEdit(t.ticketId)}
                          >
                            Chỉnh sửa
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

      {/* Panel chi tiết bên phải (nếu bạn vẫn muốn giữ) */}
      {detailOpen && (
        <section className={s.panel}>
          <div className={s.panelHead}>
            <div>
              <h3>Chi tiết yêu cầu</h3>
              {detailTicket && (
                <div className={s.subTitle}>
                  <span>
                    #{detailTicket.ticketId} · {detailTicket.title}
                  </span>
                </div>
              )}
            </div>
            <div className={s.filters}>
              {detailTicket && renderStatusBadge(detailTicket.status)}
              <button className={s.linkBtn} onClick={closeDetail}>
                Đóng
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className={s.sectionBox}>Đang tải chi tiết…</div>
          ) : detailError ? (
            <div className={s.errorBox}>{detailError}</div>
          ) : detailTicket && editDraft ? (
            <div className={s.sectionBoxCol}>
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

              <div className={s.fieldCol}>
                <label className={s.label}>Tiêu đề</label>
                <input
                  className={s.input}
                  value={editDraft.title}
                  onChange={(e) => onDraftChange("title", e.target.value)}
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
                  {detailTicket.userName ?? "Ẩn danh"}
                </div>
              </div>

              <div className={s.fieldCol}>
                <label className={s.label}>Email</label>
                <div className={s.readonlyBox}>
                  {detailTicket.userEmail ?? "—"}
                </div>
              </div>

              <div className={s.fieldCol}>
                <label className={s.label}>Tạo lúc</label>
                <div className={s.readonlyBox}>
                  {detailTicket.createdAt ?? "—"}
                </div>
              </div>

              <div className={s.fieldCol}>
                <label className={s.label}>Cập nhật gần nhất</label>
                <div className={s.readonlyBox}>
                  {detailTicket.updatedAt ?? "—"}
                </div>
              </div>

              <div className={s.fieldCol}>
                <label className={s.label}>Đã giải quyết lúc</label>
                <div className={s.readonlyBox}>
                  {detailTicket.resolvedAt ?? "—"}
                </div>
              </div>

              {(detailTicket.messageCount ?? 0) > 0 && (
                <div className={s.fieldCol}>
                  <label className={s.label}>Hoạt động gần đây</label>
                  <div className={s.readonlyBox}>
                    <div>
                      <strong>Số tin nhắn:</strong> {detailTicket.messageCount}
                    </div>
                    {detailTicket.lastMessage && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Tin cuối:</strong> {detailTicket.lastMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={s.sectionBox}>Không có dữ liệu.</div>
          )}
        </section>
      )}
    </div>
  );
}
