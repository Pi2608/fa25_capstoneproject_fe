import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/common";
import { ToastProvider } from "@/contexts/ToastContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ToastContainer from "@/components/ui/ToastContainer";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/messages";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { LeafletStylesBoundary } from "@/components/map-editor/LeafletStylesBoundary";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "IMOS",
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
  const initialLang: Lang = "vi";

  return (
    <html lang={initialLang} className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased transition-colors bg-white text-gray-900 dark:bg-black dark:text-gray-100">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <I18nProvider initialLang={initialLang}>
                <LoadingProvider>
                  <LeafletStylesBoundary />
                  {children}
                  <ToastContainer />
                </LoadingProvider>
              </I18nProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
