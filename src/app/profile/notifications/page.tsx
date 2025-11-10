"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getUserNotifications,
  GetUserNotificationsResponse,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NotificationItem,
} from "@/lib/api-user";

// ====== Helpers ======
function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function viTypeLabel(type?: string) {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes("transaction_completed")) return "Hoàn tất giao dịch";
  if (t.includes("payment") && t.includes("success")) return "Thanh toán thành công";
  if (t.includes("subscription") && (t.includes("processed") || t.includes("active"))) return "Kích hoạt gói";
  return type; // giữ nguyên nếu không biết
}

// Dịch nội dung tiếng Anh → tiếng Việt theo mẫu phổ biến
function translateMessageToVi(item: NotificationItem): string {
  const msg = (item.message ?? "").trim();

  // Ưu tiên dựa trên type
  const type = (item.type ?? "").toLowerCase();

  // 1) Hoàn tất thanh toán gói: "Payment of $0.10 for Pro plan completed successfully"
  {
    const r =
      /payment of\s*\$?\s*([\d.,]+)\s*for\s*(.+?)\s*plan\s*completed\s*successfully/i.exec(msg);
    if (r) {
      const amount = r[1];
      const plan = r[2].trim();
      return `Thanh toán $${amount} cho gói ${plan} đã hoàn tất.`;
    }
  }

  // 2) Xử lý thanh toán + kích hoạt membership:
  // "Your payment of $0.10 for Plan Subscription has been processed successfully. Your membership is now active."
  {
    const r =
      /your payment of\s*\$?\s*([\d.,]+)\s*for\s*(.+?)\s*subscription\s*has been processed successfully\.?\s*your membership is now active\.?/i.exec(
        msg
      );
    if (r) {
      const amount = r[1];
      const plan = r[2].trim();
      return `Thanh toán $${amount} cho đăng ký gói ${plan} đã được xử lý thành công. Tư cách thành viên của bạn đã được kích hoạt.`;
    }
  }

  // 3) Nếu có type gợi ý
  if (type.includes("transaction_completed")) {
    // Cố gắng bắt số tiền & gói nếu có
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

  // 4) Fallback: dịch cụm từ thường gặp
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

    // Nếu sau khi thay vẫn còn nguyên tiếng Anh nhiều, cứ trả lại bản gốc để tránh hiểu sai
    const englishWords = (vi.match(/[A-Za-z]{4,}/g) || []).length;
    if (englishWords > 6) return msg; // giữ nguyên nếu không chắc
    return vi;
  }

  return "—";
}

// ====== Page ======
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
        totalItems: res.totalItems ?? (res.notifications?.length ?? 0),
        totalPages:
          res.totalPages ??
          Math.max(
            1,
            Math.ceil(
              (res.totalItems ?? (res.notifications?.length ?? 0)) / (res.pageSize ?? s)
            )
          ),
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
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Thông báo</h1>
          <span
            className={[
              "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              unreadCount > 0
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                : "bg-white/5 text-zinc-300 border border-white/10",
            ].join(" ")}
            aria-label="Số thông báo chưa đọc"
            title="Số thông báo chưa đọc"
          >
            {unreadCount}
          </span>
          <p className="text-sm text-zinc-400 ml-1">Quản lý thông báo của bạn</p>
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
                  <button onClick={() => onMarkRead(n)} className="w-full text-left">
                    {children}
                  </button>
                );

              const typeLabel = viTypeLabel(n.type);

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
                        {typeLabel && (
                          <span className="ml-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-300">
                            {typeLabel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-span-5 pr-4">
                    <div className="text-sm text-zinc-300">
                      {translateMessageToVi(n)}
                    </div>
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
            Trang {data.page} / {data.totalPages} •{" "}
            {data.totalItems?.toLocaleString("vi-VN")} thông báo
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
              onClick={() => setPage((p) => Math.min(data.totalPages ?? 1, p + 1))}
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
