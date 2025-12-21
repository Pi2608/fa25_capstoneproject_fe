"use client";

import { useEffect, useState, useCallback } from "react";
import { approveExport, rejectExport, type ExportResponse } from "@/lib/api-maps";
import { adminGetAllExports } from "@/lib/admin-api";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import ExportedImagePreviewModal from "@/components/admin/ExportedImagePreviewModal";

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("vi-VN");
  } catch {
    return iso;
  }
}

function getStatusBadgeClass(status: string, isDark: boolean): string {
  const statusLower = status.toLowerCase();
  if (statusLower === "pendingapproval" || statusLower === "pending") {
    return isDark ? "bg-yellow-500/20 text-yellow-300" : "bg-yellow-100 text-yellow-800";
  }
  if (statusLower === "processing") {
    return isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-800";
  }
  if (statusLower === "approved") {
    return isDark ? "bg-green-500/20 text-green-300" : "bg-green-100 text-green-800";
  }
  if (statusLower === "rejected") {
    return isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-800";
  }
  if (statusLower === "failed") {
    return isDark ? "bg-red-500/20 text-red-300" : "bg-red-100 text-red-800";
  }
  return isDark ? "bg-gray-500/20 text-gray-300" : "bg-gray-100 text-gray-800";
}

function getStatusLabel(status: string): string {
  const s = (status || "").toLowerCase();

  if (s === "pendingapproval" || s === "pending") return "Chờ phê duyệt";
  if (s === "processing") return "Đang xử lý";
  if (s === "approved") return "Đã phê duyệt";
  if (s === "rejected") return "Từ chối";
  if (s === "failed") return "Thất bại";
  if (s === "completed") return "Hoàn thành";

  return status;
}

function getStatusLabelFromCode(statusCode: number): string {
  const statusMap: Record<number, string> = {
    2: "Chờ phê duyệt",
    3: "Đã phê duyệt",
    4: "Từ chối",
    5: "Thất bại",
  };
  return statusMap[statusCode] || "Unknown";
}

export default function AdminExportsPage() {
  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);

  const [exports, setExports] = useState<ExportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<number | null>(null); // null = all statuses
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; exportId: number | null; exportItem: ExportResponse | null }>({
    isOpen: false,
    exportId: null,
    exportItem: null
  });
  const [rejectReason, setRejectReason] = useState("");
  const [exportPreviewModal, setExportPreviewModal] = useState<{ isOpen: boolean; exportItem: ExportResponse | null }>({
    isOpen: false,
    exportItem: null
  });

  const loadExports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminGetAllExports({
        page: currentPage,
        pageSize: pageSize,
        status: statusFilter,
      });
      setExports(response.exports);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to load exports:", error);
      setExports([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, statusFilter]);

  useEffect(() => {
    loadExports();
  }, [loadExports]);

  const handleApprove = async (exportId: number) => {
    if (actioningId) return;

    const confirmed = window.confirm("Bạn có chắc chắn muốn phê duyệt export này?");
    if (!confirmed) return;

    try {
      setActioningId(exportId);
      await approveExport(exportId);
      alert("Đã phê duyệt export thành công!");
      await loadExports();
    } catch (error) {
      console.error("Failed to approve export:", error);
      alert("Không thể phê duyệt export. Vui lòng thử lại.");
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectClick = (exportId: number, exportItem: ExportResponse) => {
    setRejectModal({ isOpen: true, exportId, exportItem });
    setRejectReason("");
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.exportId || !rejectReason.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }

    try {
      setActioningId(rejectModal.exportId);
      await rejectExport(rejectModal.exportId, rejectReason.trim());
      alert("Đã từ chối export!");
      setRejectModal({ isOpen: false, exportId: null, exportItem: null });
      setRejectReason("");
      await loadExports();
    } catch (error) {
      console.error("Failed to reject export:", error);
      alert("Không thể từ chối export. Vui lòng thử lại.");
    } finally {
      setActioningId(null);
    }
  };

  const handleViewExport = (exportItem: ExportResponse) => {
    setExportPreviewModal({ isOpen: true, exportItem });
  };

  const filteredExports = exports.filter(exp => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      exp.mapName?.toLowerCase().includes(q) ||
      exp.userName?.toLowerCase().includes(q) ||
      exp.format?.toLowerCase().includes(q) ||
      exp.exportId.toString().includes(q)
    );
  });

  return (
    <div className="grid gap-5">
      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="m-0 text-xl font-extrabold">
            Quản lý Export Map
            {statusFilter !== null && (
              <span className="text-sm font-normal opacity-60 ml-2">
                ({getStatusLabelFromCode(statusFilter)})
              </span>
            )}
          </h2>
          <div className="flex gap-2 flex-wrap">
            <input
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 min-w-[200px] ${theme.input}`}
              placeholder="Tìm kiếm theo tên map, user, format..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${theme.input}`}
              value={statusFilter === null ? "" : String(statusFilter)}
              onChange={(e) => {
                const value = e.target.value;
                setStatusFilter(value === "" ? null : Number(value));
                setCurrentPage(1); // Reset to first page when filter changes
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="2">Chờ phê duyệt</option>
              <option value="3">Đã phê duyệt</option>
              <option value="4">Từ chối</option>
              <option value="5">Thất bại</option>
            </select>
            <button
              className={`h-[34px] px-4 text-sm rounded-lg border font-medium transition-colors ${isDark
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
                }`}
              onClick={loadExports}
              disabled={loading}
            >
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
          </div>
        </div>

        <div className={`overflow-auto border ${theme.tableBorder} rounded-lg mt-2`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Export ID</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Map</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>User</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Format</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Trạng thái</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Ngày tạo</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-center font-extrabold text-xs`}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={`p-8 text-center ${theme.textMuted}`}>
                    Đang tải...
                  </td>
                </tr>
              ) : filteredExports.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`p-8 text-center ${theme.textMuted}`}>
                    {statusFilter !== null
                      ? `Không có export nào với trạng thái "${getStatusLabelFromCode(statusFilter)}"`
                      : "Không có export nào"}
                  </td>
                </tr>
              ) : (
                filteredExports.map((exp) => (
                  <tr key={exp.exportId}>
                    <td className={`p-3 border-b ${theme.tableCell} text-left font-mono`}>
                      #{exp.exportId}
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{exp.mapName || "(Không tên)"}</span>
                        <span className="text-xs opacity-60">ID: {exp.mapId}</span>
                      </div>
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {exp.userName || exp.userId}
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <span className="uppercase font-mono text-xs font-bold">{exp.format}</span>
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(exp.status, isDark)}`}
                        title={exp.status}
                      >
                        {getStatusLabel(exp.status)}
                      </span>
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {formatDate(exp.createdAt)}
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-center`}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-opacity disabled:opacity-50 ${isDark
                            ? "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-blue-500 hover:bg-blue-600 text-white"
                            }`}
                          onClick={() => handleViewExport(exp)}
                          disabled={actioningId !== null}
                        >
                          Xem Export
                        </button>
                        <button
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-opacity disabled:opacity-50 ${isDark
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-green-500 hover:bg-green-600 text-white"
                            }`}
                          onClick={() => handleApprove(exp.exportId)}
                          disabled={actioningId !== null || (exp.status || "").toLowerCase() === "approved"}

                        >
                          {actioningId === exp.exportId ? "Đang xử lý..." : "Phê duyệt"}
                        </button>
                        <button
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-opacity disabled:opacity-50 ${isDark
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-red-500 hover:bg-red-600 text-white"
                            }`}
                          onClick={() => handleRejectClick(exp.exportId, exp)}
                          disabled={actioningId !== null || (exp.status || "").toLowerCase() === "approved"}
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className={`text-sm ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
              Hiển thị {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, total)} của {total} exports
            </div>
            <div className="flex gap-2">
              <button
                className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors disabled:opacity-50 ${isDark
                    ? "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                    : "bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                  }`}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
              >
                Trước
              </button>
              <span className={`px-3 py-1.5 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors disabled:opacity-50 ${isDark
                    ? "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700"
                    : "bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                  }`}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Reject Modal */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/50">
          <div className={`relative rounded-xl shadow-2xl border w-full max-w-md mx-4 ${isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"
            }`}>
            <div className={`px-6 py-4 border-b ${isDark ? "border-zinc-700" : "border-gray-200"}`}>
              <h3 className="text-lg font-bold">Từ chối Export</h3>
              <p className="text-sm opacity-60 mt-1">
                Export ID: #{rejectModal.exportId} - {rejectModal.exportItem?.mapName}
              </p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium mb-2">
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 min-h-[120px] ${isDark
                  ? "bg-zinc-800 border-zinc-700 focus:border-zinc-600 focus:ring-zinc-600"
                  : "bg-white border-gray-300 focus:border-gray-400 focus:ring-gray-400"
                  }`}
                placeholder="Nhập lý do từ chối export này..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${isDark ? "border-zinc-700" : "border-gray-200"}`}>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark
                  ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                  : "bg-gray-200 hover:bg-gray-300 text-gray-900"
                  }`}
                onClick={() => {
                  setRejectModal({ isOpen: false, exportId: null, exportItem: null });
                  setRejectReason("");
                }}
                disabled={actioningId !== null}
              >
                Hủy
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 ${isDark
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
                  }`}
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || actioningId !== null}
              >
                {actioningId === rejectModal.exportId ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Preview Modal */}
      {exportPreviewModal.isOpen && exportPreviewModal.exportItem && (
        <ExportedImagePreviewModal
          exportItem={exportPreviewModal.exportItem}
          onClose={() => setExportPreviewModal({ isOpen: false, exportItem: null })}
          isDark={isDark}
        />
      )}
    </div>
  );
}
