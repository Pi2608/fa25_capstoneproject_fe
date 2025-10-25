"use client";

import { SubmitButtonProps } from "@/types/auth";

export default function SubmitButton({
  loading,
  disabled = false,
  children,
  className = ""
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className={`w-full bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {loading ? "Loading…" : children}
    </button>
  );
}
