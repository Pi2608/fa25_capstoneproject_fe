"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Log error to console or error reporting service
    console.error("Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen w-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900/98 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-xl p-8 space-y-6">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Error Content */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold text-white">
            {t("common.error_title") || "Đã xảy ra lỗi"}
          </h1>
          <p className="text-sm text-zinc-400">
            {t("common.error_description") || "Đã xảy ra sự cố không mong muốn. Vui lòng thử lại sau."}
          </p>
          
          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === "development" && error.message && (
            <div className="mt-4 p-3 rounded-md bg-red-900/20 border border-red-800/50">
              <p className="text-xs text-red-400 font-mono break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-zinc-500 mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors border border-zinc-700 hover:border-zinc-600"
          >
            {t("common.error_try_again") || "Thử lại"}
          </button>
          <Link href="/" className="flex-1">
            <button className="w-full px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
              {t("common.go_to_home") || "Về trang chủ"}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

