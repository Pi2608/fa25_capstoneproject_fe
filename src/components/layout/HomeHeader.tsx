"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useI18n } from "@/i18n/I18nProvider";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getJson } from "@/lib/api-core";
import { useToast } from "@/contexts/ToastContext";

type MenuItem = { label: string; desc?: string; href: string };

type MeResponse = {
  user?: {
    accountStatus?: string;
  };
};

function NavDropdown({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState<boolean>(false);
  const [canHover, setCanHover] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef<boolean>(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => setCanHover(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLDivElement>("[data-menu]");
    if (!el) return;
    if (isFirstRender.current) {
      gsap.set(el, { autoAlpha: 0, y: -8, scale: 0.98 });
      isFirstRender.current = false;
      return;
    }
    if (open) {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: -8, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: reduceMotion ? 0 : 0.2, ease: "power2.out" }
      );
    } else {
      gsap.to(el, { autoAlpha: 0, y: -8, scale: 0.98, duration: reduceMotion ? 0 : 0.15, ease: "power1.in" });
    }
  }, [open, reduceMotion]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-100 font-semibold hover:text-emerald-600 dark:hover:text-emerald-400 transition"
      >
        {label}
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
        </svg>
      </button>

      <div
        data-menu
        role="menu"
        tabIndex={-1}
        style={{ opacity: 0, visibility: "hidden" }}
        className={`${open ? "pointer-events-auto" : "pointer-events-none"} absolute left-1/2 -translate-x-1/2 mt-4 w-[640px] max-w-[90vw] rounded-2xl p-4 md:p-5 backdrop-blur-md shadow-2xl bg-white/80 ring-1 ring-black/10 dark:bg-zinc-900/90 dark:ring-white/10`}
        onMouseEnter={() => canHover && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="group flex items-start gap-3 rounded-xl p-3 md:p-4 hover:bg-emerald-50 dark:hover:bg-white/10 transition"
              onClick={() => setOpen(false)}
            >
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true">
                  <path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v5l4 2-.7 1.2L11 13V7h2Z" />
                </svg>
              </span>
              <div className="leading-tight">
                <div className="text-[15px] md:text-[16px] font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  {it.label}
                </div>
                {it.desc && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{it.desc}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeHeader() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();
  const { t } = useI18n();
  const toastApi = useToast() as unknown as {
    showToast?: (message: string, type?: "success" | "error" | "info" | "warning") => void;
    addToast?: (t: { message: string; type?: "success" | "error" | "info" | "warning"; title?: string }) => void;
    notify?: (t: { message: string; variant?: string; title?: string }) => void;
  };

  const [isHydrated, setIsHydrated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

  const showSuspendedToast = useCallback(() => {
    const title = t("profilelayout.toast_warning_title");
    const message = t("profilelayout.account_suspended_toast");

    if (typeof (toastApi as any)?.addToast === "function") {
      (toastApi as any).addToast({ title, message, type: "warning" });
      return;
    }

    if (typeof (toastApi as any)?.showToast === "function") {
      (toastApi as any).showToast(message, "warning");
      return;
    }

    if (typeof (toastApi as any)?.notify === "function") {
      (toastApi as any).notify({ title, message, variant: "warning" });
      return;
    }

    alert(message);
  }, [t, toastApi]);

  const onClickProfile = useCallback(async () => {
    if (!isLoggedIn) return;
    if (checkingProfile) return;

    setCheckingProfile(true);
    try {
      const me = await getJson<MeResponse>("/user/me");
      const status = me?.user?.accountStatus;

      if (status === "Suspended") {
        showSuspendedToast();
        router.push("/profile/help");
      } else {
        router.push("/profile/information");
      }
    } catch {
      router.push("/profile/information");
    } finally {
      setCheckingProfile(false);
    }
  }, [isLoggedIn, checkingProfile, router, showSuspendedToast]);

  const SERVICES: MenuItem[] = [
    { label: t("header", "svc_builder"), desc: t("header", "svc_builder_desc"), href: "/service/map-builder" },
    { label: t("header", "svc_layers"), desc: t("header", "svc_layers_desc"), href: "/service/data-layers" },
    { label: t("header", "svc_export"), desc: t("header", "svc_export_desc"), href: "/service/export-embed" },
  ];

  const RESOURCES: MenuItem[] = [
    { label: t("header", "res_help"), desc: t("header", "res_help_desc"), href: "/resources/help-center" },
    { label: t("header", "res_gallery"), desc: t("header", "res_gallery_desc"), href: "/resources/map-gallery" },
    { label: t("header", "res_blog"), desc: t("header", "res_blog_desc"), href: "/resources/blog" },
  ];

  return (
    <header className="sticky top-0 z-40">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 -z-10 bg-gradient-to-b from-black/60 to-transparent"
      />

      <div className="max-w-7xl mx-auto px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-1.5 xs:gap-2">
          <div className="h-5 w-5 xs:h-6 xs:w-6 rounded-md bg-emerald-500 shadow" />
          <span className="text-base xs:text-lg md:text-xl font-bold tracking-tight">IMOS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <NavDropdown label={t("header", "services")} items={SERVICES} />
          <Link
            href="/tutorial"
            className="font-semibold text-gray-700 hover:text-emerald-600 dark:text-gray-200 dark:hover:text-emerald-400 transition"
          >
            {t("header", "tutorial")}
          </Link>
          <Link
            href="/pricing"
            className="font-semibold text-gray-700 hover:text-emerald-600 dark:text-gray-200 dark:hover:text-emerald-400 transition"
          >
            {t("header", "pricing")}
          </Link>
          <NavDropdown label={t("header", "resources")} items={RESOURCES} />
          <Link
            href="/community"
            className="font-semibold text-gray-700 hover:text-emerald-600 dark:text-gray-200 dark:hover:text-emerald-400 transition"
          >
            {t("header", "community")}
          </Link>
        </nav>

        {/* Mobile Menu */}
        <div className="md:hidden flex items-center gap-2">
          {!isHydrated ? (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center">
              <div className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" />
            </div>
          ) : (
            <>
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={onClickProfile}
                  disabled={checkingProfile}
                  className="text-xs xs:text-sm px-2 xs:px-3 py-1.5 xs:py-2 rounded-lg bg-emerald-500 font-semibold text-white shadow hover:bg-emerald-400 transition disabled:opacity-60"
                >
                  {t("header", "profile")}
                </button>
              )}

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 xs:h-9 xs:w-9">
                    <Menu className="h-4 w-4 xs:h-5 xs:w-5" />
                  </Button>
                </SheetTrigger>

                <SheetContent side="right" className="w-[280px] xs:w-[320px] p-0 [&>button]:hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 xs:p-6 space-y-6">
                      {/* Logo */}
                      <div className="flex items-center gap-2 pb-4 border-b">
                        <div className="h-6 w-6 rounded-md bg-emerald-500 shadow" />
                        <span className="text-lg font-bold tracking-tight">IMOS</span>
                      </div>

                      {/* Services Section */}
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                          {t("header", "services")}
                        </h3>
                        <div className="space-y-1">
                          {SERVICES.map((it) => (
                            <Link
                              key={it.href}
                              href={it.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="block px-3 py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-white/10 transition"
                            >
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">{it.label}</div>
                              {it.desc && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{it.desc}</p>}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Main Links */}
                      <div className="space-y-1">
                        <Link
                          href="/tutorial"
                          onClick={() => setMobileMenuOpen(false)}
                          className="block px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-50 dark:hover:bg-white/10 transition"
                        >
                          {t("header", "tutorial")}
                        </Link>
                        <Link
                          href="/pricing"
                          onClick={() => setMobileMenuOpen(false)}
                          className="block px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-50 dark:hover:bg-white/10 transition"
                        >
                          {t("header", "pricing")}
                        </Link>
                        <Link
                          href="/community"
                          onClick={() => setMobileMenuOpen(false)}
                          className="block px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-50 dark:hover:bg-white/10 transition"
                        >
                          {t("header", "community")}
                        </Link>
                      </div>

                      {/* Resources Section */}
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                          {t("header", "resources")}
                        </h3>
                        <div className="space-y-1">
                          {RESOURCES.map((it) => (
                            <Link
                              key={it.href}
                              href={it.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className="block px-3 py-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-white/10 transition"
                            >
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">{it.label}</div>
                              {it.desc && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{it.desc}</p>}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Auth Buttons */}
                      {!isLoggedIn ? (
                        <div className="space-y-2 pt-4 border-t">
                          <Link
                            href="/login"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block w-full text-center rounded-lg px-4 py-2.5 font-semibold border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition"
                          >
                            {t("header", "login")}
                          </Link>
                          <Link
                            href="/register"
                            onClick={() => setMobileMenuOpen(false)}
                            className="block w-full text-center rounded-lg bg-emerald-500 px-4 py-2.5 font-bold text-white shadow hover:bg-emerald-400 transition"
                          >
                            {t("header", "getStarted")}
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-2 pt-4 border-t">
                          <button
                            type="button"
                            disabled={checkingProfile}
                            onClick={async () => {
                              setMobileMenuOpen(false);
                              await onClickProfile();
                            }}
                            className="block w-full text-center rounded-lg bg-emerald-500 px-4 py-2.5 font-bold text-white shadow hover:bg-emerald-400 transition disabled:opacity-60"
                          >
                            {t("header", "profile")}
                          </button>

                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              onLogout();
                            }}
                            className="block w-full text-center rounded-lg px-4 py-2.5 font-semibold border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                          >
                            {t("header", "logout")}
                          </button>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {!isHydrated ? (
            <>
              <div className="h-10 min-w-[70px] rounded-lg dark:border-gray-600 flex items-center justify-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <div className="h-10 min-w-[100px] rounded-lg bg-emerald-500/60 dark:bg-emerald-500/40 shadow flex items-center justify-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 animate-in fade-in duration-500">
              {!isLoggedIn ? (
                <>
                  <Link
                    href="/login"
                    className="min-w-[70px] text-center rounded-lg px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-700 hover:text-emerald-600 dark:text-gray-200 dark:hover:text-emerald-400 transition"
                  >
                    {t("header", "login")}
                  </Link>
                  <Link
                    href="/register"
                    className="min-w-[100px] text-center rounded-lg bg-emerald-500 px-4 lg:px-5 py-2 text-sm lg:text-base font-bold text-white shadow hover:bg-emerald-400 transition"
                  >
                    {t("header", "getStarted")}
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClickProfile}
                    disabled={checkingProfile}
                    className="min-w-[70px] text-center rounded-lg bg-emerald-500 px-4 lg:px-5 py-2 text-sm lg:text-base font-bold text-white shadow hover:bg-emerald-400 transition disabled:opacity-60"
                  >
                    {t("header", "profile")}
                  </button>

                  <button
                    onClick={onLogout}
                    className="min-w-[70px] text-center rounded-lg px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-700 hover:text-red-500 dark:text-gray-200 dark:hover:text-red-400 transition"
                  >
                    {t("header", "logout")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
