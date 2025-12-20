"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import type { SessionDto } from "@/lib/api-session";

type GuideModalProps = {
  open: boolean;
  onClose: () => void;

  session: SessionDto | null;
  origin?: string;

  changingStatus?: boolean;
  onChangeStatus?: (action: "start" | "pause" | "resume" | "end") => void;

  onOpenShare?: () => void; // callback để đóng guide + mở share (bên page sẽ handle)
};

export default function GuideModal({
  open,
  onClose,
  session,
  origin = "",
  changingStatus = false,
  onChangeStatus,
  onOpenShare,
}: GuideModalProps) {
  const overlayGuardRef = useRef(false);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    overlayGuardRef.current = true;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlayGuardRef.current = false;
      });
    });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      overlayGuardRef.current = false;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        role="presentation"
        onClick={() => {
          if (overlayGuardRef.current) return;
          onClose();
        }}
      />

      {/* modal */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl ring-1 ring-white/10">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-950/80 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-100">
              Hướng dẫn điều khiển Session (Giáo viên)
            </p>
            <p className="mt-1 text-[12px] text-zinc-400">
              Luồng chuẩn: <b className="text-zinc-200">Share</b> →{" "}
              <b className="text-zinc-200">Start</b> →{" "}
              <b className="text-zinc-200">Segments</b> →{" "}
              <b className="text-zinc-200">Câu hỏi</b> →{" "}
              <b className="text-zinc-200">Nhóm</b> →{" "}
              <b className="text-zinc-200">End</b>
            </p>

            {session ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                <span className="rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-0.5">
                  Session Code:{" "}
                  <b className="text-zinc-100">{session.sessionCode}</b>
                </span>

                <span
                  className={
                    "rounded-full px-2 py-0.5 border " +
                    (session.status === "Running"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                      : session.status === "Paused"
                      ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                      : session.status === "Ended"
                      ? "border-rose-500/70 bg-rose-600/10 text-rose-200"
                      : "border-sky-400/60 bg-sky-500/10 text-sky-200")
                  }
                >
                  Trạng thái: <b>{session.status}</b>
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-amber-200/90">
                Chưa có sessionId trên URL. Hãy tạo session trước để dùng Share/Start.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-2_toggle
            .5 py-1.5 text-[12px] text-zinc-200 hover:bg-zinc-800"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
          {/* left: steps */}
          <div className="px-5 py-4">
            <div className="space-y-3">
              {[
                {
                  n: "1",
                  title: "Chia sẻ cho học sinh",
                  desc: "Bấm Share để hiện QR/Link, hoặc Copy để copy Session Code.",
                },
                {
                  n: "2",
                  title: "Bắt đầu buổi học",
                  desc: "Bấm Start để mở phiên. Khi đang dạy, bạn có thể Pause/Resume.",
                },
                {
                  n: "3",
                  title: "Điều khiển bản đồ (Segments)",
                  desc: "Chọn segment ở timeline hoặc Trước/Sau. Play/Pause trên map sẽ sync cho học sinh.",
                },
                {
                  n: "4",
                  title: "Điều khiển câu hỏi",
                  desc: "Câu tiếp / Bỏ qua / Gia hạn. Mở Câu trả lời học sinh và Hiện đáp án khi cần công bố.",
                },
                {
                  n: "5",
                  title: "Hoạt động nhóm & bài nộp",
                  desc: "Tạo nhóm, xem thành viên; mở Bài nộp nhóm để chấm điểm và phản hồi.",
                },
                {
                  n: "6",
                  title: "Kết thúc buổi học",
                  desc: "Bấm End để kết thúc. Sau đó xem Tổng kết session/Leaderboard.",
                },
              ].map((it) => (
                <div
                  key={it.n}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-[12px] font-bold text-zinc-100">
                      {it.n}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-zinc-100">
                        {it.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-zinc-400">
                        {it.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-[12px] font-semibold text-zinc-200">Mẹo nhanh</p>
                <ul className="mt-1 space-y-1 text-[12px] text-zinc-400">
                  <li>
                    • Nếu học sinh “không thấy segment”: hãy Pause/Resume hoặc đổi
                    segment để sync lại.
                  </li>
                  <li>
                    • Nếu “chưa có câu hỏi đang phát”: bấm Câu tiếp trước rồi mới
                    Gia hạn / xem Câu trả lời.
                  </li>
                  <li>
                    • Khi cần ổn định lớp: Pause để dừng mọi thứ, rồi Resume khi
                    sẵn sàng.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* right: actions */}
          <div className="border-t border-zinc-800 px-5 py-4 md:border-l md:border-t-0">
            <p className="text-[12px] font-semibold text-zinc-200">Thao tác nhanh</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShare?.();
                }}
                disabled={!session}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[12px] font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Mở Share
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!session) return;
                  navigator.clipboard.writeText(session.sessionCode);
                  toast.success("Đã copy Session Code");
                }}
                disabled={!session}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[12px] font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Copy Code
              </button>

              <button
                type="button"
                onClick={() => session && onChangeStatus?.("start")}
                disabled={!session || changingStatus || session?.status === "Running"}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start
              </button>

              <button
                type="button"
                onClick={() => session && onChangeStatus?.("pause")}
                disabled={!session || changingStatus || session?.status !== "Running"}
                className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Pause
              </button>

              <button
                type="button"
                onClick={() => session && onChangeStatus?.("resume")}
                disabled={!session || changingStatus || session?.status !== "Paused"}
                className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-[12px] font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Resume
              </button>

              <button
                type="button"
                onClick={() => session && onChangeStatus?.("end")}
                disabled={!session || changingStatus || session?.status === "Ended"}
                className="rounded-xl border border-rose-500/40 bg-rose-600/10 px-3 py-2 text-[12px] font-semibold text-rose-200 hover:bg-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                End
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
              <p className="text-[12px] font-semibold text-zinc-200">Link cho học sinh</p>
              <p className="mt-1 text-[12px] text-zinc-400">
                Học sinh vào: <b className="text-zinc-200">/session/join</b> và nhập
                code.
              </p>
              <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[12px] text-zinc-300">
                {origin ? `${origin}/session/join` : "/session/join"}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-[12px] font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
