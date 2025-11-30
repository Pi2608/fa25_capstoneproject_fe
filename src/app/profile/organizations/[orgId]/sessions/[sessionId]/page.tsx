"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, type SessionDto } from "@/lib/api-ques";

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

type StatusInfo = {
  label: string;
  colorClass: string;
};

function getStatusInfo(status?: string | null): StatusInfo {
  const raw = (status || "").toLowerCase();
  if (!raw) {
    return { label: "--", colorClass: "text-zinc-400" };
  }
  if (raw === "waiting" || raw === "pending") {
    return { label: "Chưa bắt đầu", colorClass: "text-amber-500" };
  }
  if (raw === "running" || raw === "in_progress") {
    return { label: "Đang diễn ra", colorClass: "text-emerald-500" };
  }
  if (raw === "paused") {
    return { label: "Tạm dừng", colorClass: "text-sky-500" };
  }
  if (raw === "ended" || raw === "completed") {
    return { label: "Đã kết thúc", colorClass: "text-zinc-500" };
  }
  if (raw === "cancelled") {
    return { label: "Đã hủy", colorClass: "text-red-500" };
  }
  return { label: status || "--", colorClass: "text-zinc-400" };
}

function getPrimaryLabel(status?: string | null): string {
  const raw = (status || "").toLowerCase();
  if (!raw || raw === "waiting" || raw === "pending") {
    return "Vào trang điều khiển";
  }
  if (raw === "running" || raw === "in_progress" || raw === "paused") {
    return "Tiếp tục điều khiển";
  }
  if (raw === "ended" || raw === "completed") {
    return "Xem kết quả";
  }
  return "Vào trang điều khiển";
}

export default function OrgSessionDetailPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string; sessionId: string }>();
  const orgId = params?.orgId ?? "";
  const sessionId = params?.sessionId ?? "";

  const mode = useThemeMode();

  const [session, setSession] = useState<SessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getSession(sessionId);
      setSession(data);
    } catch (e) {
      console.error("Failed to load session detail", e);
      setError("Không tải được thông tin session. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const statusInfo = useMemo(
    () => getStatusInfo(session?.status),
    [session?.status]
  );

  const primaryLabel = useMemo(
    () => getPrimaryLabel(session?.status),
    [session?.status]
  );

  const handleGoToControl = useCallback(() => {
    if (!session?.mapId || !session.sessionId) return;

    const params = new URLSearchParams({
      sessionId: session.sessionId,
    });

    if ((session as any).sessionCode) {
      params.set("sessionCode", (session as any).sessionCode);
    }
    if ((session as any).workspaceId) {
      params.set("workspaceId", String((session as any).workspaceId));
    }
    if (session.mapId) {
      params.set("mapId", String(session.mapId));
    }
    if (session.mapName) {
      params.set("mapName", session.mapName);
    }

    router.push(`/storymap/control/${session.mapId}?${params.toString()}`);
  }, [router, session]);

  return (
    <div className="min-w-0 relative px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(`/profile/organizations/${orgId}/sessions`)
              }
              className="px-3 py-1.5 rounded-lg border text-sm border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              style={{
                color: mode === "dark" ? "#e5e7eb" : "#4b5563",
              }}
            >
              ← Quay lại danh sách session
            </button>
            <h1
              className="text-2xl font-semibold"
              style={{
                color: mode === "dark" ? "#f9fafb" : "#047857",
              }}
            >
              Chi tiết session
            </h1>
          </div>
          {session && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Mã:{" "}
              <span className="font-mono text-emerald-600 dark:text-emerald-300">
                {(session as any).sessionCode ?? "--"}
              </span>
            </p>
          )}
        </div>

        {session && (
          <button
            type="button"
            onClick={handleGoToControl}
            className="px-4 py-2 rounded-xl text-sm font-semibold border shadow-[0_8px_20px_rgba(14,165,233,0.45)] border-sky-500 bg-sky-500 text-white hover:bg-sky-400 hover:border-sky-400 dark:border-sky-400 dark:bg-sky-500/10 dark:text-sky-200 dark:shadow-none dark:hover:bg-sky-500/20"
          >
            {primaryLabel}
          </button>
        )}
      </div>

      {loading && (
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
          Đang tải thông tin session...
        </div>
      )}

      {!loading && error && (
        <div className="min-h-[40vh] flex items-center justify-center">
          <p className="text-sm text-red-500 dark:text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && !session && (
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-600 dark:text-zinc-400">
          Không tìm thấy session.
        </div>
      )}

      {!loading && !error && session && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
              Thông tin chung
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Tên session
                </dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {session.sessionName || "--"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Trạng thái
                </dt>
                <dd
                  className={`text-right font-medium ${statusInfo.colorClass}`}
                >
                  {statusInfo.label}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Loại</dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {session.sessionType || "--"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Bản đồ</dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {session.mapName || "Bản đồ chưa đặt tên"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Bộ câu hỏi
                </dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {(session as any).questionBankName || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Mô tả</dt>
                <dd className="max-w-[60%] text-right text-zinc-900 dark:text-zinc-100">
                  {session.description || "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
              Cấu hình & thống kê
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Số người tham gia
                </dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {session.totalParticipants ?? 0}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Ngày tạo</dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {formatDate(session.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Dự kiến bắt đầu
                </dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {formatDate((session as any).scheduledStartTime)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">
                  Bắt đầu thực tế
                </dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {formatDate((session as any).actualStartTime)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500 dark:text-zinc-400">Kết thúc</dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {formatDate((session as any).endTime)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
