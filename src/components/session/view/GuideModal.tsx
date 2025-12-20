"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type ViewGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function GuideModal({ open, onClose }: ViewGuideModalProps) {
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
      <div
        className="absolute inset-0 bg-white/70 backdrop-blur-[2px]"
        role="presentation"
        onClick={() => {
          if (overlayGuardRef.current) return;
          onClose();
        }}
      />

      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-zinc-200 bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900">
              Hướng dẫn tham gia Session (Học sinh)
            </p>
            <p className="mt-1 text-[12px] text-zinc-600">
              Cứ xem theo thầy cô nha — tới câu hỏi thì trả lời là được ✅
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[12px] text-zinc-700">
                🔄 Lỡ out tab? Mở lại link là vào
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[12px] text-zinc-700">
                ⏳ Không thấy cập nhật? Đợi 3–5s
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[12px] text-zinc-700">
                📍 PIN_ON_MAP: click lên bản đồ
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-zinc-200 bg-zinc-100 px-2.5 py-1.5 text-[12px] text-zinc-700 hover:bg-zinc-200"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3 text-[13px]">
          {[
            {
              icon: "▶️",
              title: "Chờ thầy cô bắt đầu",
              desc: "Thầy cô bấm Start là bạn xem được ngay.",
              tone: "border-emerald-200 bg-emerald-50",
            },
            {
              icon: "🗺️",
              title: "Theo dõi bản đồ",
              desc: "Bản đồ tự chạy theo thầy cô, bạn chỉ cần xem.",
              tone: "border-sky-200 bg-sky-50",
            },
            {
              icon: "❓",
              title: "Trả lời câu hỏi",
              desc: "Câu hỏi ở sidebar trái. Nếu là PIN_ON_MAP thì click trực tiếp lên bản đồ.",
              tone: "border-purple-200 bg-purple-50",
            },
            {
              icon: "👥",
              title: "Hoạt động nhóm",
              desc: "Nếu có nhóm, panel bên phải sẽ hiện để chat/nộp bài.",
              tone: "border-pink-200 bg-pink-50",
            },
            {
              icon: "🏁",
              title: "Kết thúc",
              desc: "Hết buổi sẽ hiện màn hình kết thúc/leaderboard.",
              tone: "border-amber-200 bg-amber-50",
            },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border ${s.tone} p-4`}>
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-2xl border border-zinc-200 bg-white shadow-sm flex items-center justify-center text-lg">
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-zinc-900">
                    {i + 1}. {s.title}
                  </div>
                  <div className="mt-0.5 text-[13px] text-zinc-700">{s.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pb-5 pt-3 flex items-center justify-end border-t border-zinc-200 bg-zinc-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-500"
          >
            Ok, mình hiểu rồi ✅
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
