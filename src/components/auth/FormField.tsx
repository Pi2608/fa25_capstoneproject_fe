"use client";

import { ReactNode } from "react";
import { FormFieldProps } from "@/types/auth";

export default function FormField({ children, error, className = "" }: FormFieldProps) {
  return (
    <div className={className}>
      {children}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
