"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  variant?: "danger" | "warning" | "info";
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  variant = "danger",
}: ConfirmModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  if (!open) return null;

  const variantStyles = {
    danger: {
      icon: "bg-red-500/20",
      iconColor: "text-red-400",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: "bg-yellow-500/20",
      iconColor: "text-yellow-400",
      button: "bg-yellow-600 hover:bg-yellow-700 text-white",
    },
    info: {
      icon: "bg-blue-500/20",
      iconColor: "text-blue-400",
      button: "bg-blue-600 hover:bg-blue-700 text-white",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/80">
          <div className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${styles.icon}`}>
            <AlertTriangle className={`h-5 w-5 ${styles.iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-zinc-100">
              {title}
            </h3>
          </div>
          <button
            onClick={() => onOpenChange(false)}
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
        {description && (
          <div className="px-6 py-4">
            <p className="text-sm text-zinc-400">{description}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/70 border-t border-zinc-800/80">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg transition-colors ${styles.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
