// src/components/ClientShell.tsx
"use client";

import type { ReactNode } from "react";
import Header from "@/components/Header";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
