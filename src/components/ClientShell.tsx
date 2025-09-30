"use client";

import type { ReactNode } from "react";
import Footer from "./Footer";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Footer/>
    </>
  );
}
