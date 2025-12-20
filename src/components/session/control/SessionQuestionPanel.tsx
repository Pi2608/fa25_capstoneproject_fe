"use client";

import type { SessionDto, QuestionDto } from "@/lib/api-session";
import type { QuestionResultsEvent } from "@/lib/hubs/session";

type QuestionBankMeta = {
  id?: string;
  bankName?: string;
  description?: string;
  category?: string;
  tags?: string[];
  totalQuestions?: number | null;
  workspaceName?: string;
  mapName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SessionQuestionBankInfo = {
  questionBankId: string;
  bankName?: string;
  totalQuestions: number;
};

type Props = {
  session: SessionDto | null;

  sessionQuestionBanks: SessionQuestionBankInfo[];
  totalQuestionsOfAllBanks: number;

  questionBankMeta: QuestionBankMeta | null;
  loadingQuestions: boolean;
  questions: QuestionDto[];

  currentQuestionIndex: number | null;
  questionControlLoading: boolean;
  isLastQuestion: boolean;

  currentQuestionResults: QuestionResultsEvent | null;
  showStudentAnswers: boolean;

  onNext: () => void;
  onSkip: () => void;
  onExtend: () => void;
  onOpenResponses: () => void;

  onBroadcast: (q: QuestionDto, idx: number) => void;
  onShowResults: (q: QuestionDto) => void;

  onToggleStudentAnswers: () => void;
};

export default function SessionQuestionPanel({
  session,
  sessionQuestionBanks,
  totalQuestionsOfAllBanks,
  questionBankMeta,
  loadingQuestions,
  questions,
  currentQuestionIndex,
  questionControlLoading,
  isLastQuestion,
  currentQuestionResults,
  showStudentAnswers,
  onNext,
  onSkip,
  onExtend,
  onOpenResponses,
  onBroadcast,
  onShowResults,
  onToggleStudentAnswers,
}: Props) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-sm shadow-black/40 px-4 py-3 h-full min-h-0 flex flex-col">
      {/* HEADER QUESTION PANEL */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 font-medium">
            Bộ câu hỏi của session này
          </p>

          {sessionQuestionBanks.length > 0 ? (
            <>
              <p className="text-xs text-zinc-400">
                Đã gắn {sessionQuestionBanks.length} bộ câu hỏi vào session này:
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {sessionQuestionBanks.map((bank, index) => (
                  <span
                    key={`${bank.questionBankId}-${index}`}
                    className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/5 px-2 py-[2px] text-[11px] text-emerald-200"
                  >
                    {bank.bankName}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-400">
              Chưa gắn bộ câu hỏi cho session này.
            </p>
          )}
        </div>

        {totalQuestionsOfAllBanks > 0 && (
          <div className="text-right text-[11px] text-zinc-300">
            <div className="font-semibold">{totalQuestionsOfAllBanks}</div>
            <div className="text-zinc-500">câu hỏi</div>
          </div>
        )}
      </div>

      {/* NÚT ĐIỀU KHIỂN CÂU HỎI */}
      {session && (
        <div className="border-t border-zinc-800 pt-2">
          <p className="text-[11px] text-zinc-500 mb-1">
            Điều khiển câu hỏi (giáo viên)
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={onNext}
              disabled={
                !session ||
                questionControlLoading ||
                session.status !== "Running" ||
                isLastQuestion
              }
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-sky-400/70 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Câu tiếp
            </button>

            <button
              type="button"
              onClick={onSkip}
              disabled={
                !session ||
                questionControlLoading ||
                session.status !== "Running" ||
                isLastQuestion
              }
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-amber-400/70 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Bỏ qua
            </button>

            <button
              type="button"
              onClick={onExtend}
              disabled={
                !session ||
                questionControlLoading ||
                session.status !== "Running"
              }
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-emerald-500/70 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + thời gian
            </button>

            <button
              type="button"
              onClick={onOpenResponses}
              disabled={!session || questionControlLoading || session.status !== "Running"}
              className="inline-flex justify-center rounded-lg px-2 py-1.5 text-[11px] font-medium border border-zinc-700 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900/70 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Các câu trả lời
            </button>
          </div>
        </div>
      )}

      {/* META + DANH SÁCH CÂU HỎI */}
      {!questionBankMeta ? (
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-[11px] text-zinc-400">
          Session hiện tại chưa gắn bộ câu hỏi hoặc thông tin chưa được truyền sang.
        </div>
      ) : (
        <div className="mt-2 flex-1 min-h-0 flex flex-col space-y-2">
          <div>
            <p className="text-sm font-semibold text-white">Danh sách câu hỏi</p>
          </div>

          {questionBankMeta.tags && questionBankMeta.tags.length > 0 && (
            <div className="pt-1">
              <p className="text-[11px] text-zinc-400 mb-1">Tags:</p>
              <div className="flex flex-wrap gap-1.5">
                {questionBankMeta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-900 text-[11px] text-zinc-100"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {questionBankMeta.description && (
            <div className="pt-1">
              <p className="text-[11px] text-zinc-400 mb-1">Mô tả:</p>
              <p className="max-h-20 overflow-y-auto text-[11px] text-zinc-200 whitespace-pre-wrap">
                {questionBankMeta.description}
              </p>
            </div>
          )}

          {(questionBankMeta.createdAt || questionBankMeta.updatedAt) && (
            <div className="pt-1 border-t border-zinc-800 mt-1 text-[11px] text-zinc-500 space-y-0.5">
              {questionBankMeta.createdAt && <p>Tạo lúc: {questionBankMeta.createdAt}</p>}
              {questionBankMeta.updatedAt && <p>Cập nhật: {questionBankMeta.updatedAt}</p>}
            </div>
          )}

          <div className="pt-2 border-t border-zinc-800 mt-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                Danh sách câu hỏi
              </p>
              {totalQuestionsOfAllBanks > 0 && (
                <span className="text-[11px] text-zinc-400">
                  {totalQuestionsOfAllBanks} câu
                </span>
              )}
            </div>

            {loadingQuestions ? (
              <p className="text-[11px] text-zinc-500">Đang tải danh sách câu hỏi...</p>
            ) : questions.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Chưa có câu hỏi nào trong bộ này.</p>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mt-1 pr-1">
                {questions.map((q, idx) => {
                  const isActive = idx === currentQuestionIndex;

                  return (
                    <div
                      key={q.questionId}
                      className={
                        "rounded-lg px-3 py-2 space-y-1 border " +
                        (isActive
                          ? "border-emerald-500/80 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-950/70")
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-[11px] text-zinc-100">
                            <span className="font-semibold">Câu {idx + 1}:</span>{" "}
                            {q.questionText}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-zinc-400 whitespace-nowrap">
                            {q.points} điểm · {q.timeLimit ?? 0}s
                          </span>

                          {isActive ? (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-400/60 px-1.5 py-[1px] text-[10px] text-emerald-200">
                                Đang phát cho HS
                              </span>
                              <button
                                type="button"
                                onClick={() => onShowResults(q)}
                                disabled={!session || questionControlLoading}
                                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/60 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Hiển thị đáp án
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onBroadcast(q, idx)}
                              disabled={
                                !session ||
                                session.status !== "Running" ||
                                questionControlLoading
                              }
                              className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-400/60 px-2 py-0.5 text-[10px] text-blue-200 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              📢 Phát câu hỏi
                            </button>
                          )}
                        </div>
                      </div>

                      {q.options && q.options.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {[...q.options]
                            .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
                            .map((opt) => (
                              <li
                                key={opt.questionOptionId ?? opt.optionText}
                                className="flex items-start gap-2 text-[11px]"
                              >
                                <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                <span
                                  className={
                                    opt.isCorrect
                                      ? "text-emerald-300 font-medium"
                                      : "text-zinc-300"
                                  }
                                >
                                  {opt.optionText || "(Không có nội dung)"}
                                </span>
                                {opt.isCorrect && (
                                  <span className="ml-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 px-1.5 py-[1px] text-[10px] text-emerald-300">
                                    Đáp án
                                  </span>
                                )}
                              </li>
                            ))}
                        </ul>
                      ) : q.questionType === "SHORT_ANSWER" && q.correctAnswerText ? (
                        <p className="mt-1 text-[11px]">
                          <span className="text-zinc-400">Đáp án: </span>
                          <span className="text-emerald-300 font-semibold">
                            {q.correctAnswerText}
                          </span>
                        </p>
                      ) : q.questionType === "PIN_ON_MAP" &&
                        typeof (q as any).correctLatitude === "number" &&
                        typeof (q as any).correctLongitude === "number" ? (
                        <p className="mt-1 text-[11px] text-zinc-400">
                          Đáp án: vị trí trên bản đồ{" "}
                          <span className="font-mono text-emerald-300">
                            ({(q as any).correctLatitude.toFixed(4)}, {(q as any).correctLongitude.toFixed(4)})
                          </span>
                          {(q as any).acceptanceRadiusMeters && (
                            <> · bán kính {(q as any).acceptanceRadiusMeters}m</>
                          )}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* KẾT QUẢ CÂU HỎI */}
          {/* {currentQuestionResults && (
            <div className="mt-3 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={onToggleStudentAnswers}
                  disabled={!session || questionControlLoading}
                  className="text-[11px] uppercase tracking-[0.12em] text-zinc-200 font-medium underline-offset-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {showStudentAnswers ? "Ẩn câu trả lời của học sinh" : "Các câu trả lời của học sinh"}
                </button>

                <span className="text-[11px] text-zinc-400">
                  {currentQuestionResults.results
                    ? `${currentQuestionResults.results.length} câu trả lời`
                    : "—"}
                </span>
              </div>

              {typeof currentQuestionResults.correctAnswer === "string" &&
                currentQuestionResults.correctAnswer.trim() !== "" && (
                  <p className="mb-2 text-[11px] text-emerald-300">
                    Đáp án đúng:{" "}
                    <span className="font-semibold">{currentQuestionResults.correctAnswer}</span>
                  </p>
                )}

              {!showStudentAnswers ? (
                <p className="text-[11px] text-zinc-500">
                  Bấm nút &quot;Các câu trả lời của học sinh&quot; để xem chi tiết.
                </p>
              ) : !currentQuestionResults.results || currentQuestionResults.results.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  Chưa có câu trả lời nào cho câu hỏi này.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 space-y-1.5">
                  {currentQuestionResults.results.map((ans, index) => (
                    <div
                      key={ans.participantId ?? index}
                      className="flex items-start justify-between gap-3 text-[11px] text-zinc-100 border-b border-zinc-800/60 pb-1.5 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {ans.displayName || `Học sinh ${index + 1}`}
                        </p>

                        {ans.answer && ans.answer.trim() !== "" && (
                          <p className="text-zinc-400">
                            Trả lời: <span className="text-zinc-100">{ans.answer}</span>
                          </p>
                        )}
                      </div>

                      <div className="text-right text-[10px]">
                        <p className={ans.isCorrect ? "text-emerald-300 font-semibold" : "text-rose-300 font-semibold"}>
                          {ans.isCorrect ? "Đúng" : "Sai"}
                        </p>
                        <p className="text-zinc-400 mt-0.5">{ans.pointsEarned} điểm</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )} */}
        </div>
      )}
    </section>
  );
}
