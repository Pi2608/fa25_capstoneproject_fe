"use client";

import { useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  itemName?: string;
  itemType?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  variant = "danger",
  itemName,
  itemType = "item",
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    if (dontAskAgain) {
      localStorage.setItem("skipDeleteConfirm", "true");
    }
    onConfirm();
    onClose();
  };

  const headerTitle = title ?? `Delete ${itemType}`;
  const primaryMessage = message ?? "This action cannot be undone";

  const variantClasses = {
    danger: {
      iconWrapper: "bg-red-500/20",
      iconColor: "text-red-400",
      titleColor: "text-red-100",
      confirmBtn:
        "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500/70",
      checkboxAccent: "text-red-600 focus:ring-red-500",
    },
    warning: {
      iconWrapper: "bg-amber-500/20",
      iconColor: "text-amber-300",
      titleColor: "text-amber-100",
      confirmBtn:
        "bg-amber-500 hover:bg-amber-400 text-zinc-900 focus-visible:ring-amber-400/80",
      checkboxAccent: "text-amber-500 focus:ring-amber-500",
    },
    info: {
      iconWrapper: "bg-sky-500/20",
      iconColor: "text-sky-300",
      titleColor: "text-sky-100",
      confirmBtn:
        "bg-sky-600 hover:bg-sky-500 focus-visible:ring-sky-500/70",
      checkboxAccent: "text-sky-500 focus:ring-sky-500",
    },
  }[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/80">
          <div
            className={
              "flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full " +
              variantClasses.iconWrapper
            }
          >
            {variant === "danger" && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={variantClasses.iconColor}
              >
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
              </svg>
            )}
            {variant === "warning" && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={variantClasses.iconColor}
              >
                <path d="M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            )}
            {variant === "info" && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={variantClasses.iconColor}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01" />
                <path d="M11 12h1v4h1" />
              </svg>
            )}
          </div>

          <div className="flex-1">
            <h3 className={`text-[15px] font-semibold leading-snug ${variantClasses.titleColor}`}>
              {headerTitle}
            </h3>
            <p className="text-sm text-zinc-400">{primaryMessage}</p>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
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
        <div className="px-6 py-4 text-sm">
          {itemName ? (
            <p className="text-zinc-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">"{itemName}"</span>?
            </p>
          ) : (
            <p className="text-zinc-300">
              Are you sure you want to delete this {itemType}?
            </p>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/70 border-t border-zinc-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={
              "px-4 py-2 rounded-md text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 " +
              variantClasses.confirmBtn
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
