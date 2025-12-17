"use client";

import React from "react";

type Props = {
  selectedGroupId: string | null;
  selectedGroupName: string | null;

  loading: boolean;
  error: string | null;
  submissions: any[];

  onLoad: () => void;
  onOpenGrade: (submission: any) => void;
};

export default function GroupSubmissionsCard({
  selectedGroupId,
  selectedGroupName,
  loading,
  error,
  submissions,
  onLoad,
  onOpenGrade,
}: Props) {
  return (
    <section className="mt-3 pt-3 border-t border-zinc-800">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-semibold text-zinc-200">Bài nộp nhóm</p>
            <p className="text-[11px] text-zinc-500">
              {selectedGroupId
                ? `Nhóm: ${selectedGroupName ?? selectedGroupId}`
                : "Nhấn “Tải bài nộp” để lấy tất cả bài nộp của các nhóm trong session."}
            </p>
          </div>

          <button
            type="button"
            onClick={onLoad}
            disabled={loading}
            className="inline-flex items-center rounded-lg border border-zinc-700 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tải bài nộp
          </button>
        </div>

        <div className="mt-2">
          {loading ? (
            <p className="text-[11px] text-zinc-500">Đang tải bài nộp...</p>
          ) : error ? (
            <p className="text-[11px] text-red-400">{error}</p>
          ) : submissions.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Chưa có bài nộp.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s: any, idx: number) => {
                const submissionId =
                  s?.submissionId ?? s?.SubmissionId ?? s?.id ?? s?.Id;

                const groupName =
                  s?.groupName ?? s?.GroupName ?? "Nhóm (chưa có tên)";

                const title = s?.title ?? s?.Title ?? "";
                const submittedAt = s?.submittedAt ?? s?.SubmittedAt ?? "";
                const content = s?.content ?? s?.Content ?? "";
                const attachmentUrls = s?.attachmentUrls ?? s?.AttachmentUrls ?? [];

                return (
                  <div
                    key={submissionId ?? idx}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-zinc-200 truncate">
                          {groupName}
                        </p>

                        {title && (
                          <p className="mt-0.5 text-[10px] text-zinc-400 truncate">
                            {title}
                          </p>
                        )}

                        {content && (
                          <p className="mt-1 text-[11px] text-zinc-400">
                            {String(content).length > 200
                              ? String(content).slice(0, 200) + "…"
                              : String(content)}
                          </p>
                        )}

                        {Array.isArray(attachmentUrls) && attachmentUrls.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {attachmentUrls.map((url: string, i: number) => (
                              <a
                                key={`${submissionId}-att-${i}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-[11px] text-sky-300 hover:text-sky-200 underline truncate"
                                title={url}
                              >
                                Đính kèm {i + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-zinc-500">{submittedAt}</p>

                        <button
                          type="button"
                          onClick={() => onOpenGrade(s)}
                          className="mt-1 inline-flex items-center rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
                        >
                          Chấm điểm
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
