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
    <div 
      className={`fixed inset-0 z-[5000] flex items-center justify-center ${themeClasses.loading.backgroundOverlay}`}
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Main spinner with pulsing effect */}
        <div className="relative">
          {/* Outer pulsing ring */}
          <div
            className={`absolute inset-0 rounded-full animate-ping ${
              isDark ? "bg-emerald-400/20" : "bg-emerald-500/20"
            }`}
            style={{ animationDuration: "2s" }}
          />
          
          {/* Main spinner */}
          <div className="relative">
            <div
              className={`h-16 w-16 animate-spin rounded-full border-4 ${
                isDark
                  ? "border-emerald-400/30 border-t-emerald-400"
                  : "border-emerald-500/30 border-t-emerald-600"
              }`}
              style={{ animationDuration: "0.8s" }}
            />
            
            {/* Inner accent circle */}
            <div
              className={`absolute inset-2 rounded-full border-2 ${
                isDark
                  ? "border-emerald-400/50 border-r-transparent"
                  : "border-emerald-500/50 border-r-transparent"
              } animate-spin`}
              style={{ animationDuration: "1.2s", animationDirection: "reverse" }}
            />
          </div>
        </div>

        {/* Loading text with fade animation */}
        <div className="flex flex-col items-center gap-2">
          <p
            className={`text-base font-semibold ${themeClasses.loading.text} animate-pulse`}
            style={{ animationDuration: "1.5s" }}
          >
            {t("common.loading")}
          </p>
          
          {/* Loading dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  isDark ? "bg-emerald-400" : "bg-emerald-500"
                } animate-bounce`}
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "0.8s",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

