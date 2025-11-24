"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface SessionShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  sessionId?: string;
  mapId: string;
}

export function SessionShareModal({
  isOpen,
  onClose,
  sessionCode,
  sessionId,
  mapId,
}: SessionShareModalProps) {
  const [shareType, setShareType] = useState<"link" | "qr">("link");
  
  // Get origin safely (handle SSR)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  
  // Join link with code (for students to enter code)
  const joinLinkWithCode = `${origin}/session/join`;
  
  // Join link with QR (for students to scan and enter name only)
  const joinLinkWithQR = `${origin}/session/join?code=${sessionCode}`;

  // QR code URL using an online QR code API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinLinkWithQR)}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You can add a toast notification here
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl z-50 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Chia sẻ Session
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Học sinh có thể tham gia session bằng cách sử dụng link hoặc QR code
          </Dialog.Description>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-zinc-800">
            <button
              onClick={() => setShareType("link")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                shareType === "link"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              Link (Nhập code)
            </button>
            <button
              onClick={() => setShareType("qr")}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                shareType === "qr"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              QR Code (Chỉ nhập tên)
            </button>
          </div>

          {/* Link Share */}
          {shareType === "link" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Session Code:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sessionCode}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-white font-mono text-lg font-semibold tracking-wider text-center"
                  />
                  <button
                    onClick={() => copyToClipboard(sessionCode)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Copy Code
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Học sinh truy cập link dưới đây và nhập code này
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link tham gia:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinLinkWithCode}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(joinLinkWithCode)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QR Code Share */}
          {shareType === "qr" && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Học sinh quét QR code này sẽ được chuyển tới trang nhập tên (không cần nhập code)
                </p>
                <div className="bg-white p-4 rounded-lg inline-block border-2 border-gray-200 dark:border-zinc-700">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code for session join"
                    className="w-64 h-64"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link từ QR code:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinLinkWithQR}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(joinLinkWithQR)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <button className="px-6 py-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors">
                Đóng
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

