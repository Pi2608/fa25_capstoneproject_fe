"use client";

import { useParams, useSearchParams } from "next/navigation";

export default function StoryMapViewPage() {
  const params = useParams<{ mapId: string }>();
  const searchParams = useSearchParams();

  const mapId = params?.mapId ?? "";
  const sessionId = searchParams.get("sessionId");
  const participantId = searchParams.get("participantId");
  const sessionCode = searchParams.get("sessionCode");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">
              Tham gia tiết học
            </h1>
            <p className="text-sm text-zinc-400">
              Map path param:{" "}
              <span className="font-mono text-zinc-200">{mapId}</span>
            </p>
          </div>

          {sessionCode && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-300">
                Mã tiết học
              </p>
              <p className="mt-1 text-lg font-mono font-semibold text-emerald-200">
                {sessionCode}
              </p>
            </div>
          )}
        </header>

        <div className="text-sm text-zinc-400 space-y-1">
          {sessionId && (
            <p>
              <span className="font-semibold text-zinc-300">
                Session ID:
              </span>{" "}
              <span className="font-mono">{sessionId}</span>
            </p>
          )}
          {participantId && (
            <p>
              <span className="font-semibold text-zinc-300">
                Participant ID:
              </span>{" "}
              <span className="font-mono">{participantId}</span>
            </p>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
          Đây là trang xem tiết học dành cho học sinh. Sau này sẽ hiển thị
          bản đồ và câu hỏi tương tác dựa trên sessionId.
        </div>
      </div>
    </div>
  );
}
