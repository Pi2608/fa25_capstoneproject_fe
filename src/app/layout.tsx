import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Manrope } from "next/font/google";
import LeafletStylesClient from "@/components/LeafletStylesClient";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "CustomMapOSM",
  description: "Create • Customize • Export maps",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`h-full ${manrope.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-black text-white antialiased font-sans">
        <LeafletStylesClient />
        {children}
      </body>
    </html>
  );
}
