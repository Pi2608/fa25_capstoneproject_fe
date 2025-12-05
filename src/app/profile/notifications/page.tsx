"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  getUserNotifications,
  GetUserNotificationsResponse,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NotificationItem,
} from "@/lib/api-user";
import { useI18n } from "@/i18n/I18nProvider";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

function fmtTime(iso: string | undefined, locale: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  try {
    return d.toLocaleString(locale === "en" ? "en-US" : "vi-VN", {
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

function typeLabel(type: string | undefined, tr: (k: string) => string) {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes("transaction_completed")) return tr("type_transaction_completed");
  if (t.includes("payment") && t.includes("success")) return tr("type_payment_success");
  if (t.includes("subscription") && (t.includes("processed") || t.includes("active"))) return tr("type_subscription_active");
  return undefined;
}

function translateMessageToVi(item: NotificationItem): string {
  const msg = (item.message ?? "").trim();
  const type = (item.type ?? "").toLowerCase();

  {
    const r = /payment of\s*\$?\s*([\d.,]+)\s*for\s*(.+?)\s*plan\s*completed\s*successfully/i.exec(msg);
    if (r) {
      const amount = r[1];
      const plan = r[2].trim();
      return `Thanh toán $${amount} cho gói ${plan} đã hoàn tất.`;
    }
  }

  {
    const r = /your payment of\s*\$?\s*([\d.,]+)\s*for\s*(.+?)\s*subscription\s*has been processed successfully\.?\s*your membership is now active\.?/i.exec(msg);
    if (r) {
      const amount = r[1];
      const plan = r[2].trim();
      return `Thanh toán $${amount} cho đăng ký gói ${plan} đã được xử lý thành công. Tư cách thành viên của bạn đã được kích hoạt.`;
    }
  }

  if (type.includes("transaction_completed")) {
    const money = /\$[\d.,]+/.exec(msg)?.[0] ?? "";
    const plan = /\b(Pro|Basic|Enterprise|Starter|Plan)\b/i.exec(msg)?.[0] ?? "";
    if (money || plan) {
      return `Thanh toán ${money ? money + " " : ""}${plan ? "cho gói " + plan + " " : ""}đã hoàn tất.`;
    }
    return "Giao dịch của bạn đã hoàn tất.";
  }

  if (type.includes("subscription") && (type.includes("processed") || type.includes("active"))) {
    return "Đăng ký gói của bạn đã được xử lý và kích hoạt.";
  }

  if (msg) {
    let vi = msg;
    vi = vi.replace(/Your payment/gi, "Thanh toán của bạn");
    vi = vi.replace(/has been processed successfully/gi, "đã được xử lý thành công");
    vi = vi.replace(/is now active/gi, "hiện đã được kích hoạt");
    vi = vi.replace(/Payment of/gi, "Thanh toán");
    vi = vi.replace(/completed successfully/gi, "hoàn tất thành công");
    vi = vi.replace(/for/gi, "cho");
    vi = vi.replace(/plan subscription/gi, "đăng ký gói");
    vi = vi.replace(/plan/gi, "gói");
    vi = vi.replace(/membership/gi, "tư cách thành viên");

    const englishWords = (vi.match(/[A-Za-z]{4,}/g) || []).length;
    if (englishWords > 6) return msg;
    return vi;
  }

  return "—";
}

function translateMessage(item: NotificationItem, lang: "vi" | "en") {
  return lang === "vi" ? translateMessageToVi(item) : (item.message || "—");
}

export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const tr = (k: string) => (t as (ns: string, key: string) => string)("notifications", k);
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<GetUserNotificationsResponse & { unreadCount?: number }>({
    notifications: [],
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    unreadCount: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  
  const { isConnected, unreadCount: contextUnreadCount, onNotificationReceived, onUnreadCountUpdated, offNotificationReceived, offUnreadCountUpdated } = useNotifications();

  async function load(p = page, s = pageSize) {
    const currentRequestId = ++requestIdRef.current;

    setLoading(true);
    try {
      const res = await getUserNotifications(p, s);
      
      if (currentRequestId === requestIdRef.current) {
        setData({
          notifications: res.notifications ?? [],
          page: res.page ?? p,
          pageSize: res.pageSize ?? s,
          totalItems: res.totalItems ?? (res.notifications?.length ?? 0),
          totalPages:
            res.totalPages ??
            Math.max(
              1,
              Math.ceil((res.totalItems ?? (res.notifications?.length ?? 0)) / (res.pageSize ?? s))
            ),
          unreadCount: res.unreadCount,
        });
        setError(null);
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        setError(tr("error_load"));
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleNotificationReceived = useCallback((notification: NotificationItem) => {
    setData((prev) => {
      const exists = prev.notifications.some((n) => n.notificationId === notification.notificationId);
      if (exists) {
        return prev;
      }

      const newNotifications = [notification, ...prev.notifications];
      const newTotalItems = (prev.totalItems ?? 0) + 1;
      const newTotalPages = Math.ceil(newTotalItems / (prev.pageSize || 20));
      
      if (prev.page === 1) {
        return {
          ...prev,
          notifications: newNotifications.slice(0, prev.pageSize),
          totalItems: newTotalItems,
          totalPages: newTotalPages,
        };
      } else {
        return {
          ...prev,
          totalItems: newTotalItems,
          totalPages: newTotalPages,
        };
      }
    });
  }, []);

  const handleUnreadCountUpdated = useCallback((count: number) => {
    setData((prev) => ({
      ...prev,
      unreadCount: count,
    }));
  }, []);

  useEffect(() => {
    onNotificationReceived(handleNotificationReceived);
    onUnreadCountUpdated(handleUnreadCountUpdated);

    return () => {
      offNotificationReceived(handleNotificationReceived);
      offUnreadCountUpdated(handleUnreadCountUpdated);
    };
  }, [onNotificationReceived, onUnreadCountUpdated, offNotificationReceived, offUnreadCountUpdated, handleNotificationReceived, handleUnreadCountUpdated]);

  const unreadCount = useMemo(
    () => contextUnreadCount ?? data.unreadCount ?? (data.notifications ?? []).filter((n) => !n.isRead).length,
    [contextUnreadCount, data.notifications, data.unreadCount]
  );

  async function onMarkRead(n: NotificationItem) {
    try {
      await markNotificationAsRead(n.notificationId);
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((x) =>
          x.notificationId === n.notificationId ? { ...x, isRead: true } : x
        ),
      }));
    } catch {}
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsAsRead();
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((x) => ({ ...x, isRead: true })),
        unreadCount: 0,
      }));
    } catch {}
  }

  const locale = lang === "en" ? "en" : "vi";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{tr("title")}</h1>
          <span
            className={[
              "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
              unreadCount > 0
                ? (isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" : "bg-emerald-100 text-emerald-700 border-emerald-200")
                : `${themeClasses.textMuted} ${themeClasses.tableBorder}`,
            ].join(" ")}
            aria-label={tr("unread_aria")}
            title={tr("unread_title")}
          >
            {unreadCount}
          </span>
          <p className={`text-sm ml-1 ${themeClasses.textMuted}`}>{tr("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={`rounded-md border px-2 py-1 text-sm ${themeClasses.select}`}
            value={pageSize}
            onChange={(e) => {
              const v = Number(e.target.value) || 20;
              setPage(1);
              setPageSize(v);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/{tr("per_page_unit")}
              </option>
            ))}
          </select>
          <button
            onClick={() => load(page, pageSize)}
            className={`rounded-md border px-3 py-1.5 text-sm ${themeClasses.button}`}
          >
            {tr("refresh")}
          </button>
          <button
            onClick={onMarkAll}
            disabled={unreadCount === 0}
            className={[
              "rounded-md px-3 py-1.5 text-sm",
              unreadCount === 0
                ? (isDark ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-gray-300 text-gray-500 cursor-not-allowed")
                : "bg-emerald-600 text-white hover:bg-emerald-500",
            ].join(" ")}
          >
            {tr("mark_all_read")}
          </button>
        </div>
      </div>

      {error && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${isDark ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-800"}`}>
          {error}
        </div>
      )}

      <div className={`rounded-xl border ${themeClasses.panel}`}>
        <div className={`grid grid-cols-12 px-4 py-3 text-left text-xs uppercase tracking-wider ${themeClasses.textMuted}`}>
          <div className="col-span-5">{tr("table_title")}</div>
          <div className="col-span-5">{tr("table_message")}</div>
          <div className="col-span-2">{tr("table_time")}</div>
        </div>
        <div className={`divide-y ${themeClasses.tableBorder}`}>
          {loading && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-4">
                  <div className="h-4 w-1/3 bg-white/10 rounded mb-2 animate-pulse" />
                  <div className="h-3 w-2/3 bg-white/5 rounded animate-pulse" />
                </div>
              ))}
            </>
          )}

          {!loading && data.notifications.length === 0 && (
            <div className={`px-4 py-6 text-sm ${themeClasses.textMuted}`}>{tr("empty")}</div>
          )}

          {!loading &&
            data.notifications.map((n) => {
              const wrap = (children: React.ReactNode) =>
                n.linkUrl ? (
                  <Link href={n.linkUrl} onClick={() => onMarkRead(n)}>
                    {children}
                  </Link>
                ) : (
                  <button onClick={() => onMarkRead(n)} className="w-full text-left">
                    {children}
                  </button>
                );

              const label = typeLabel(n.type, tr);

              return (
                <div
                  key={n.notificationId}
                  className={[
                    "px-4 py-3 grid grid-cols-12 items-start",
                    n.isRead ? "bg-transparent" : "bg-emerald-500/5",
                  ].join(" ")}
                >
                  <div className="col-span-5 pr-4">
                    {wrap(
                      <div className="flex items-center gap-2">
                        {!n.isRead && <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />}
                        <span className={`font-medium ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                          {n.title || tr("fallback_title")}
                        </span>
                        {label && (
                          <span className={`ml-1 rounded border px-1.5 py-0.5 text-[10px] ${themeClasses.tableBorder} ${themeClasses.textMuted}`}>
                            {label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-5 pr-4">
                    <div className={`text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                      {translateMessage(n, lang === "en" ? "en" : "vi")}
                    </div>
                    {n.linkUrl && (
                      <Link
                        href={n.linkUrl}
                        className={`mt-1 inline-flex text-xs hover:underline ${isDark ? "text-emerald-300" : "text-emerald-600"}`}
                        onClick={() => onMarkRead(n)}
                      >
                        {tr("open_link")}
                      </Link>
                    )}
                  </div>

                  <div className="col-span-2">
                    <div className={`text-xs ${themeClasses.textMuted}`}>{fmtTime(n.createdAt, lang)}</div>
                    {!n.isRead && (
                      <button
                        onClick={() => onMarkRead(n)}
                        className={`mt-2 rounded border px-2 py-1 text-xs hover:bg-white/10 ${themeClasses.button}`}
                      >
                        {tr("mark_read")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {(data.totalPages ?? 0) > 1 && (
        <div className="flex items-center justify-between">
          <div className={`text-sm ${themeClasses.textMuted}`}>
            {tr("page")} {data.page} / {data.totalPages} • {data.totalItems?.toLocaleString(lang === "en" ? "en-US" : "vi-VN")} {tr("total_suffix")}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                data.page <= 1 || loading
                  ? (isDark ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-gray-300 text-gray-500 cursor-not-allowed")
                  : themeClasses.button,
              ].join(" ")}
            >
              {tr("prev")}
            </button>
            <button
              disabled={data.page >= (data.totalPages ?? 1) || loading}
              onClick={() => setPage((p) => Math.min(data.totalPages ?? 1, p + 1))}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                data.page >= (data.totalPages ?? 1) || loading
                  ? (isDark ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-gray-300 text-gray-500 cursor-not-allowed")
                  : themeClasses.button,
              ].join(" ")}
            >
              {tr("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
