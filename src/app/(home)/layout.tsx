import type { Metadata } from "next";
import ImosBg from "@/components/ImosBg";
import RevealOnScroll from "@/components/RevealOnScroll";
import HomeHeader from "@/components/HomeHeader";
import Footer from "@/components/Footer";

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
