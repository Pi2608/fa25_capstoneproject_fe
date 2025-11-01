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

  // Align behavior with DeleteConfirmModal: include "Don't ask again" option
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 rounded-lg shadow-2xl border border-zinc-700 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-700">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-red-400"
            >
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{headerTitle}</h3>
            <p className="text-sm text-zinc-400">{primaryMessage}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {itemName && (
            <p className="text-sm text-zinc-300">
              Are you sure you want to delete <span className="font-semibold text-white">"{itemName}"</span>?
            </p>
          )}
          {!itemName && (
            <p className="text-sm text-zinc-300">
              Are you sure you want to delete this {itemType}?
            </p>
          )}

          {/* Don't ask again checkbox */}
          <div className="mt-4 flex items-start gap-2">
            <input
              type="checkbox"
              id="dontAskAgain"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="dontAskAgain" className="text-sm text-zinc-400 cursor-pointer select-none">
              Don't ask me again (you can re-enable this in settings)
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-800/50 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
