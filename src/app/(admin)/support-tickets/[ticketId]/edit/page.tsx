"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import s from "../../../admin.module.css";
import {
  adminGetSupportTicketById,
  adminUpdateSupportTicket,
  adminCloseSupportTicket,
} from "@/lib/admin-api";

type TicketStatus = "Open" | "Pending" | "Closed";
type Priority = string;

type Ticket = {
  ticketId: number;
  title: string;
  description?: string | null;
  status: TicketStatus | string;
  priority: Priority | null;
  category: string;
  userName?: string | null;
  userEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  response?: string | null;
};

type EditableTicketFields = {
  status: TicketStatus;
  priority: string;
  response: string;
};

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function EditSupportTicketPage() {
  const router = useRouter();
  const params = useParams<{ ticketId?: string }>();
  const ticketId = params?.ticketId ?? "";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [editDraft, setEditDraft] = useState<EditableTicketFields | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!ticketId) {
        setErr("Thiếu ticketId trong URL.");
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const data = await adminGetSupportTicketById<Ticket>(ticketId);
        if (!alive) return;

        setTicket(data);
        setEditDraft({
          status: (data.status as TicketStatus) ?? "Open",
          priority: String(data.priority ?? ""),
          response: data.response ?? "",
        });
      } catch (e) {
        if (!alive) return;
        setErr(
          e instanceof Error
            ? e.message
            : "Không thể tải chi tiết phiếu hỗ trợ.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [ticketId]);

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

  const handleSave = async () => {
    if (!ticket || !editDraft) return;

    setSaving(true);
    setErr(null);

    const body = {
      ticketId: ticket.ticketId,
      status: editDraft.status,
      priority: editDraft.priority,
      assignedToUserId: ticket.assignedToUserId ?? null,
      response: editDraft.response || "",
    };

    try {
      const updated = await adminUpdateSupportTicket<typeof body, Ticket>(
        ticket.ticketId,
        body,
      );
      setTicket(updated);
      setEditDraft({
        status: (updated.status as TicketStatus) ?? "Open",
        priority: String(updated.priority ?? ""),
        response: updated.response ?? "",
      });
    } catch (e) {
      console.error(e);
      setErr(
        e instanceof Error
          ? e.message
          : "Không thể lưu thay đổi, vui lòng thử lại sau.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!ticket || !editDraft) return;
    const ok = confirm(
      `Bạn có chắc chắn muốn đóng yêu cầu "${ticket.title}"?\n\n` +
        "Yêu cầu sẽ được đánh dấu là đã giải quyết và không thể chỉnh sửa thêm.",
    );
    if (!ok) return;

    setClosing(true);
    setErr(null);

    const prev = ticket;
    const optimistic: Ticket = { ...ticket, status: "Closed" };
    setTicket(optimistic);

    try {
      await adminCloseSupportTicket(ticket.ticketId, {
        resolution: editDraft.response || "Đã xử lý",
      });
    } catch (e) {
      console.error(e);
      alert(
        "Đóng yêu cầu thất bại. Vui lòng thử lại sau hoặc liên hệ quản trị viên nếu lỗi tiếp diễn.",
      );
      setTicket(prev);
    } finally {
      setClosing(false);
    }
  };

  if (loading)
    return <div className={s.loadingBox}>Đang tải yêu cầu…</div>;
  if (err)
    return (
      <div className={s.stack}>
        <section className={s.panel}>
          <div className={s.errorBox}>{err}</div>
        </section>
      </div>
    );
  if (!ticket || !editDraft)
    return (
      <div className={s.stack}>
        <section className={s.panel}>
          <div className={s.emptyBox}>Không có dữ liệu.</div>
        </section>
      </div>
    );

  const actionBtnBase = {
    padding: "8px 16px",
    borderRadius: 9999,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer" as const,
    border: "1px solid transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Chỉnh sửa yêu cầu</h3>
          <button
            className={s.linkBtn}
            onClick={() => router.push(`/support-tickets/${ticket.ticketId}`)}
            disabled={saving || closing}
          >
            ← Quay lại
          </button>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            padding: "24px 28px 28px",
            display: "grid",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: 10,
              marginBottom: 4,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {ticket.title || `Phiếu hỗ trợ #${ticket.ticketId}`}
              </h2>
              <div
                style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}
              >
                #{ticket.ticketId} · {ticket.category} ·{" "}
                {ticket.userName ?? "Ẩn danh"}
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280" }}>
              <div>Tạo: {fmtDate(ticket.createdAt)}</div>
              <div>Cập nhật: {fmtDate(ticket.updatedAt)}</div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(260px, minmax(0,1fr)))",
              gap: 18,
            }}
          >
            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className={s.formLabel}>Trạng thái</span>
              <select
                className={s.select}
                value={editDraft.status}
                onChange={(e) => onDraftChange("status", e.target.value)}
              >
                <option value="Open">Đang mở</option>
                <option value="Pending">Đang chờ</option>
                <option value="Closed">Đã đóng</option>
              </select>
            </label>

            <label
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className={s.formLabel}>Độ ưu tiên</span>
              <input
                className={s.input}
                value={editDraft.priority}
                onChange={(e) => onDraftChange("priority", e.target.value)}
                placeholder="Ví dụ: cao, trung bình, thấp…"
              />
            </label>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <h4 style={{ margin: 0, color: "#111827", fontSize: 14 }}>
              ✉️ Ghi chú / phản hồi cho khách
            </h4>
            <textarea
              className={s.input}
              rows={4}
              style={{
                resize: "vertical",
                minHeight: 120,
                borderRadius: 10,
                padding: "10px 12px",
              }}
              value={editDraft.response}
              onChange={(e) => onDraftChange("response", e.target.value)}
              placeholder="Nội dung xử lý và phản hồi cho khách hàng. Nếu đóng yêu cầu, nội dung này sẽ được dùng làm lý do/ghi chú."
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 4,
            }}
          >
            <button
              style={{
                ...actionBtnBase,
                backgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                color: "#374151",
              }}
              onClick={() =>
                router.push(`/support-tickets/${ticket.ticketId}`)
              }
              disabled={saving || closing}
            >
              Hủy
            </button>

            <button
              style={{
                ...actionBtnBase,
                backgroundColor: "#2563eb",
                color: "#ffffff",
                boxShadow: "0 1px 2px rgba(37,99,235,0.35)",
                opacity: saving || closing ? 0.7 : 1,
              }}
              onClick={handleSave}
              disabled={saving || closing}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>

            {ticket.status !== "Closed" ? (
              <button
                style={{
                  ...actionBtnBase,
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  boxShadow: "0 1px 2px rgba(239,68,68,0.35)",
                  opacity: saving || closing ? 0.7 : 1,
                }}
                onClick={handleClose}
                disabled={saving || closing}
              >
                {closing ? "Đang đóng..." : "Đóng yêu cầu"}
              </button>
            ) : (
              <button
                style={{
                  ...actionBtnBase,
                  backgroundColor: "#9ca3af",
                  color: "#ffffff",
                  cursor: "not-allowed",
                }}
                disabled
              >
                Đã đóng
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
