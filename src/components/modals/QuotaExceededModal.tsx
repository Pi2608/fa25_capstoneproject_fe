"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotaType: "maps" | "exports" | "users";
  current?: number;
  limit?: number;
  message?: string;
  isOwner: boolean;
  orgId: string;
}

export default function QuotaExceededModal({
  isOpen,
  onClose,
  quotaType,
  current,
  limit,
  message,
  isOwner,
  orgId,
}: QuotaExceededModalProps) {
  const { t } = useI18n();
  const router = useRouter();

  if (!isOpen) return null;

  const quotaTypeLabel = {
    maps: t("common.quota_maps"),
    exports: t("common.quota_exports"),
    users: t("common.quota_users"),
  }[quotaType];

  const handleUpgrade = () => {
    router.push(`/profile/settings/plans?orgId=${orgId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-600 tracking-tight"
            >
              <path d="M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              {t("common.quota_exceeded_title")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {quotaTypeLabel} {t("common.quota_limit_reached")}
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {current !== undefined && limit !== undefined && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
              <p className="text-sm text-amber-800 tracking-tight">
                {t("common.quota_usage_info", {
                  current,
                  limit,
                  type: quotaTypeLabel,
                })}
              </p>
            </div>
          )}

          {isOwner ? (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("common.quota_owner_message")}
            </p>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("common.quota_member_message")}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {t("common.close")}
          </button>
          {isOwner && (
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
            >
              {t("common.upgrade_plan")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
