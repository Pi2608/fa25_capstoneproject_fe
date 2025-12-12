"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMySessions,
  getSessionByCode,
  deleteSession,
  type SessionDto,
} from "@/lib/api-ques";
import { EmptyState } from "@/components/ui/EmptyState";

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
  if (raw === "waiting" || raw === "pending") return "Chưa bắt đầu";
  if (raw === "in_progress" || raw === "running") return "Đang diễn ra";
  if (raw === "paused") return "Tạm dừng";
  if (raw === "completed" || raw === "ended") return "Đã kết thúc";
  if (raw === "cancelled" || raw === "canceled") return "Đã hủy";
  return status || "—";
}

function renderQuestionBankNames(session: SessionDto): string {
  const qbList =
    (session as any).questionBanks as
      | { questionBankId: string; questionBankName?: string | null }[]
      | undefined;

  if (Array.isArray(qbList) && qbList.length > 0) {
    const names = qbList
      .map((qb) => qb.questionBankName)
      .filter((name): name is string => Boolean(name));

    if (names.length > 0) {
      return names.join(", ");
    }
  }

  if (session.questionBankName) {
    return session.questionBankName;
  }

  return "—";
}

export default function OrgSessionsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const mode = useThemeMode();

  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<SessionDto | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      setIsDeleting(true);
      await deleteSession(sessionToDelete.sessionId);
      setSessions((prev) =>
        prev.filter((item) => item.sessionId !== sessionToDelete.sessionId)
      );
      setSessionToDelete(null);
    } catch (err) {
      console.error("Delete session failed", err);
      alert("Xóa session thất bại. Vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearch = async () => {
    const code = searchCode.trim();
    if (!code) {
      setSearchError("Vui lòng nhập mã session.");
      return;
    }
    try {
      setSearchError(null);
      setSearching(true);
      const session = await getSessionByCode(code);
      router.push(
        `/profile/organizations/${orgId}/sessions/${session.sessionId}`
      );
    } catch (err) {
      console.error("Search session by code failed", err);
      setSearchError("Không tìm thấy session với mã này.");
    } finally {
      setSearching(false);
    }
  };

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 max-w-md w-full">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Nhập mã session để tìm..."
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500 text-zinc-900 hover:bg-emerald-400 disabled:opacity-60"
          >
            {searching ? "Đang tìm..." : "Tìm"}
          </button>
        </div>
        {searchError && (
          <p className="text-xs text-red-500 dark:text-red-400">
            {searchError}
          </p>
        )}
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
        <EmptyState
          illustration="teaching"
          title="No Sessions Yet"
          description="Start your first live session to engage with students in real-time. Sessions include interactive questions, live leaderboards, and instant feedback."
          action={{
            label: "Start First Session",
            onClick: () =>
              router.push(`/profile/organizations/${orgId}/sessions/create`),
          }}
        />
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
                  <th className="px-3 py-2 font-medium">Bộ câu hỏi</th>
                  <th className="px-3 py-2 font-medium text-right">Xóa</th>
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
                    <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">
                      {renderQuestionBankNames(s)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(s);
                        }}
                        className="px-2 py-1 text-xs rounded-lg border border-red-500 text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-500/10"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
            Nhấp vào một dòng để xem chi tiết session.
          </p>
        </div>
      )}

      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 text-zinc-50 shadow-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold mb-2">Xóa session?</h2>
            <p className="text-sm text-zinc-300">
              Bạn có chắc chắn muốn xóa{" "}
              <span className="font-semibold">
                {sessionToDelete.sessionName || "session này"}
              </span>
              ?{" "}
              <span className="text-red-400 font-medium">
                Hành động này không thể hoàn tác.
              </span>
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !isDeleting && setSessionToDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-600 text-zinc-100 hover:bg-zinc-800 disabled:opacity-60"
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
                disabled={isDeleting}
              >
                {isDeleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
