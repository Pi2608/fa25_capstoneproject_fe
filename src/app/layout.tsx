import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Manrope } from "next/font/google";
import LeafletStylesClient from "@/components/LeafletStylesClient";
import { ThemeProvider } from "@/components/ThemeProvider";

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
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${manrope.variable}`}
      suppressHydrationWarning
    >
      <body
        className="
          min-h-screen font-sans antialiased transition-colors
          bg-white text-gray-900
          dark:bg-black dark:text-gray-100
        "
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LeafletStylesClient />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
