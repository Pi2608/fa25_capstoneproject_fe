"use client";

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMySessions,
  getSession,
  startSession,
  type SessionDto,
} from "@/lib/api-ques";

type HeaderMode = "light" | "dark";

function useThemeMode(): HeaderMode {
  const [mode, setMode] = useState<HeaderMode>("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;

    const update = () => {
      setMode(html.classList.contains("dark") ? "dark" : "light");
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return mode;
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function normalizeStatusEnum(status?: string | null): string {
  const raw = (status || "").toLowerCase();
  if (!raw) return "—";
  if (raw === "waiting" || raw === "pending") return "WAITING";
  if (raw === "in_progress" || raw === "running") return "IN_PROGRESS";
  if (raw === "paused") return "PAUSED";
  if (raw === "completed" || raw === "ended") return "COMPLETED";
  if (raw === "cancelled" || raw === "canceled") return "CANCELLED";
  return status || "—";
}

export default function OrgSessionsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const mode = useThemeMode();

  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getMySessions();
        if (!alive) return;
        setSessions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load /sessions/my", e);
        if (!alive) return;
        setError("Không tải được danh sách session. Vui lòng thử lại.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const handleOpenSessionFromList = useCallback(
    async (event: React.MouseEvent, row: SessionDto) => {
      event.stopPropagation();
      if (!row.sessionId) return;
      setOpeningId(row.sessionId);
      try {
        await startSession(row.sessionId);
        const updated = await getSession(row.sessionId);
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === updated.sessionId ? { ...s, ...updated } : s
          )
        );
      } catch (e) {
        console.error("Failed to start session", e);
        alert("Không mở được session. Vui lòng thử lại.");
      } finally {
        setOpeningId(null);
      }
    },
    []
  );

  const getActionButtonLabel = useCallback((status?: string | null) => {
    const raw = (status || "").toLowerCase();
    if (raw === "waiting" || raw === "pending") return "Mở session";
    if (raw === "in_progress" || raw === "running") return "Đang chạy";
    if (raw === "paused") return "Tạm dừng";
    if (raw === "completed" || raw === "ended") return "Đã kết thúc";
    if (raw === "cancelled" || raw === "canceled") return "Đã hủy";
    return "Mở session";
  }, []);

  return (
    <div className="min-w-0 relative px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/profile/organizations/${orgId}`)}
            className="px-3 py-1.5 rounded-lg border text-sm border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            style={{
              color: mode === "dark" ? "#e5e7eb" : "#4b5563",
              fontWeight: 500,
            }}
          >
            ← Quay lại tổ chức
          </button>
          <h1
            className="text-2xl font-semibold"
            style={{
              color: mode === "dark" ? "#f9fafb" : "#047857",
            }}
          >
            Danh sách session
          </h1>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(`/profile/organizations/${orgId}/sessions/create`)
          }
          className="px-4 py-2 rounded-xl text-sm font-semibold border"
          style={{
            backgroundColor: "#0ea5e9",
            color: "#111827",
            borderColor: "#0284c7",
            boxShadow: "0 8px 20px rgba(14,165,233,0.45)",
          }}
        >
          Tạo session mới
        </button>
      </div>

      {loading && (
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
          Đang tải danh sách session...
        </div>
      )}

      {!loading && error && (
        <div className="min-h-[40vh] flex items-center justify-center">
          <p className="text-sm text-red-500 dark:text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="rounded-2xl border p-6 text-center shadow-sm backdrop-blur border-zinc-200 bg-white/90 dark:border-white/10 dark:bg-zinc-900/60">
          <p className="mb-4 text-zinc-600 dark:text-zinc-300">
            Bạn chưa có session nào.
          </p>
          <button
            type="button"
            onClick={() =>
              router.push(`/profile/organizations/${orgId}/sessions/create`)
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-emerald-400"
          >
            + Tạo session đầu tiên
          </button>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="rounded-2xl border p-4 shadow-sm backdrop-blur border-zinc-200 bg-white/95 dark:border-white/10 dark:bg-zinc-900/70">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2 font-medium">Mã</th>
                  <th className="px-3 py-2 font-medium">Tên session</th>
                  <th className="px-3 py-2 font-medium">Bản đồ</th>
                  <th className="px-3 py-2 font-medium">Trạng thái</th>
                  <th className="px-3 py-2 font-medium">Số người tham gia</th>
                  <th className="px-3 py-2 font-medium">Tạo lúc</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.sessionId}
                    className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5"
                    onClick={() =>
                      router.push(
                        `/profile/organizations/${orgId}/sessions/${s.sessionId}`
                      )
                    }
                  >
                    <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-300">
                      {s.sessionCode}
                    </td>
                    <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                      {s.sessionName || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {s.mapName || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {normalizeStatusEnum(s.status)}
                    </td>
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {s.totalParticipants ?? 0}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => handleOpenSessionFromList(e, s)}
                        disabled={openingId === s.sessionId}
                        className="inline-flex items-center rounded-lg border border-sky-500 bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:border-sky-400 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-200 dark:shadow-none dark:hover:bg-sky-500/20"
                      >
                        {openingId === s.sessionId
                          ? "Đang mở..."
                          : getActionButtonLabel(s.status)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            Nhấp vào một dòng để xem chi tiết session. Nút "Mở session" ở cuối
            mỗi dòng sẽ bắt đầu session đó.
          </p>
        </div>
      )}
    </div>
  );
}
