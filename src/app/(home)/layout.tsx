import type { Metadata } from "next";
import { ImosBg, RevealOnScroll } from "@/components/common";
import { HomeHeader, Footer } from "@/components/layout";

export const metadata: Metadata = {
  title: "IMOS",
  description: "Interactive mapping made simple",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-zinc-100">
      <ImosBg />
      <RevealOnScroll />
      <HomeHeader />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
