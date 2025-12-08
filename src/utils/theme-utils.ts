export function getThemeClasses(isDark: boolean) {
  return {
    panel: isDark
      ? "bg-zinc-900/98 border-zinc-800"
      : "bg-white border-gray-200",
    kpiCard: isDark
      ? "bg-zinc-900/98 border-zinc-800"
      : "bg-white border-gray-200",
    input: isDark
      ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
      : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400",
    select: isDark
      ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
      : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400",
    tableBorder: isDark ? "border-zinc-800" : "border-gray-200",
    tableHeader: isDark
      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
      : "border-gray-200 bg-gray-50 text-gray-600",
    tableCell: isDark ? "border-zinc-800" : "border-gray-200",
    textMuted: isDark ? "text-zinc-400" : "text-gray-900",
    button: isDark
      ? "border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
      : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
    // Additional classes for map editor components
    sidebar: isDark
      ? "bg-zinc-950/98 backdrop-blur-sm border-zinc-800/80"
      : "bg-white/98 backdrop-blur-sm border-gray-200",
    sidebarHeader: isDark
      ? "bg-zinc-950/50 border-zinc-800/80"
      : "bg-gray-50/50 border-gray-200",
    badge: isDark
      ? "bg-zinc-800 text-zinc-400"
      : "bg-gray-100 text-gray-900",
    hover: isDark
      ? "hover:bg-zinc-800/50"
      : "hover:bg-gray-100",
    hoverStrong: isDark
      ? "hover:bg-zinc-800"
      : "hover:bg-gray-200",
    iconMuted: isDark ? "text-zinc-400" : "text-gray-900",
    iconDefault: isDark ? "text-zinc-300" : "text-gray-900",
    loading: {
      background: isDark
        ? "bg-gradient-to-b from-zinc-800/98 via-zinc-700/95 to-zinc-800/98 backdrop-blur-md"
        : "bg-gradient-to-b from-emerald-50 via-white to-emerald-50",
      backgroundOverlay: isDark
        ? "bg-black/50 backdrop-blur-sm"
        : "bg-white/90 backdrop-blur-sm",
      backgroundNonOverlay: isDark
        ? "bg-zinc-700/95 backdrop-blur-md"
        : "bg-gray-100/95 backdrop-blur-sm border border-gray-200",
      text: isDark ? "text-zinc-100" : "text-gray-900",
      spinner: isDark ? "border-emerald-400" : "border-emerald-500",
    },
  };
}
