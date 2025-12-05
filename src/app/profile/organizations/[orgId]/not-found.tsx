"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

export default function OrganizationNotFound() {
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className={`max-w-md w-full mx-4 text-center space-y-6 p-8 rounded-xl border ${themeClasses.panel}`}>
        <div className="space-y-2">
          <div className="text-6xl font-bold text-emerald-500">404</div>
          <h1 className={`text-2xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
            {t("organization.not_found_title")}
          </h1>
          <p className={`text-sm ${themeClasses.textMuted}`}>
            {t("organization.not_found_description")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/profile/information">
            <button className={`w-full sm:w-auto px-4 py-2 rounded-lg border text-sm font-medium ${themeClasses.button}`}>
              {t("organization.go_to_profile")}
            </button>
          </Link>
          <Link href="/register/organization">
            <button className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
              {t("organization.create_new")}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
