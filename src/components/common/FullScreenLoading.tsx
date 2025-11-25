interface FullScreenLoadingProps {
  message?: string;
  overlay?: boolean;
}

export function FullScreenLoading({
  message = "Loading...",
  overlay = true,
}: FullScreenLoadingProps) {
  const baseClasses =
    "flex items-center justify-center " +
    (overlay
      ? "fixed inset-0 z-[9999]"
      : "h-screen");

  return (
    <div
      className={`${baseClasses} bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e]`}
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4" />
        <div className="text-zinc-900 dark:text-zinc-100 text-xl">{message}</div>
      </div>
    </div>
  );
}


