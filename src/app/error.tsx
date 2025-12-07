"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  useEffect(() => {
    // Log error to console or error reporting service
    console.error("Error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className={`max-w-md w-full mx-4 text-center space-y-6 p-8 rounded-xl border ${themeClasses.panel}`}>
        <div className="space-y-2">
          <div className="text-6xl font-bold text-red-500">⚠️</div>
          <h1 className={`text-2xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
            {t("common.error_title")}
          </h1>
          <p className={`text-sm ${themeClasses.textMuted}`}>
            {t("common.error_description")}
          </p>
          {process.env.NODE_ENV === "development" && error.message && (
            <p className={`text-xs mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ${isDark ? "" : ""}`}>
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className={`px-6 py-2 rounded-lg border text-sm font-medium ${themeClasses.button}`}
          >
            {t("common.error_try_again")}
          </button>
          <Link href="/">
            <button className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
              {t("common.go_to_home")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

