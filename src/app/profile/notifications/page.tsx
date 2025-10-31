"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getUserNotifications, GetUserNotificationsResponse, markAllNotificationsAsRead, markNotificationAsRead, NotificationItem } from "@/lib/api-user";


function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<GetUserNotificationsResponse>({
    notifications: [],
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [error, setError] = useState<string | null>(null);

  async function load(p = page, s = pageSize) {
    setLoading(true);
    try {
      const res = await getUserNotifications(p, s);
      setData({
        notifications: res.notifications ?? [],
        page: res.page ?? p,
        pageSize: res.pageSize ?? s,
        totalItems: res.totalItems ?? res.notifications.length,
        totalPages: res.totalPages ?? Math.max(1, Math.ceil((res.totalItems ?? res.notifications.length) / (res.pageSize ?? s))),
      });
      setError(null);
    } catch {
      setError("Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, pageSize);
  }, [pageSize]);

  useEffect(() => {
    load(page, pageSize);
  }, [page]);

  const unreadCount = useMemo(
    () => (data.notifications ?? []).filter((n) => !n.isRead).length,
    [data.notifications]
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
      if (typeof window !== "undefined") window.dispatchEvent(new Event("notifications-changed"));
    } catch {}
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsAsRead();
      setData((prev) => ({
        ...prev,
        notifications: prev.notifications.map((x) => ({ ...x, isRead: true })),
      }));
      if (typeof window !== "undefined") window.dispatchEvent(new Event("notifications-changed"));
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Thông báo</h1>
          <p className="text-sm text-zinc-400">Quản lý thông báo của bạn</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm"
            value={pageSize}
            onChange={(e) => {
              const v = Number(e.target.value) || 20;
              setPage(1);
              setPageSize(v);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/trang
              </option>
            ))}
          </select>
          <button
            onClick={() => load(page, pageSize)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Làm mới
          </button>
          <button
            onClick={onMarkAll}
            disabled={unreadCount === 0}
            className={[
              "rounded-md px-3 py-1.5 text-sm",
              unreadCount === 0
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-emerald-600 text-zinc-950 hover:bg-emerald-500",
            ].join(" ")}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-900/60">
        <div className="grid grid-cols-12 px-4 py-3 text-left text-xs uppercase tracking-wider text-zinc-400">
          <div className="col-span-5">Tiêu đề</div>
          <div className="col-span-5">Nội dung</div>
          <div className="col-span-2">Thời gian</div>
        </div>
        <div className="divide-y divide-white/10">
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
            <div className="px-4 py-6 text-sm text-zinc-300">Chưa có thông báo.</div>
          )}

          {!loading &&
            data.notifications.map((n) => {
              const wrap = (children: React.ReactNode) =>
                n.linkUrl ? (
                  <Link href={n.linkUrl} onClick={() => onMarkRead(n)}>
                    {children}
                  </Link>
                ) : (
                  <button
                    onClick={() => onMarkRead(n)}
                    className="w-full text-left"
                  >
                    {children}
                  </button>
                );

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
                        {!n.isRead && (
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                        )}
                        <span className="font-medium text-zinc-100">
                          {n.title || "Thông báo"}
                        </span>
                        {n.type && (
                          <span className="ml-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {n.type}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-5 pr-4">
                    <div className="text-sm text-zinc-300">{n.message || "—"}</div>
                    {n.linkUrl && (
                      <Link
                        href={n.linkUrl}
                        className="mt-1 inline-flex text-xs text-emerald-300 hover:underline"
                        onClick={() => onMarkRead(n)}
                      >
                        Mở liên kết
                      </Link>
                    )}
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-zinc-400">{fmtTime(n.createdAt)}</div>
                    {!n.isRead && (
                      <button
                        onClick={() => onMarkRead(n)}
                        className="mt-2 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {data.totalPages && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Trang {data.page} / {data.totalPages} • {data.totalItems?.toLocaleString()} thông báo
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                data.page <= 1 || loading
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-white/5 text-zinc-200 hover:bg-white/10 border border-white/10",
              ].join(" ")}
            >
              Trước
            </button>
            <button
              disabled={data.page >= (data.totalPages ?? 1) || loading}
              onClick={() => setPage((p) => Math.min((data.totalPages ?? 1), p + 1))}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                data.page >= (data.totalPages ?? 1) || loading
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-white/5 text-zinc-200 hover:bg-white/10 border border-white/10",
              ].join(" ")}
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
