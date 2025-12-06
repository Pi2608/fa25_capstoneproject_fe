import { useI18n } from "@/i18n/I18nProvider";
import { getThemeClasses } from "@/utils/theme-utils";

interface FullScreenLoadingProps {
  message?: string;
  overlay?: boolean;
  isDark?: boolean;
}

export function FullScreenLoading({
  message,
  overlay = true,
  isDark,
}: FullScreenLoadingProps) {
  const { t } = useI18n();
  const messageToDisplay = message ?? t("common.loading");
  const baseClasses =
    "flex items-center justify-center " +
    (overlay
      ? "fixed inset-0 z-[9999]"
      : "h-screen");

  // Use theme classes if isDark is provided, otherwise fallback to dark: classes
  const theme = isDark !== undefined ? getThemeClasses(isDark) : null;
  
  // Choose background based on overlay mode
  let backgroundClasses: string;
  if (theme) {
    if (overlay) {
      // Full screen overlay - use gradient background
      backgroundClasses = theme.loading.background;
    } else {
      // Non-overlay (inside panel) - use semi-transparent overlay for contrast
      backgroundClasses = theme.loading.backgroundNonOverlay;
    }
  } else {
    // Fallback to default classes
    backgroundClasses = overlay
      ? "bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]"
      : "bg-white/90 backdrop-blur-sm dark:bg-zinc-800/80";
  }
  
  const textClasses = theme
    ? theme.loading.text
    : "text-zinc-900 dark:text-zinc-100";
  const spinnerClasses = theme
    ? theme.loading.spinner
    : "border-emerald-500";

  return (
    <div className={`${baseClasses} ${backgroundClasses}`} suppressHydrationWarning>
      <div className="text-center">
        <div className={`animate-spin rounded-full h-16 w-16 border-b-2 ${spinnerClasses} mx-auto mb-4`} suppressHydrationWarning />
        <div className={`${textClasses} text-xl`} suppressHydrationWarning>{messageToDisplay}</div>
      </div>
    </div>
  );
}


