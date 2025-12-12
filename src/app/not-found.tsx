"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen w-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900/98 backdrop-blur-sm border border-zinc-800 rounded-lg shadow-xl p-8 space-y-6">
        {/* 404 Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
        </div>

        {/* 404 Content */}
        <div className="text-center space-y-3">
          <div className="text-6xl font-bold text-emerald-500/80">404</div>
          <h1 className="text-2xl font-semibold text-white">
            {t("common.page_not_found_title") || "Trang không tìm thấy"}
          </h1>
          <p className="text-sm text-zinc-400">
            {t("common.page_not_found_description") || 
              "Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển."}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-3">
          <Link href="/" className="w-full">
            <button className="w-full px-4 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
              {t("common.go_to_home") || "Về trang chủ"}
            </button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full px-4 py-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-colors border border-zinc-700 hover:border-zinc-600"
          >
            {t("common.go_back") || "Quay lại"}
          </button>
        </div>
      </div>
    </div>
  );
}

