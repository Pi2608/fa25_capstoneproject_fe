"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../layout";
import {
  getSupportTicketById,
  getSupportTicketsByAdmin,
  closeSupportTicket,
  SupportTicket,
  SupportTicketStatus,
} from "@/lib/api-support";
import { useSupportTicketHub } from "@/lib/hubs/support-tickets";
import type { TicketCreatedEvent, TicketUpdatedEvent } from "@/lib/hubs/support-tickets";

const PRIORITY_MAP: Record<
  string,
  { label: string; className: string }
> = {
  urgent: { label: "Khẩn cấp", className: "text-red-600 bg-red-500/15" },
  high: { label: "Cao", className: "text-orange-600 bg-orange-500/15" },
  medium: { label: "Trung bình", className: "text-yellow-600 bg-yellow-500/15" },
  low: { label: "Thấp", className: "text-zinc-500 bg-zinc-500/15" },
};

function normalizePriority(p: unknown): string {
  const s = String(p ?? "").trim().toLowerCase();
  // accept VN labels too (nếu backend/DB lỡ có)
  if (s === "khẩn cấp" || s === "khancap") return "urgent";
  if (s === "cao") return "high";
  if (s === "trung bình" || s === "trungbinh") return "medium";
  if (s === "thấp" || s === "thap") return "low";
  return s;
}

export default function SupportTicketsPage() {
  const router = useRouter();
  const { isDark } = useTheme();

  // List state
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"Tất cả" | SupportTicketStatus>("Tất cả");
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Detail state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);
  const [editDraft, setEditDraft] = useState<SupportTicket | null>(null);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  const renderPriorityBadge = (priority?: string | null) => {
    const key = normalizePriority(priority);
    const cfg = PRIORITY_MAP[key];

    if (!cfg) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-zinc-400 bg-zinc-500/10">
          —
        </span>
      );
    }

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-extrabold ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  const handleTicketCreated = useCallback((ticket: TicketCreatedEvent) => {
    setRows((prev) => {
      const exists = prev.some((t) => t.ticketId === ticket.ticketId);
      if (exists) return prev;

      const newTicket: SupportTicket = {
        ticketId: ticket.ticketId,
        userEmail: "",
        userName: "",
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status as SupportTicketStatus,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        resolvedAt: null,
        messages: [],
      };
      return [newTicket, ...prev];
    });
  }, []);

  const handleTicketUpdated = useCallback(async (event: TicketUpdatedEvent) => {
    if (event.hasNewMessage) {
      setRows((prev) =>
        prev.map((t) =>
          t.ticketId === event.ticketId ? { ...t, message: "New message" } : t
        )
      );
    }
  }, []);

  const { isConnected } = useSupportTicketHub(
    {
      onTicketCreated: handleTicketCreated,
      onTicketUpdated: handleTicketUpdated,
    },
    {
      enabled: true,
    }
  );

  // Load list
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoadingList(true);
      setListError(null);
      try {
        const data = await getSupportTicketsByAdmin(page, 20);

        if (cancelled) return;

        const all = data.tickets ?? [];
        const filtered =
          statusFilter === "Tất cả"
            ? all
            : all.filter((t) => String(t.status ?? "").toLowerCase() === String(statusFilter).toLowerCase());

        setRows(filtered);

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

  // Helpers
  const renderStatusBadge = (status: SupportTicketStatus | string) => {
    const s = String(status ?? "").toLowerCase();
    if (s === "closed") {
      return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">Đã đóng</span>;
    }
    if (s === "inprogress" || s === "waitingforcustomer") {
      return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-blue-600 bg-blue-500/16">Đang chờ</span>;
    }
    if (s === "resolved") {
      return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-green-600 bg-green-500/16">Đã giải quyết</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">Đang mở</span>;
  };

  const onStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as "Tất cả" | SupportTicketStatus);
    setPage(1);
  };

  const loadTicketDetail = async (ticketId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailTicket(null);
    setEditDraft(null);

    try {
      const t = await getSupportTicketById(ticketId);
      setDetailTicket(t);
      setEditDraft({
        ticketId: t.ticketId,
        userEmail: t.userEmail,
        userName: t.userName,
        createdAt: t.createdAt,
        resolvedAt: t.resolvedAt,
        messages: t.messages,
        subject: t.subject,
        message: t.message,
        // normalize về enum để select ăn chuẩn
        priority: normalizePriority(t.priority),
        status: (t.status as SupportTicketStatus) ?? "open",
      });
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Không thể tải chi tiết phiếu hỗ trợ.";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const onDraftChange = (field: keyof SupportTicket, value: string) => {
    setEditDraft((prev) =>
      prev
        ? {
            ...prev,
            [field]: field === "status" ? (value as SupportTicketStatus) : value,
          }
        : prev,
    );
  };

  const saveUpdate = async () => {
    if (!detailTicket || !editDraft) return;

    setSavingUpdate(true);
    setDetailError(null);

    try {
      // (Hiện file này đang chỉ update state local – nếu có API update thì gọi tại đây)
      setDetailTicket({
        ...detailTicket,
        status: editDraft.status,
        priority: editDraft.priority,
      });
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

    // UI quick: dùng prompt tạm; nếu anh muốn đồng bộ modal như trang detail thì bé làm tiếp
    const ok = confirm(`Đóng yêu cầu "${detailTicket.subject}"?`);
    if (!ok) return;

    const resolution =
      prompt("Nhập lý do/ghi chú đóng ticket (resolution):", "Đã xử lý xong")?.trim() || "Closed by admin";

    setClosingTicket(true);
    setDetailError(null);

    const prevTicket = detailTicket;
    const optimisticClosed: SupportTicket = { ...detailTicket, status: "closed" };
    setDetailTicket(optimisticClosed);
    setRows((prev) =>
      prev.map((x) =>
        x.ticketId === optimisticClosed.ticketId ? optimisticClosed : x,
      ),
    );

    try {
      // ✅ gửi resolution
      await closeSupportTicket(detailTicket.ticketId, resolution);
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

  return (
    <div className="grid gap-5">
      <section className={`${isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="m-0 text-base font-extrabold">Yêu cầu hỗ trợ</h3>
            <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isConnected
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-zinc-500/10 text-zinc-600"
              }`}>
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`} />
              {isConnected ? "Real-time" : "Offline"}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
                }`}
              value={statusFilter}
              onChange={onStatusFilterChange}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Open">Đang mở</option>
              <option value="InProgress">Đang chờ</option>
              <option value="Closed">Đã đóng</option>
            </select>
          </div>
        </div>

        <div className={`overflow-auto border rounded-lg mt-2 ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
          {listError ? (
            <div className="p-4 text-center text-red-500 font-semibold text-sm">{listError}</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${isDark ? "border-zinc-800 bg-zinc-800/95 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"}`}>Tiêu đề</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${isDark ? "border-zinc-800 bg-zinc-800/95 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"}`}>Người gửi</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${isDark ? "border-zinc-800 bg-zinc-800/95 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"}`}>Danh mục</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${isDark ? "border-zinc-800 bg-zinc-800/95 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"}`}>Độ ưu tiên</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${isDark ? "border-zinc-800 bg-zinc-800/95 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"}`}>Trạng thái</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${isDark ? "border-zinc-800 bg-zinc-800/95 text-zinc-400" : "border-gray-200 bg-gray-50 text-gray-600"}`}></th>
                </tr>
              </thead>

              <tbody>
                {loadingList && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${isDark ? "text-zinc-400" : "text-gray-500"}`}>Đang tải...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${isDark ? "text-zinc-400" : "text-gray-500"}`}>Không có yêu cầu nào.</td>
                  </tr>
                ) : (
                  rows.map((t) => (
                    <tr key={t.ticketId}>
                      <td className={`p-3 border-b text-left ${isDark ? "border-zinc-800" : "border-gray-200"}`}>{t.subject}</td>
                      <td className={`p-3 border-b text-left ${isDark ? "border-zinc-800" : "border-gray-200"}`}>{t.userName ?? "Ẩn danh"}</td>
                      <td className={`p-3 border-b text-left ${isDark ? "border-zinc-800" : "border-gray-200"}`}>—</td>

                      {/* ✅ mapping priority */}
                      <td className={`p-3 border-b text-left ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
                        {renderPriorityBadge(t.priority)}
                      </td>

                      <td className={`p-3 border-b text-left ${isDark ? "border-zinc-800" : "border-gray-200"}`}>{renderStatusBadge(t.status)}</td>
                      <td className={`p-3 border-b text-left ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                          <button
                            className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0"
                            onClick={() => goToDetail(t.ticketId)}
                          >
                            Xem
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${isDark ? "text-[#3f5f36]" : "text-blue-600"}`}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>
          <span className="text-sm">Trang {page}/{totalPages}</span>
          <button
            className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${isDark ? "text-[#3f5f36]" : "text-blue-600"}`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      </section>

      {/* Panel chi tiết bên phải */}
      {detailOpen && (
        <section className={`${isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"} border rounded-xl p-4 shadow-sm grid gap-3`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="m-0 text-base font-extrabold">Chi tiết yêu cầu</h3>
              {detailTicket && (
                <div className="text-zinc-400 text-sm mt-1">
                  <span>#{detailTicket.ticketId} · {detailTicket.subject}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {detailTicket && renderStatusBadge(detailTicket.status)}
              <button
                className="text-sm font-bold text-[#3f5f36] hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
                onClick={closeDetail}
              >
                Đóng
              </button>
            </div>
          </div>

          {detailLoading ? (
            <div className="p-4 text-center text-zinc-400">Đang tải chi tiết…</div>
          ) : detailError ? (
            <div className="p-4 text-center text-red-500 font-semibold text-sm">{detailError}</div>
          ) : detailTicket && editDraft ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer disabled:opacity-50"
                  disabled={savingUpdate}
                  onClick={saveUpdate}
                >
                  {savingUpdate ? "Đang lưu..." : "Lưu thay đổi"}
                </button>

                <span className="text-zinc-400">|</span>

                {detailTicket.status !== "closed" ? (
                  <button
                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    disabled={closingTicket}
                    onClick={performCloseTicket}
                  >
                    {closingTicket ? "Đang đóng..." : "Đóng yêu cầu"}
                  </button>
                ) : (
                  <button className="px-4 py-2 rounded-lg bg-gray-500 text-white cursor-not-allowed" disabled>
                    Đã đóng
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Tiêu đề</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  value={editDraft.subject}
                  onChange={(e) => onDraftChange("subject", e.target.value)}
                />
              </div>

              {/* ✅ mapping + dropdown */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Độ ưu tiên</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  value={normalizePriority(editDraft.priority)}
                  onChange={(e) => onDraftChange("priority", e.target.value)}
                >
                  <option value="urgent">Khẩn cấp</option>
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Trạng thái</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  value={editDraft.status}
                  onChange={(e) => onDraftChange("status", e.target.value)}
                >
                  <option value="open">Đang mở</option>
                  <option value="inprogress">Đang chờ</option>
                  <option value="closed">Đã đóng</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Mô tả</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.message ?? "(Không có mô tả)"}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-zinc-400">Không có dữ liệu.</div>
          )}
        </section>
      )}
    </div>
  );
}
