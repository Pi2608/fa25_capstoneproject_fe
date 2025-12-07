"use client";

import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import { useI18n } from "@/i18n/I18nProvider";

export default function Loading() {
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  return (
    <div className={`flex items-center justify-center min-h-screen ${themeClasses.loading.background}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`h-12 w-12 animate-spin rounded-full border-4 ${isDark ? "border-emerald-400" : "border-emerald-500"} border-t-transparent`}></div>
        <p className={`text-sm font-medium ${themeClasses.loading.text}`}>
          {t("common.loading")}
        </p>
      </div>
    </div>
  );
}

