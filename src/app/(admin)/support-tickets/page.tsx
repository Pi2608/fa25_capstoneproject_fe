"use client";

import {
  adminGetSupportTickets,
  adminGetSupportTicketById,
  adminUpdateSupportTicket,
  adminCloseSupportTicket,
} from "@/lib/admin-api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../layout";

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
  const { isDark } = useTheme();

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
      return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">Đã đóng</span>;
    }
    if (status === "Pending") {
      return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-blue-600 bg-blue-500/16">Đang chờ</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">Đang mở</span>;
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
    <div className="grid gap-5">
      <section className={`${isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Yêu cầu hỗ trợ</h3>
          <div className="flex gap-2 flex-wrap">
            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              }`}
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

        <div className={`overflow-auto border rounded-lg mt-2 ${
          isDark ? "border-zinc-800" : "border-gray-200"
        }`}>
          {listError ? (
            <div className="p-4 text-center text-red-500 font-semibold text-sm">{listError}</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Tiêu đề</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Người gửi</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Danh mục</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Độ ưu tiên</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Trạng thái</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}></th>
                </tr>
              </thead>
              <tbody>
                {loadingList && rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}>Đang tải...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}>Không có yêu cầu nào.</td>
                  </tr>
                ) : (
                  rows.map((t) => (
                    <tr key={t.ticketId}>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{t.title}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{t.userName ?? "Ẩn danh"}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{t.category}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{t.priority}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>{renderStatusBadge(t.status)}</td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                        <button
                            className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0"
                          onClick={() => goToDetail(t.ticketId)}
                        >
                          Xem
                        </button>
                        {t.status !== "Closed" && (
                            <>
                              <span className="text-zinc-400">|</span>
                          <button
                                className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0"
                            onClick={() => goToEdit(t.ticketId)}
                          >
                            Chỉnh sửa
                          </button>
                            </>
                        )}
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
            className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${
              isDark ? "text-[#3f5f36]" : "text-blue-600"
            }`}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>
          <span className="text-sm">
            Trang {page}/{totalPages}
          </span>
          <button
            className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${
              isDark ? "text-[#3f5f36]" : "text-blue-600"
            }`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      </section>

      {/* Panel chi tiết bên phải (nếu bạn vẫn muốn giữ) */}
      {detailOpen && (
        <section className={`${isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"} border rounded-xl p-4 shadow-sm grid gap-3`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="m-0 text-base font-extrabold">Chi tiết yêu cầu</h3>
              {detailTicket && (
                <div className="text-zinc-400 text-sm mt-1">
                  <span>
                    #{detailTicket.ticketId} · {detailTicket.title}
                  </span>
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

                {detailTicket.status !== "Closed" ? (
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
                  value={editDraft.title}
                  onChange={(e) => onDraftChange("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Danh mục</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  value={editDraft.category}
                  onChange={(e) => onDraftChange("category", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Độ ưu tiên</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  value={editDraft.priority}
                  onChange={(e) => onDraftChange("priority", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Trạng thái</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
                  value={editDraft.status}
                  onChange={(e) => onDraftChange("status", e.target.value)}
                >
                  <option value="Open">Đang mở</option>
                  <option value="Pending">Đang chờ</option>
                  <option value="Closed">Đã đóng</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Mô tả</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.description ?? "(Không có mô tả)"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Người gửi</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.userName ?? "Ẩn danh"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Email</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.userEmail ?? "—"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Tạo lúc</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.createdAt ?? "—"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Cập nhật gần nhất</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.updatedAt ?? "—"}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Đã giải quyết lúc</label>
                <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                  {detailTicket.resolvedAt ?? "—"}
                </div>
              </div>

              {(detailTicket.messageCount ?? 0) > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-300">Hoạt động gần đây</label>
                  <div className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/50 text-zinc-300">
                    <div>
                      <strong>Số tin nhắn:</strong> {detailTicket.messageCount}
                    </div>
                    {detailTicket.lastMessage && (
                      <div className="mt-1">
                        <strong>Tin cuối:</strong> {detailTicket.lastMessage}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-zinc-400">Không có dữ liệu.</div>
          )}
        </section>
      )}
    </div>
  );
}
