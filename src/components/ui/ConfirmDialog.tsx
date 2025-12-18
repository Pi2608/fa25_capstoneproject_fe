"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  itemName?: string;
  itemType?: string;
  relatedItems?: {
    label: string;
    count: number;
  }[];
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
  itemName,
  itemType,
  relatedItems,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const result = onConfirm();

      if (result instanceof Promise) {
        await result;
      }

      onClose();
    } catch (error) {
      console.error("Confirm action failed:", error);
      // Don't close on error - let parent handle it
    } finally {
      setIsLoading(false);
    }
  };

  const headerTitle = title ?? t("common.confirm_delete_title", { itemType: itemType ?? t("common.confirm_dialog_item") });
  const primaryMessage = message ?? t("common.confirm_delete_message");
  const confirmButtonText = confirmText ?? t("common.delete");
  const cancelButtonText = cancelText ?? t("common.cancel");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-red-600 dark:text-red-400"
            >
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              {headerTitle}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{primaryMessage}</p>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          {itemName && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("common.confirm_delete_named", { itemType: itemType ?? t("common.confirm_dialog_item"), itemName })}
            </p>
          )}

          {/* Related items display */}
          {relatedItems && relatedItems.length > 0 && (
            <div className="mt-3 p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t("common.affected_items")}:
              </p>
              <ul className="space-y-1">
                {relatedItems.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                    <span>
                      {item.count} {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {t("common.cannot_undo")}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-200 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-500 dark:bg-red-600 dark:hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isLoading ? t("common.deleting") : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
