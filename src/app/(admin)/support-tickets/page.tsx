"use client";

import {
  adminGetSupportTickets,
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
};

export default function SupportTicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"Tất cả" | TicketStatus>("Tất cả");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await adminGetSupportTickets<Ticket>({
          page,
          pageSize: 10,
          status: status === "Tất cả" ? undefined : status,
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
          setErr(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [page, status]);

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value as "Tất cả" | TicketStatus);
    setPage(1);
  };

  const closeTicket = async (t: Ticket) => {
    const ok = confirm(`Đóng yêu cầu "${t.subject}"?`);
    if (!ok) return;

    const prev = rows;
    setRows((arr) =>
      arr.map((x) =>
        x.ticketId === t.ticketId ? { ...x, status: "Closed" } : x
      )
    );

    try {
      await adminCloseSupportTicket(t.ticketId, { resolution: "Đã xử lý" });
    } catch (e: unknown) {
      alert(
        e instanceof Error ? e.message : "Không thể đóng yêu cầu."
      );
      setRows(prev);
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
              value={status}
              onChange={onStatusChange}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Open">Đang mở</option>
              <option value="Pending">Đang chờ</option>
              <option value="Closed">Đã đóng</option>
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
                  <th>Tiêu đề</th>
                  <th>Người gửi</th>
                  <th>Danh mục</th>
                  <th>Độ ưu tiên</th>
                  <th>Trạng thái</th>
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
                        ) : (
                          <span className={s.badgeSuccess}>{t.status}</span>
                        )}
                      </td>
                      <td className={s.rowActions}>
                        <button className={s.linkBtn}>Xem</button>
                        {t.status !== "Closed" && (
                          <button
                            className={s.linkBtn}
                            onClick={() => closeTicket(t)}
                          >
                            Đóng
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
          <span>Trang {page}/{totalPages}</span>
          <button
            className={s.linkBtn}
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
