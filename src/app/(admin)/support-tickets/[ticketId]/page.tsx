"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "../../layout";
import {
  closeSupportTicket,
  getSupportTicketByIdByAdmin,
  ReplySupportTicketRequest,
  replyToSupportTicket,
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus,
} from "@/lib/api-support";
import { useSupportTicketHub } from "@/lib/hubs/support-tickets";
import type {
  SupportTicketMessage as SignalRMessage,
  TicketStatusChangedEvent,
} from "@/lib/hubs/support-tickets";

const PRIORITY_LABEL: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp",
};

function priorityLabel(p?: string | null) {
  const key = String(p ?? "").toLowerCase();
  return PRIORITY_LABEL[key] ?? (p ?? "—");
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN");
}

function renderStatusBadge(status: SupportTicketStatus | string) {
  const s = String(status ?? "").toLowerCase();
  if (s === "closed") {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">
        Đã đóng
      </span>
    );
  }
  if (s === "inprogress" || s === "waitingforcustomer") {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-blue-600 bg-blue-500/16">
        Đang chờ
      </span>
    );
  }
  if (s === "resolved") {
    return (
      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-green-600 bg-green-500/16">
        Đã giải quyết
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">
      Đang mở
    </span>
  );
}

export default function SupportTicketDetailPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const params = useParams<{ ticketId?: string }>();

  const ticketIdParam = params?.ticketId;
  const ticketIdNum = useMemo(() => Number(ticketIdParam), [ticketIdParam]);
  const isValidTicketId = Number.isFinite(ticketIdNum) && ticketIdNum > 0;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [reply, setReply] = useState<ReplySupportTicketRequest | null>(null);
  const [savingReply, setSavingReply] = useState(false);  

  const [closeOpen, setCloseOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [resolutionErr, setResolutionErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const isClosed = String(ticket?.status ?? "").toLowerCase() === "closed";

  const handleNewMessage = useCallback(
    (message: SignalRMessage) => {
      if (!isValidTicketId) return;
      if (message.ticketId !== ticketIdNum) return;

      setTicket((prev) => {
        if (!prev) return prev;
        const exists = (prev.messages || []).some(
          (m) => m.messageId === message.messageId
        );
        if (exists) return prev;

        const newMsg: SupportTicketMessage = {
          messageId: message.messageId,
          message: message.message,
          isFromUser: message.isFromUser,
          createdAt: message.createdAt,
        };

        return {
          ...prev,
          messages: [...(prev.messages || []), newMsg],
        };
      });
    },
    [isValidTicketId, ticketIdNum]
  );

  const handleTicketStatusChanged = useCallback(
    (event: TicketStatusChangedEvent) => {
      if (!isValidTicketId) return;
      if (event.ticketId !== ticketIdNum) return;

      setTicket((prev) =>
        prev
          ? { ...prev, status: event.status as SupportTicketStatus }
          : prev
      );
    },
    [isValidTicketId, ticketIdNum]
  );

  const { isConnected } = useSupportTicketHub(
    {
      onNewMessage: handleNewMessage,
      onTicketStatusChanged: handleTicketStatusChanged,
    },
    {
      enabled: true,
      ticketId: isValidTicketId ? ticketIdNum : null,
    }
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!isValidTicketId) {
        setErr("ticketId không hợp lệ trong URL.");
        setTicket(null);
        return;
      }

      setLoading(true);
      setErr(null);
      try {
        const data = await getSupportTicketByIdByAdmin(ticketIdNum);
        if (!alive) return;
        setTicket(data);
      } catch (e) {
        if (!alive) return;
        setErr(
          e instanceof Error ? e.message : "Không thể tải chi tiết phiếu hỗ trợ."
        );
        setTicket(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isValidTicketId, ticketIdNum]);

  const submitReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    if (savingReply) return;

    setSavingReply(true);
    setErr(null);

    try {
      await replyToSupportTicket(ticket.ticketId, reply!);

      const optimistic: SupportTicketMessage = {
        messageId: Date.now(),
        message: reply?.reply ?? "",
        isFromUser: false,
        createdAt: new Date().toISOString(),
      };

      setTicket((prev) =>
        prev
          ? { ...prev, messages: [optimistic, ...(prev.messages || [])] }
          : prev
      );
      setReply(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không thể lưu phản hồi.");
    } finally {
      setSavingReply(false);
    }
  };

  const openCloseModal = () => {
    if (!ticket || isClosed) return;
    setResolution("Đã xử lý xong");
    setResolutionErr(null);
    setCloseOpen(true);
  };

  const cancelClose = () => {
    if (closing) return;
    setCloseOpen(false);
    setResolutionErr(null);
  };

  const confirmClose = async () => {
    if (!ticket) return;
    if (closing) return;

    const text = resolution.trim();
    if (!text) {
      setResolutionErr("Vui lòng nhập resolution.");
      return;
    }

    setClosing(true);
    setResolutionErr(null);
    setErr(null);

    const prev = ticket;
    setTicket({ ...ticket, status: "closed" });

    try {
      await closeSupportTicket(ticket.ticketId);
      setCloseOpen(false);
    } catch (e) {
      setTicket(prev);
      setErr(e instanceof Error ? e.message : "Không thể đóng ticket.");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="grid gap-5">
      <section
        className={`${
          isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
        } border rounded-xl p-4 shadow-sm grid gap-3`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="m-0 text-base font-extrabold">Chi tiết yêu cầu hỗ trợ</h3>
          </div>

          <button
            className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer ${
              isDark ? "text-emerald-400" : "text-emerald-600"
            }`}
            onClick={() => router.push("/support-tickets")}
          >
            ← Quay lại
          </button>
        </div>
      </section>

      {loading ? (
        <section
          className={`${
            isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
          } border rounded-xl p-8 shadow-sm text-center`}
        >
          <div className={`${isDark ? "text-zinc-400" : "text-gray-500"}`}>
            Đang tải...
          </div>
        </section>
      ) : err ? (
        <section
          className={`${
            isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
          } border rounded-xl p-6 shadow-sm`}
        >
          <div className="text-red-500 font-semibold text-sm mb-4">{err}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer"
          >
            Thử lại
          </button>
        </section>
      ) : !ticket ? (
        <section
          className={`${
            isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
          } border rounded-xl p-8 shadow-sm text-center`}
        >
          <div className={`${isDark ? "text-zinc-400" : "text-gray-500"}`}>
            Không có dữ liệu.
          </div>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section
            className={`${
              isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
            } border rounded-xl p-6 shadow-sm`}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-4 mb-4 border-zinc-800">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500 font-semibold">
                  #{ticket.ticketId}
                </div>
                <h2 className="m-0 text-lg font-extrabold text-zinc-100">
                  {ticket.subject}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge(ticket.status)}
              </div>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-zinc-500 font-semibold mb-1">
                    Người gửi
                  </div>
                  <div className={`${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                    {ticket.userName ?? "Ẩn danh"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold mb-1">
                    Email
                  </div>
                  <div className={`${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                    {ticket.userEmail ?? "—"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-zinc-500 font-semibold mb-1">
                    Độ ưu tiên
                  </div>
                  <div className={`${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                    {priorityLabel(ticket.priority ?? null)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-semibold mb-1">
                    Tạo lúc
                  </div>
                  <div className={`${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                    {fmtDate(ticket.createdAt)}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800">
                <div className="text-xs text-zinc-500 font-semibold mb-2">
                  Nội dung
                </div>
                <div
                  className={`rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isDark ? "bg-zinc-800/60 text-zinc-200" : "bg-gray-50 text-gray-900"
                  }`}
                >
                  {ticket.message ?? "—"}
                </div>
              </div>
            </div>
          </section>

          <section
            className={`${
              isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
            } border rounded-xl p-6 shadow-sm`}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="m-0 text-base font-extrabold">Phản hồi</h3>

              {!isClosed && (
                <button
                  onClick={openCloseModal}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
                  disabled={closing || savingReply}
                >
                  Đóng ticket
                </button>
              )}
            </div>

            {Array.isArray(ticket.messages) && ticket.messages.length > 0 && (
              <div
                className={`mb-4 rounded-lg border ${
                  isDark ? "border-zinc-800" : "border-gray-200"
                } overflow-hidden`}
              >
                <div
                  className={`px-3 py-2 text-xs font-extrabold ${
                    isDark ? "bg-zinc-800/95 text-zinc-400" : "bg-gray-50 text-gray-600"
                  }`}
                >
                  Lịch sử ({ticket.messages.length})
                </div>
                <div className="p-3 space-y-3 max-h-[320px] overflow-auto">
                  {ticket.messages.map((m) => (
                    <div
                      key={m.messageId}
                      className={`p-3 rounded-lg border ${
                        m.isFromUser
                          ? isDark
                            ? "bg-blue-500/12 border-blue-500/25"
                            : "bg-blue-50 border-blue-200"
                          : isDark
                          ? "bg-emerald-500/12 border-emerald-500/25"
                          : "bg-emerald-50 border-emerald-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div
                          className={`text-xs font-extrabold ${
                            m.isFromUser
                              ? isDark
                                ? "text-blue-300"
                                : "text-blue-700"
                              : isDark
                              ? "text-emerald-300"
                              : "text-emerald-700"
                          }`}
                        >
                          {m.isFromUser ? ticket.userName ?? "User" : "Admin"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {fmtDate(m.createdAt)}
                        </div>
                      </div>
                      <div
                        className={`text-sm whitespace-pre-wrap ${
                          isDark ? "text-zinc-200" : "text-gray-900"
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={submitReply} className="grid gap-3">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-zinc-300">Nội dung phản hồi</div>
                <textarea
                  className={`w-full px-3 py-2 rounded-lg border outline-none resize-y min-h-[110px] ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                      : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                  } disabled:opacity-50`}
                  value={reply?.reply ?? ""}
                  disabled={isClosed || savingReply}
                  onChange={(e) => setReply({ reply: e.target.value })}
                  placeholder={isClosed ? "Ticket đã đóng" : "Nhập phản hồi..."}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={isClosed || savingReply || !(reply?.reply.trim())}
                  className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer disabled:opacity-50"
                >
                  {savingReply ? "Đang lưu..." : "Gửi phản hồi"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {closeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-amber-500/20 max-w-lg w-full mx-4">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/18 border border-amber-500/40 flex-shrink-0">
                  <span className="text-amber-700 font-semibold">✓</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="m-0 text-lg font-semibold leading-tight text-amber-700">
                    Đóng ticket
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    Nhập ghi chú (resolution) để lưu lại lý do đóng ticket. Thao tác này sẽ cập nhật trạng thái ticket thành <b>Đã đóng</b>.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-b border-zinc-200">
              {resolutionErr && (
                <div className="p-3 mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {resolutionErr}
                </div>
              )}

              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Resolution <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-y min-h-[96px] disabled:opacity-50"
                value={resolution}
                disabled={closing}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="VD: Đã xử lý xong, hướng dẫn khách khởi động lại..."
              />
              <div className="text-zinc-500 text-xs mt-2">
                Nội dung này sẽ được lưu vào lịch sử xử lý của ticket.
              </div>
            </div>

            <div className="p-6 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                onClick={cancelClose}
                disabled={closing}
              >
                Huỷ
              </button>

              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-sm disabled:opacity-50"
                onClick={confirmClose}
                disabled={closing}
              >
                {closing ? "Đang đóng…" : "Đóng ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
