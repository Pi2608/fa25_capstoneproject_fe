"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/messages";

export default function Footer() {
  const { t, setLang, lang } = useI18n();
  const [email, setEmail] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setEmail("");
  };

  const switchTo = (l: Lang) => setLang(l);

  return (
    <footer className="relative mt-24 text-gray-900 dark:text-gray-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_600px_at_50%_-180px,rgba(16,185,129,0.16),transparent_60%)] dark:bg-[radial-gradient(1200px_600px_at_50%_-180px,rgba(16,185,129,0.12),transparent_60%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(16,185,129,0.08),transparent_35%)] dark:bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06),transparent_35%)]"
      />
      <div className="border-t border-black/10 dark:border-white/10" />

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-emerald-500 shadow" />
              <span className="text-lg font-bold tracking-tight">IMOS</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t("footer", "tagline")}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="#"
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label={t("footer", "twitter")}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M22 5.9c-.7.3-1.4.5-2.2.6.8-.5 1.3-1.1 1.6-2-.8.5-1.7.8-2.6 1-1.6-1.7-4.4-1.1-5.3 1.2-.3.7-.3 1.5-.1 2.2-3.3-.2-6.3-1.7-8.3-4.2-.9 1.6-.4 3.6 1.1 4.7-.6 0-1.2-.2-1.7-.5 0 1.7 1.2 3.2 2.9 3.6-.5.1-1 .1-1.5 0 .4 1.5 1.8 2.6 3.4 2.6-1.3 1-3 1.5-4.6 1.3 1.7 1.1 3.7 1.7 5.7 1.7 6.9 0 10.8-6 10.6-11.4.7-.5 1.3-1.1 1.8-1.8z"
                  />
                </svg>
              </Link>
              <Link
                href="#"
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label={t("footer", "facebook")}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 .5C5.7.5.5 5.7.5 12S5.7 23.5 12 23.5 23.5 18.3 23.5 12 18.3.5 12 .5Zm3.3 7.1h-1.9c-.7 0-.9.3-.9.9v1.7h2.7l-.3 2.7h-2.4V20h-2.8v-5.1H6.9V12h2.1V9.9c0-2 1.1-3.1 3.3-3.1h2.1v2.8Z"
                  />
                </svg>
              </Link>
              <Link
                href="#"
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label={t("footer", "youtube")}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M10 15.5 15.5 12 10 8.5v7ZM21 7.5v9c0 1.7-1.3 3-3 3H6c-1.7 0-3-1.3-3-3v-9c0-1.7 1.3-3 3-3h12c1.7 0 3 1.3 3 3Z"
                  />
                </svg>
              </Link>
              <Link
                href="#"
                className="group inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label={t("footer", "contact")}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M19 3H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"
                  />
                </svg>
              </Link>
            </div>

            <div className="pt-3">
              <span className="block text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                {t("footer", "language")}
              </span>
              <div className="inline-flex rounded-lg ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => switchTo("vi")}
                  aria-pressed={lang === "vi"}
                  className={[
                    "px-3 py-2 text-sm transition",
                    lang === "vi"
                      ? "bg-emerald-500 text-white"
                      : "bg-white/80 dark:bg-white/10 text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-white/15"
                  ].join(" ")}
                >
                  {t("footer", "vi")}
                </button>
                <button
                  type="button"
                  onClick={() => switchTo("en")}
                  aria-pressed={lang === "en"}
                  className={[
                    "px-3 py-2 text-sm transition border-l border-black/10 dark:border-white/10",
                    lang === "en"
                      ? "bg-emerald-500 text-white"
                      : "bg-white/80 dark:bg-white/10 text-gray-900 dark:text-gray-100 hover:bg-white/90 dark:hover:bg-white/15"
                  ].join(" ")}
                >
                  {t("footer", "en")}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 md:col-span-2">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
                {t("footer", "product")}
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li><Link href="/service/map-builder" className="hover:text-emerald-500">{t("footer", "mapBuilder")}</Link></li>
                <li><Link href="/service/export-embed" className="hover:text-emerald-500">{t("footer", "exportEmbed")}</Link></li>
                <li><Link href="/pricing" className="hover:text-emerald-500">{t("footer", "pricing")}</Link></li>
                <li><Link href="/templates" className="hover:text-emerald-500">{t("footer", "templates")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
                {t("footer", "resources")}
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li><Link href="/tutorial" className="hover:text-emerald-500">{t("footer", "tutorial")}</Link></li>
                <li><Link href="/resources/help-center" className="hover:text-emerald-500">{t("footer", "helpCenter")}</Link></li>
                <li><Link href="/resources/blog" className="hover:text-emerald-500">{t("footer", "blog")}</Link></li>
                <li><Link href="/community" className="hover:text-emerald-500">{t("footer", "community")}</Link></li>
              </ul>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
              {t("footer", "newsletter")}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              {t("footer", "newsletterDesc")}
            </p>
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t("footer", "emailPlaceholder")}
                className="w-full rounded-lg px-3 py-2 bg-white/60 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 outline-none focus:ring-emerald-400 text-sm"
                aria-label="Email"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg px-4 py-2 bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition text-sm"
              >
                {t("footer", "subscribe")}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 rounded-2xl bg-white/60 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10 backdrop-blur px-5 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-emerald-500" />
              <span className="font-semibold">IMOS</span>
              <span>© {new Date().getFullYear()}</span>
            </div>
            <nav className="flex items-center gap-5 text-gray-700 dark:text-gray-300">
              <Link href="/resources/help-center" className="hover:text-emerald-500">{t("footer", "help")}</Link>
              <Link href="/resources/blog" className="hover:text-emerald-500">{t("footer", "blog")}</Link>
              <Link href="/privacy" className="hover:text-emerald-500">{t("footer", "privacy")}</Link>
              <Link href="/terms" className="hover:text-emerald-500">{t("footer", "terms")}</Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
