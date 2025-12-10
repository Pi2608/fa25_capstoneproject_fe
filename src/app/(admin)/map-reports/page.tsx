"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "../layout";
import { 
  getMapReports, 
  getMapReportsByStatus, 
  reviewMapReport,
  getPendingReportsCount,
  type MapReport,
  type ReviewReportRequest 
} from "@/lib/api-map-reports";
import { AlertTriangle, CheckCircle, Clock, ExternalLink } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

const REPORT_STATUSES = [
  { value: 0, label: "Đang xử lý", color: "yellow", icon: Clock },
  { value: 1, label: "Đã xử lý", color: "green", icon: CheckCircle },
] as const;

const REPORT_REASONS: Record<string, string> = {
  inappropriate_content: "Nội dung không phù hợp",
  copyright_violation: "Vi phạm bản quyền",
  spam: "Spam",
  misinformation: "Thông tin sai lệch",
  harassment: "Quấy rối",
  other: "Khác",
};

export default function MapReportsPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const [reports, setReports] = useState<MapReport[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<number | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedReport, setSelectedReport] = useState<MapReport | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<number>(1); // Mặc định là "Đã xử lý"
  const [reviewNotes, setReviewNotes] = useState("");
  const [shouldDeleteMap, setShouldDeleteMap] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadReports();
    loadPendingCount();
  }, [page, statusFilter]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = statusFilter === "all"
        ? await getMapReports(page, 20)
        : await getMapReportsByStatus(statusFilter, page, 20);
      setReports(data.reports);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể tải danh sách báo cáo");
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    try {
      const data = await getPendingReportsCount();
      setPendingCount(data.count);
    } catch (e) {
      console.error("Failed to load pending count:", e);
    }
  };

  const handleReview = async () => {
    if (!selectedReport) return;

    // Nếu chọn "Đã xử lý" và có chọn xóa map, cần xác nhận
    if (reviewStatus === 1 && shouldDeleteMap) {
      const confirmed = window.confirm(
        `Bạn có chắc chắn muốn xóa map "${selectedReport.mapName || selectedReport.mapId}" và gửi cảnh báo đến người tạo?\n\nHành động này không thể hoàn tác!`
      );
      if (!confirmed) return;
    }

    setReviewing(true);
    try {
      // Cập nhật trạng thái báo cáo
      // Backend sẽ tự động xóa map và gửi notification nếu status = 1 và shouldDeleteMap = true
      const request: ReviewReportRequest = {
        status: reviewStatus,
        reviewNotes: reviewNotes.trim() || undefined,
        shouldDeleteMap: reviewStatus === 1 ? shouldDeleteMap : false,
      };
      await reviewMapReport(selectedReport.reportId, request);
      
      await loadReports();
      await loadPendingCount();
      setShowReviewDialog(false);
      setSelectedReport(null);
      setReviewNotes("");
      setShouldDeleteMap(false);
      
      if (reviewStatus === 1 && shouldDeleteMap) {
        showToast("success", "Đã xóa map và cập nhật báo cáo. Notification đã được gửi đến người tạo map.");
      } else {
        showToast("success", "Đã cập nhật báo cáo. Map không bị ảnh hưởng.");
      }
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Không thể cập nhật báo cáo");
    } finally {
      setReviewing(false);
    }
  };

  const getStatusBadge = (status: number) => {
    const statusInfo = REPORT_STATUSES.find(s => s.value === status) || REPORT_STATUSES[0];
    const Icon = statusInfo.icon;
    const colorClasses = {
      yellow: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-400/40",
      blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/40",
      green: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-400/40",
      gray: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-400/40",
      red: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-400/40",
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses[statusInfo.color]}`}>
        <Icon className="h-3.5 w-3.5" />
        {statusInfo.label}
      </span>
    );
  };

  const getReasonLabel = (reason: string): string => {
    return REPORT_REASONS[reason] || reason;
  };

  return (
    <div className="grid gap-5">
      <section className={`${isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="m-0 text-base font-extrabold">Báo cáo vi phạm Maps</h3>
            {pendingCount > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                {pendingCount} báo cáo đang chờ xử lý
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              }`}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value === "all" ? "all" : Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              {REPORT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={`overflow-auto border rounded-lg mt-2 ${
          isDark ? "border-zinc-800" : "border-gray-200"
        }`}>
          {error ? (
            <div className="p-4 text-center text-red-500 font-semibold text-sm">{error}</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Map</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Người báo cáo</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Lý do</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Trạng thái</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>Ngày tạo</th>
                  <th className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}></th>
                </tr>
              </thead>
              <tbody>
                {loading && reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}>Đang tải...</td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`p-8 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}>Không có báo cáo nào.</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.reportId}>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {report.mapName || `Map ${report.mapId}`}
                            <a
                              href={`/maps/publish?mapId=${report.mapId}&view=true`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                              title="Xem map"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {report.mapId.substring(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        <div>
                          <div className="font-medium">{report.reporterName || "Ẩn danh"}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {report.reporterEmail}
                          </div>
                        </div>
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        <div className="max-w-xs">
                          <div className="font-medium">{getReasonLabel(report.reason)}</div>
                          {report.description && (
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                              {report.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        {getStatusBadge(report.status)}
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        {new Date(report.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}>
                        {report.status !== 1 ? (
                          <button
                            onClick={() => {
                              setSelectedReport(report);
                              setReviewStatus(report.status);
                              setReviewNotes(report.reviewNotes || "");
                              setShouldDeleteMap(false);
                              setShowReviewDialog(true);
                            }}
                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                          >
                            Xử lý
                          </button>
                        ) : <></>}
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

      {/* Review Dialog */}
      {showReviewDialog && selectedReport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-2xl w-full border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Xem và xử lý báo cáo
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Map
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>{selectedReport.mapName || `Map ${selectedReport.mapId}`}</span>
                    <a
                      href={`/maps/publish?mapId=${selectedReport.mapId}&view=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-1"
                      title="Mở map trong tab mới"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-xs">Xem map</span>
                    </a>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Người báo cáo
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-zinc-100">
                    {selectedReport.reporterName || "Ẩn danh"}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Lý do
                </label>
                <div className="text-sm text-zinc-900 dark:text-zinc-100">
                  {getReasonLabel(selectedReport.reason)}
                </div>
              </div>
              {selectedReport.description && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Mô tả
                  </label>
                  <div className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
                    {selectedReport.description}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Trạng thái <span className="text-red-500">*</span>
                </label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {REPORT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {reviewStatus === 1 && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shouldDeleteMap}
                        onChange={(e) => setShouldDeleteMap(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Xóa map do vi phạm chính sách
                      </span>
                    </label>
                    {shouldDeleteMap && (
                      <p className="ml-6 text-xs text-red-600 dark:text-red-400 font-medium">
                        ⚠️ Cảnh báo: Map sẽ bị xóa và notification cảnh báo sẽ được gửi đến người tạo map.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Ghi chú xử lý
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                  placeholder="Ghi chú về việc xử lý báo cáo..."
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowReviewDialog(false);
                    setSelectedReport(null);
                    setReviewNotes("");
                    setShouldDeleteMap(false);
                  }}
                  disabled={reviewing}
                  className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Đóng
                </button>
                <button
                  onClick={handleReview}
                  disabled={reviewing}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reviewing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Lưu thay đổi"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

