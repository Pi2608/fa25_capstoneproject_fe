"use client";

import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "./Footer";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* <Header /> */}
      {children}
      <Footer/>
    </>
  );
}
