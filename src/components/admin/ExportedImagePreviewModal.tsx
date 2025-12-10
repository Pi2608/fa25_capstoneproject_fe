"use client";

import { type ExportResponse } from "@/lib/api-maps";

interface ExportedImagePreviewModalProps {
  exportItem: ExportResponse;
  onClose: () => void;
  isDark: boolean;
}

export default function ExportedImagePreviewModal({
  exportItem,
  onClose,
  isDark,
}: ExportedImagePreviewModalProps) {
  const hasFileUrl = exportItem.fileUrl && exportItem.fileUrl.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 p-4">
      <div
        className={`relative rounded-xl shadow-2xl border w-full max-w-6xl max-h-[90vh] flex flex-col ${
          isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDark ? "border-zinc-700" : "border-gray-200"
          }`}
        >
          <div>
            <h2 className="text-xl font-bold">
              Xem trước Export - {exportItem.mapName || "Untitled Map"}
            </h2>
            <p className="text-sm opacity-60 mt-1">
              Export ID: #{exportItem.exportId} | Format: {exportItem.format?.toUpperCase()} | Status: {exportItem.status}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              isDark ? "hover:bg-zinc-800 text-zinc-400" : "hover:bg-gray-100 text-gray-600"
            }`}
            aria-label="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {hasFileUrl ? (
            <div className="flex flex-col items-center gap-4">
              {/* Exported Image */}
              <div className="w-full">
                <h3 className="font-bold mb-3">Ảnh export:</h3>
                <div
                  className={`w-full rounded-lg border overflow-hidden ${
                    isDark ? "border-zinc-700 bg-zinc-800" : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {exportItem.format === "png" || exportItem.format === "pdf" ? (
                    <img
                      src={exportItem.fileUrl}
                      alt={`Exported ${exportItem.format} - ${exportItem.mapName}`}
                      className="w-full h-auto object-contain max-h-[600px]"
                      onError={(e) => {
                        // If image fails to load, show iframe instead
                        const target = e.target as HTMLImageElement;
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<iframe src="${exportItem.fileUrl}" class="w-full h-[600px] border-0" title="Exported file preview"></iframe>`;
                        }
                      }}
                    />
                  ) : (
                    // For GeoJSON or other formats, use iframe
                    <iframe
                      src={exportItem.fileUrl}
                      className="w-full h-[600px] border-0"
                      title={`Exported ${exportItem.format} preview`}
                    />
                  )}
                </div>
              </div>

              {/* File Info */}
              <div className="w-full grid grid-cols-2 gap-4">
                <div
                  className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}
                >
                  <h4 className="font-semibold mb-1 text-xs opacity-60">File Size</h4>
                  <p className="font-bold">
                    {exportItem.fileSize > 0
                      ? `${(exportItem.fileSize / 1024 / 1024).toFixed(2)} MB`
                      : "N/A"}
                  </p>
                </div>
                <div
                  className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}
                >
                  <h4 className="font-semibold mb-1 text-xs opacity-60">Format</h4>
                  <p className="font-bold uppercase">{exportItem.format}</p>
                </div>
                <div
                  className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}
                >
                  <h4 className="font-semibold mb-1 text-xs opacity-60">Created At</h4>
                  <p className="text-sm">
                    {exportItem.createdAt
                      ? new Date(exportItem.createdAt).toLocaleString("vi-VN")
                      : "N/A"}
                  </p>
                </div>
                <div
                  className={`p-4 rounded-lg ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}
                >
                  <h4 className="font-semibold mb-1 text-xs opacity-60">Completed At</h4>
                  <p className="text-sm">
                    {exportItem.completedAt
                      ? new Date(exportItem.completedAt).toLocaleString("vi-VN")
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-lg font-medium opacity-60">
                  File chưa sẵn sàng
                </p>
                <p className="text-sm opacity-40 mt-2">
                  Export này chưa có file URL. Trạng thái: {exportItem.status}
                </p>
                {exportItem.errorMessage && (
                  <p className="text-sm text-red-500 mt-3">
                    Lỗi: {exportItem.errorMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex justify-between items-center ${
            isDark ? "border-zinc-700" : "border-gray-200"
          }`}
        >
          {hasFileUrl && exportItem.canDownload && (
            <a
              href={exportItem.fileUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isDark
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-emerald-500 hover:bg-emerald-600 text-white"
              }`}
            >
              Tải xuống
            </a>
          )}
          <button
            onClick={onClose}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ml-auto ${
              isDark
                ? "bg-zinc-800 hover:bg-zinc-700 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-900"
            }`}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
