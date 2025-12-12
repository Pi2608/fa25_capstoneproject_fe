"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import { useI18n } from "@/i18n/I18nProvider";

type LoadingState = {
  visible: boolean;
  message?: string;
};

type LoadingContextValue = {
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  setLoadingMessage: (message: string) => void;
};

const LoadingContext = createContext<LoadingContextValue | undefined>(
  undefined
);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadingState>({
    visible: false,
    message: "Đang tải...",
  });
  const [isDark, setIsDark] = useState<boolean | undefined>(undefined);

  // Try to get theme from admin context or next-themes
  useEffect(() => {
    const updateTheme = () => {
      if (typeof window === "undefined") return;
      
      // Priority 1: Check admin theme (for admin section)
      const adminTheme = localStorage.getItem("admin-theme");
      if (adminTheme) {
        setIsDark(adminTheme === "dark");
        return;
      }
      
      // Priority 2: Check next-themes (for profile section)
      const nextTheme = localStorage.getItem("theme");
      if (nextTheme) {
        // next-themes can store "light", "dark", or "system"
        if (nextTheme === "dark") {
          setIsDark(true);
          return;
        } else if (nextTheme === "light") {
          setIsDark(false);
          return;
        }
        // If "system", fall through to system preference check
      }
      
      // Priority 3: Check system preference
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(prefersDark);
    };

    // Initial theme check
    updateTheme();

    // Listen for storage changes (when theme is toggled)
    if (typeof window !== "undefined") {
      window.addEventListener("storage", updateTheme);
      
      // Listen for custom events from admin and profile sections
      const handleAdminThemeChange = () => updateTheme();
      const handleNextThemeChange = () => updateTheme();
      
      window.addEventListener("admin-theme-change", handleAdminThemeChange);
      // next-themes also fires storage event, but we can listen for it specifically
      window.addEventListener("theme-change", handleNextThemeChange);

      return () => {
        window.removeEventListener("storage", updateTheme);
        window.removeEventListener("admin-theme-change", handleAdminThemeChange);
        window.removeEventListener("theme-change", handleNextThemeChange);
      };
    }
  }, []);

  const showLoading = useCallback((message?: string) => {
    // Re-check theme when showing loading to ensure it's up to date
    if (typeof window !== "undefined") {
      // Priority 1: Check admin theme
      const adminTheme = localStorage.getItem("admin-theme");
      if (adminTheme) {
        setIsDark(adminTheme === "dark");
      } else {
        // Priority 2: Check next-themes
        const nextTheme = localStorage.getItem("theme");
        if (nextTheme === "dark") {
          setIsDark(true);
        } else if (nextTheme === "light") {
          setIsDark(false);
        } else {
          // Priority 3: System preference
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          setIsDark(prefersDark);
        }
      }
    }
    
    setState({
      visible: true,
      message: message ?? "Đang tải...",
    });
  }, []);

  const hideLoading = useCallback(() => {
    setState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const setLoadingMessage = useCallback((message: string) => {
    setState((prev) => ({
      visible: prev.visible,
      message,
    }));
  }, []);

  const value = useMemo(
    () => ({
      showLoading,
      hideLoading,
      setLoadingMessage,
    }),
    [showLoading, hideLoading, setLoadingMessage]
  );

  function LoadingUI() {
    const { t } = useI18n();
    const { resolvedTheme, theme } = useTheme();
    // Use manually detected theme first, fallback to next-themes
    const currentTheme = (isDark !== undefined 
      ? (isDark ? "dark" : "light")
      : (resolvedTheme ?? theme ?? "light")) as "light" | "dark";
    const finalIsDark = currentTheme === "dark";
    const themeClasses = getThemeClasses(finalIsDark);
    const messageToDisplay = state.message ?? t("common.loading");

    return (
      <div className={`flex items-center justify-center fixed inset-0 z-[9999] ${themeClasses.loading.background}`}>
        <div className="flex flex-col items-center gap-4">
          <div className={`h-12 w-12 animate-spin rounded-full border-4 ${finalIsDark ? "border-emerald-400" : "border-emerald-500"} border-t-transparent`}></div>
          <p className={`text-sm font-medium ${themeClasses.loading.text}`}>
            {messageToDisplay}
          </p>
        </div>
      </div>
    );
  }

  const portal =
    typeof document !== "undefined" && state.visible && document.getElementById("modal-root")
      ? createPortal(<LoadingUI />, document.getElementById("modal-root")!)
      : null;

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {portal}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return ctx;
}


