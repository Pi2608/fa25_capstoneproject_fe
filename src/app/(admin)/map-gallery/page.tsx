"use client";

import {
  adminGetAllSubmissions,
  adminApproveOrRejectSubmission,
  adminDeleteSubmission,
  type MapGallerySummaryResponse,
  type MapGalleryStatusEnum,
  type MapGalleryApprovalRequest,
  MapGalleryStatus,
} from "@/lib/api-map-gallery";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";

const STATUSES: MapGalleryStatusEnum[] = ["Pending", "Approved", "Rejected"];

export default function MapGalleryPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);
  const [submissions, setSubmissions] = useState<MapGallerySummaryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<MapGalleryStatusEnum | "All">("All");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<MapGallerySummaryResponse | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<MapGalleryStatusEnum>("Approved");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSubmissions = async () => {
      setLoading(true);
      setError(null);
      try {
        const status = statusFilter === "All" ? undefined : statusFilter;
        const data = await adminGetAllSubmissions(status);
        if (!cancelled) {
          setSubmissions(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Không thể tải danh sách submissions.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSubmissions();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const handleApprove = async (submission: MapGallerySummaryResponse) => {
    setSelectedSubmission(submission);
    setApprovalStatus("Approved");
    setRejectionReason("");
    setIsFeatured(submission.isFeatured);
    setShowApprovalModal(true);
  };

  const handleReject = async (submission: MapGallerySummaryResponse) => {
    setSelectedSubmission(submission);
    setApprovalStatus("Rejected");
    setRejectionReason("");
    setIsFeatured(false);
    setShowApprovalModal(true);
  };

  const handleSubmitApproval = async () => {
    if (!selectedSubmission) return;

    setProcessingId(selectedSubmission.id);
    try {
      const request: MapGalleryApprovalRequest = {
        status: approvalStatus,
        rejectionReason: approvalStatus === "Rejected" ? rejectionReason : undefined,
        isFeatured: isFeatured,
      };

      await adminApproveOrRejectSubmission(selectedSubmission.id, request);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSubmission.id
            ? { ...s, status: approvalStatus, isFeatured: isFeatured }
            : s
        )
      );
      setShowApprovalModal(false);
      setSelectedSubmission(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xử lý submission thất bại.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa submission này?")) return;

    setProcessingId(id);
    try {
      await adminDeleteSubmission(id);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xóa submission thất bại.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSubmissions =
    statusFilter === "All"
      ? submissions
      : submissions.filter((s) => s.status === statusFilter);

  const fmtDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: MapGalleryStatusEnum | string) => {
    // Normalize status to capitalized format
    const normalizedStatus = 
      status === "Pending" || status === "pending" ? "Pending" :
      status === "Approved" || status === "approved" ? "Approved" :
      status === "Rejected" || status === "rejected" ? "Rejected" :
      status;
    
    const styles = {
      Pending: { bg: "#fff3cd", color: "#856404", text: "Chờ duyệt" },
      Approved: { bg: "#d4edda", color: "#155724", text: "Đã duyệt" },
      Rejected: { bg: "#f8d7da", color: "#721c24", text: "Đã từ chối" },
    };
    const style = styles[normalizedStatus as keyof typeof styles] || styles.Pending;
    return (
      <span
        style={{
          padding: "0.25rem 0.75rem",
          borderRadius: "12px",
          fontSize: "0.875rem",
          background: style.bg,
          color: style.color,
        }}
      >
        {style.text}
      </span>
    );
  };

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0 mb-2">Quản lý Bản đồ Gallery</h1>
          <p className={`${theme.textMuted} m-0`}>
            Duyệt và quản lý các bản đồ được submit lên gallery cộng đồng
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <label className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MapGalleryStatusEnum | "All")}
            className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${theme.select}`}
          >
            <option value="All">Tất cả</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "Pending"
                  ? "Chờ duyệt"
                  : status === "Approved"
                  ? "Đã duyệt"
                  : "Đã từ chối"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700"
          style={{ background: "#fee", color: "#c33", borderColor: "#fcc" }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="p-5">
          <div className={`${theme.textMuted}`} style={{ padding: "2rem", textAlign: "center" }}>
            Đang tải...
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-x-auto">
          {filteredSubmissions.length === 0 ? (
            <div className={`${theme.textMuted}`} style={{ padding: "3rem", textAlign: "center" }}>
              <p>Chưa có submission nào.</p>
            </div>
          ) : (
            <table className={`min-w-full divide-y ${isDark ? "divide-zinc-800" : "divide-gray-200"}`}>
              <thead>
                <tr>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Bản đồ</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Danh mục</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Tác giả</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Ngày tạo</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Lượt xem</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Trạng thái</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`} style={{ width: "200px" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>
                      <strong>{submission.mapName}</strong>
                      {submission.description && (
                        <div
                          className={theme.textMuted}
                          style={{
                            fontSize: "0.875rem",
                            marginTop: "0.25rem",
                          }}
                        >
                          {submission.description.slice(0, 60)}...
                        </div>
                      )}
                      {submission.isFeatured && (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: "0.25rem",
                            padding: "0.125rem 0.5rem",
                            borderRadius: "8px",
                            fontSize: "0.75rem",
                            background: "#ffd700",
                            color: "#856404",
                            fontWeight: "bold",
                          }}
                        >
                          ⭐ Nổi bật
                        </span>
                      )}
                    </td>
                    <td>{submission.category || "N/A"}</td>
                    <td>{submission.authorName || "N/A"}</td>
                    <td>{fmtDate(submission.createdAt)}</td>
                    <td>{submission.viewCount}</td>
                    <td>{getStatusBadge(submission.status)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {submission.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(submission)}
                              disabled={processingId === submission.id}
                              className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                              style={{ color: "#28a745" }}
                              title="Duyệt"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => handleReject(submission)}
                              disabled={processingId === submission.id}
                              className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                              style={{ color: "#dc3545" }}
                              title="Từ chối"
                            >
                              ✗
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(submission.id)}
                          disabled={processingId === submission.id}
                          className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                          title="Xóa"
                        >
                          {processingId === submission.id ? (
                            <SpinnerIcon />
                          ) : (
                            <DeleteIcon />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedSubmission && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowApprovalModal(false)}
        >
          <div
            className={`${isDark ? "bg-zinc-900" : "bg-white"} p-8 rounded-lg max-w-lg w-[90%] max-h-[90vh] overflow-auto border ${isDark ? "border-zinc-800" : "border-gray-200"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 mb-2">
              {approvalStatus === "Approved" ? "Duyệt bản đồ" : "Từ chối bản đồ"}
            </h2>
            <p>
              <strong>Bản đồ:</strong> {selectedSubmission.mapName}
            </p>

            {approvalStatus === "Approved" && (
              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  <span>Đánh dấu nổi bật</span>
                </label>
              </div>
            )}

            {approvalStatus === "Rejected" && (
              <div className="mt-4">
                <label>
                  <strong>Lý do từ chối:</strong>
                  <textarea
                    className={`w-full mt-2 p-3 rounded border resize-y min-h-[100px] ${theme.input}`}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Nhập lý do từ chối..."
                  />
                </label>
              </div>
            )}

            <div className="flex gap-4 mt-6 justify-end">
              <button
                className={`px-4 py-2 rounded border transition-colors ${
                  isDark
                    ? "border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setShowApprovalModal(false)}
              >
                Hủy
              </button>
              <button
                className={`px-4 py-2 rounded border-none text-white transition-opacity ${
                  approvalStatus === "Approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
                onClick={handleSubmitApproval}
                disabled={processingId === selectedSubmission.id || (approvalStatus === "Rejected" && !rejectionReason.trim())}
                style={{
                  cursor: processingId === selectedSubmission.id ? "not-allowed" : "pointer",
                  opacity: processingId === selectedSubmission.id ? 0.6 : 1,
                }}
              >
                {processingId === selectedSubmission.id
                  ? "Đang xử lý..."
                  : approvalStatus === "Approved"
                  ? "Duyệt"
                  : "Từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="32"
        strokeDashoffset="32"
      >
        <animate
          attributeName="stroke-dasharray"
          dur="2s"
          values="0 32;16 16;0 32;0 32"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          dur="2s"
          values="0;-16;-32;-32"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}

