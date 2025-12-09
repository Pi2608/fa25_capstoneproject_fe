"use client";

import { useState, FormEvent } from "react";
import { AlertTriangle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportMap, type ReportMapRequest } from "@/lib/api-map-reports";
import { useToast } from "@/contexts/ToastContext";

interface ReportViolationDialogProps {
  mapId: string;
  mapName: string;
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

const REPORT_REASONS = [
  { value: "inappropriate_content", label: "Nội dung không phù hợp" },
  { value: "copyright_violation", label: "Vi phạm bản quyền" },
  { value: "spam", label: "Spam" },
  { value: "misinformation", label: "Thông tin sai lệch" },
  { value: "harassment", label: "Quấy rối" },
  { value: "other", label: "Khác" },
] as const;

export default function ReportViolationDialog({
  mapId,
  mapName,
  isOpen,
  onClose,
  userEmail,
  userName,
}: ReportViolationDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      showToast("error", "Vui lòng chọn lý do báo cáo");
      return;
    }

    setIsSubmitting(true);
    try {
      const request: ReportMapRequest = {
        mapId,
        reason,
        description: description.trim() || undefined,
        reporterEmail: userEmail,
        reporterName: userName,
      };

      await reportMap(request);
      showToast("success", "Đã gửi báo cáo thành công. Cảm ơn bạn đã phản hồi!");
      onClose();
      setReason("");
      setDescription("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể gửi báo cáo";
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Báo cáo vi phạm
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Map: {mapName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Lý do báo cáo <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Chọn lý do --</option>
              {REPORT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Mô tả chi tiết (tùy chọn)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Mô tả chi tiết về vi phạm..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Gửi báo cáo
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

