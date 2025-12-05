"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
    return <div className="p-12 text-center text-zinc-400">Đang tải yêu cầu…</div>;
  if (err)
    return (
      <div className="grid gap-5">
        <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
          <div className="p-4 text-center text-red-500 font-semibold text-sm">{err}</div>
        </section>
      </div>
    );
  if (!ticket || !editDraft)
    return (
      <div className="grid gap-5">
        <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
          <div className="p-4 text-center text-zinc-400">Không có dữ liệu.</div>
        </section>
      </div>
    );


  return (
    <div className="grid gap-5">
      <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Chỉnh sửa yêu cầu</h3>
          <button
            className="text-sm font-bold text-[#3f5f36] hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50"
            onClick={() => router.push(`/support-tickets/${ticket.ticketId}`)}
            disabled={saving || closing}
          >
            ← Quay lại
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 lg:p-7 grid gap-5">
          <div className="flex justify-between items-start gap-4 pb-3 border-b border-zinc-200 mb-1">
            <div>
              <h2 className="m-0 text-lg font-semibold">
                {ticket.title || `Phiếu hỗ trợ #${ticket.ticketId}`}
              </h2>
              <div className="text-sm text-zinc-500 mt-0.5">
                #{ticket.ticketId} · {ticket.category} ·{" "}
                {ticket.userName ?? "Ẩn danh"}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <div>Tạo: {fmtDate(ticket.createdAt)}</div>
              <div>Cập nhật: {fmtDate(ticket.updatedAt)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="block text-sm font-medium text-zinc-300">Trạng thái</span>
              <select
                className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                value={editDraft.status}
                onChange={(e) => onDraftChange("status", e.target.value)}
              >
                <option value="Open">Đang mở</option>
                <option value="Pending">Đang chờ</option>
                <option value="Closed">Đã đóng</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="block text-sm font-medium text-zinc-300">Độ ưu tiên</span>
              <input
                className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                value={editDraft.priority}
                onChange={(e) => onDraftChange("priority", e.target.value)}
                placeholder="Ví dụ: cao, trung bình, thấp…"
              />
            </label>
          </div>

          <div className="border-t border-zinc-200 pt-3 grid gap-2">
            <h4 className="m-0 text-zinc-900 text-sm font-medium">
              ✉️ Ghi chú / phản hồi cho khách
            </h4>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 resize-y min-h-[120px]"
              rows={4}
              value={editDraft.response}
              onChange={(e) => onDraftChange("response", e.target.value)}
              placeholder="Nội dung xử lý và phản hồi cho khách hàng. Nếu đóng yêu cầu, nội dung này sẽ được dùng làm lý do/ghi chú."
            />
          </div>

          <div className="flex justify-end gap-2 mt-1">
            <button
              className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer inline-flex items-center justify-center whitespace-nowrap border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              onClick={() =>
                router.push(`/support-tickets/${ticket.ticketId}`)
              }
              disabled={saving || closing}
            >
              Hủy
            </button>

            <button
              className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer inline-flex items-center justify-center whitespace-nowrap border-transparent bg-blue-600 text-white shadow-sm disabled:opacity-70"
              onClick={handleSave}
              disabled={saving || closing}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>

            {ticket.status !== "Closed" ? (
              <button
                className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer inline-flex items-center justify-center whitespace-nowrap border-transparent bg-red-500 text-white shadow-sm disabled:opacity-70"
                onClick={handleClose}
                disabled={saving || closing}
              >
                {closing ? "Đang đóng..." : "Đóng yêu cầu"}
              </button>
            ) : (
              <button
                className="px-4 py-2 rounded-full text-sm font-medium inline-flex items-center justify-center whitespace-nowrap border-transparent bg-gray-400 text-white cursor-not-allowed"
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
