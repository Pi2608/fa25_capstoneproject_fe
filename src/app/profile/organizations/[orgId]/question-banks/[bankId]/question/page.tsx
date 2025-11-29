"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  createQuestion,
  deleteQuestion,
  getQuestionsOfQuestionBank,
  CreateQuestionRequest,
  QuestionDto,
  uploadQuestionImage,
  uploadQuestionAudio,
} from "@/lib/api-ques";
import { useQuestionBankData } from "@/hooks/useQuestionBankData";
import {
  useQuestionSets,
  QUESTION_TYPES,
  QuestionType,
  QuestionOptionInput,
} from "@/hooks/useQuestionSets";
import type { PinLocationPickerProps } from "@/components/question-banks/PinLocationPicker";
import { FullScreenLoading } from "@/components/common/FullScreenLoading";

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Tự luận ngắn",
  PIN_ON_MAP: "Ghim trên bản đồ",
};

const TRUE_FALSE_CHOICES: Array<{ value: "TRUE" | "FALSE"; label: string }> = [
  { value: "TRUE", label: "Đúng" },
  { value: "FALSE", label: "Sai" },
];

const DEFAULT_POINTS = 100;
const DEFAULT_TIME_LIMIT = 30;
const MIN_OPTIONS = 2;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_AUDIO_SIZE_MB = 10;

const PinLocationPicker = dynamic<PinLocationPickerProps>(
  () =>
    import("@/components/question-banks/PinLocationPicker").then(
      mod => mod.default
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Đang tải bản đồ...
      </div>
    ),
  }
);

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createBlankOption(displayOrder: number): QuestionOptionInput {
  return {
    id: generateId("opt"),
    optionText: "",
    isCorrect: false,
    optionImageUrl: "",
    displayOrder,
  };
}

function summarizeAnswer(question: QuestionDto): string {
  switch (question.questionType) {
    case "MULTIPLE_CHOICE": {
      const correct = question.options
        ?.filter(opt => opt.isCorrect)
        .map(opt => opt.optionText)
        .filter(Boolean);
      return correct && correct.length > 0 ? correct.join(", ") : "—";
    }
    case "TRUE_FALSE": {
      const trueIsCorrect =
        question.options?.find(opt => opt.optionText?.toLowerCase() === "true")
          ?.isCorrect ?? true;
      return trueIsCorrect ? "Đúng" : "Sai";
    }
    case "SHORT_ANSWER":
      return question.correctAnswerText || "—";
    case "PIN_ON_MAP":
      if (
        question.correctLatitude == null ||
        question.correctLongitude == null ||
        question.acceptanceRadiusMeters == null
      ) {
        return "—";
      }
      return `(${question.correctLatitude}, ${question.correctLongitude}) ± ${question.acceptanceRadiusMeters}m`;
    default:
      return question.correctAnswerText || "—";
  }
}

function getQuestionTypeLabel(type: string) {
  return QUESTION_TYPE_LABELS[type as QuestionType] ?? type;
}

export default function QuestionBuilderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { showToast } = useToast();

  const params = useParams<{ orgId: string; bankId: string }>();
  const orgId = params?.orgId ?? "";
  const bankId = params?.bankId ?? "";

  const {
    org,
    workspace,
    questionBank,
    mapNames,
    loading,
    err,
    reloadQuestionBank,
  } = useQuestionBankData(orgId, bankId);

  const {
    questions,
    setQuestions,
    handleChangeQuestion,
    handleAddQuestion,
    handleRemoveQuestion,
    overview,
    questionsFromApi,
  } = useQuestionSets(questionBank?.questions ?? []);

  const [saving, setSaving] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null
  );
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const [uploadingAudioFor, setUploadingAudioFor] = useState<string | null>(null);
  const [optionalOpen, setOptionalOpen] = useState<Record<string, boolean>>({});

  const handleQuestionTypeChange = (index: number, nextType: QuestionType) => {
    setQuestions(prev => {
      const updated = [...prev];
      const current = { ...updated[index], questionType: nextType };

      if (nextType === "MULTIPLE_CHOICE" && current.options.length < MIN_OPTIONS) {
        const missing = MIN_OPTIONS - current.options.length;
        const additions = Array.from({ length: missing }).map((_, idx) =>
          createBlankOption(current.options.length + idx + 1)
        );
        current.options = [...current.options, ...additions];
      }

      if (nextType === "TRUE_FALSE") {
        current.trueFalseAnswer = current.trueFalseAnswer ?? "TRUE";
      }

      if (nextType === "PIN_ON_MAP") {
        current.correctLatitude = current.correctLatitude ?? "";
        current.correctLongitude = current.correctLongitude ?? "";
        current.acceptanceRadiusMeters = current.acceptanceRadiusMeters ?? "";
      }

      updated[index] = current;
      return updated;
    });
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    changes: Partial<QuestionOptionInput>
  ) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[questionIndex] };
      q.options = q.options.map((opt, idx) =>
        idx === optionIndex ? { ...opt, ...changes } : opt
      );
      updated[questionIndex] = q;
      return updated;
    });
  };

  const handleToggleOptionCorrect = (questionIndex: number, optionIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[questionIndex] };
      q.options = q.options.map((opt, idx) =>
        idx === optionIndex ? { ...opt, isCorrect: !opt.isCorrect } : opt
      );
      updated[questionIndex] = q;
      return updated;
    });
  };

  const handleAddOptionRow = (questionIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[questionIndex] };
      const nextOrder = q.options.length + 1;
      q.options = [...q.options, createBlankOption(nextOrder)];
      updated[questionIndex] = q;
      return updated;
    });
  };

  const handleRemoveOptionRow = (questionIndex: number, optionIndex: number) => {
    setQuestions(prev => {
      const updated = [...prev];
      const q = { ...updated[questionIndex] };
      if (q.options.length <= MIN_OPTIONS) {
        return prev;
      }

      q.options = q.options
        .filter((_, idx) => idx !== optionIndex)
        .map((opt, idx) => ({ ...opt, displayOrder: idx + 1 }));

      updated[questionIndex] = q;
      return updated;
    });
  };

  const handleUploadQuestionImage = async (index: number, file: File) => {
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      showToast("error", `Ảnh vượt quá ${MAX_IMAGE_SIZE_MB}MB`);
      return;
    }

    const questionId = questions[index]?.id;
    if (!questionId) return;

    setUploadingImageFor(questionId);
    try {
      const url = await uploadQuestionImage(file);
      handleChangeQuestion(index, "questionImageUrl", url);
      showToast("success", "Tải ảnh thành công");
    } catch (error) {
      showToast("error", safeMessage(error, "Không thể tải ảnh"));
    } finally {
      setUploadingImageFor(null);
    }
  };

  const handleUploadQuestionAudio = async (index: number, file: File) => {
    if (file.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
      showToast("error", `Audio vượt quá ${MAX_AUDIO_SIZE_MB}MB`);
      return;
    }

    const questionId = questions[index]?.id;
    if (!questionId) return;

    setUploadingAudioFor(questionId);
    try {
      const url = await uploadQuestionAudio(file);
      handleChangeQuestion(index, "questionAudioUrl", url);
      showToast("success", "Tải audio thành công");
    } catch (error) {
      showToast("error", safeMessage(error, "Không thể tải audio"));
    } finally {
      setUploadingAudioFor(null);
    }
  };

  const buildQuestionPayload = (
    question: (typeof questions)[number],
    displayOrder: number
  ): CreateQuestionRequest => {
    const questionText = question.text.trim();
    if (!questionText) {
      throw new Error("Vui lòng nhập nội dung câu hỏi.");
    }

    const payload: CreateQuestionRequest = {
      questionBankId: questionBank?.questionBankId ?? "",
      questionType: question.questionType,
      questionText,
      questionImageUrl: "",
      questionAudioUrl: "",
      points: DEFAULT_POINTS,
      timeLimit: DEFAULT_TIME_LIMIT,
      hintText: question.hintText.trim() || "",
      explanation: question.explanation.trim() || "",
      displayOrder,
      options: [],
      correctAnswerText: null,
      correctLatitude: null,
      correctLongitude: null,
      acceptanceRadiusMeters: null,
    };

    switch (question.questionType) {
      case "MULTIPLE_CHOICE": {
        const preparedOptions = question.options
          .map((opt, idx) => ({
            optionText: opt.optionText.trim(),
            optionImageUrl: opt.optionImageUrl ?? "",
            isCorrect: opt.isCorrect,
            displayOrder: idx + 1,
          }))
          .filter(opt => opt.optionText.length > 0);

        if (preparedOptions.length < MIN_OPTIONS) {
          throw new Error(
            "Cần ít nhất hai đáp án cho câu hỏi trắc nghiệm."
          );
        }

        if (!preparedOptions.some(opt => opt.isCorrect)) {
          throw new Error("Vui lòng chọn ít nhất một đáp án đúng.");
        }

        payload.options = preparedOptions;
        break;
      }
      case "TRUE_FALSE": {
        payload.options = [
          {
            optionText: "True",
            optionImageUrl: "",
            isCorrect: question.trueFalseAnswer === "TRUE",
            displayOrder: 1,
          },
          {
            optionText: "False",
            optionImageUrl: "",
            isCorrect: question.trueFalseAnswer === "FALSE",
            displayOrder: 2,
          },
        ];
        break;
      }
      case "SHORT_ANSWER": {
        const answer = question.answer.trim();
        if (!answer) {
          throw new Error("Vui lòng nhập đáp án cho câu hỏi tự luận.");
        }
        payload.correctAnswerText = answer;
        break;
      }
      case "PIN_ON_MAP": {
        const lat = Number.parseFloat(question.correctLatitude);
        const lon = Number.parseFloat(question.correctLongitude);
        const radius = Number.parseFloat(question.acceptanceRadiusMeters);

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          throw new Error("Vui lòng nhập toạ độ hợp lệ cho câu hỏi bản đồ.");
        }

        if (Number.isNaN(radius) || radius <= 0) {
          throw new Error("Vui lòng nhập bán kính chấp nhận lớn hơn 0.");
        }

        payload.correctLatitude = lat;
        payload.correctLongitude = lon;
        payload.acceptanceRadiusMeters = radius;
        break;
      }
      default:
        throw new Error("Loại câu hỏi không được hỗ trợ.");
    }

    payload.questionImageUrl = question.questionImageUrl || "";
    payload.questionAudioUrl = question.questionAudioUrl || "";

    return payload;
  };

  const handleSave = async () => {
    if (!questionBank?.questionBankId) {
      showToast(
        "error",
        "Không tìm thấy bộ câu hỏi. Vui lòng quay lại workspace và tạo lại."
      );
      return;
    }

    setSaving(true);
    try {
      const payloads: CreateQuestionRequest[] = [];

      questions.forEach((question, idx) => {
        try {
          payloads.push(buildQuestionPayload(question, idx + 1));
        } catch (validationError) {
          const message =
            validationError instanceof Error
              ? validationError.message
              : "Câu hỏi chưa hợp lệ.";
          throw new Error(`Câu ${idx + 1}: ${message}`);
        }
      });

      if (payloads.length === 0) {
        throw new Error(
          "Bạn chưa nhập nội dung hợp lệ cho bất kỳ câu hỏi nào."
        );
      }

      const existingQuestions = await getQuestionsOfQuestionBank(
        questionBank.questionBankId
      );
      if (existingQuestions.length > 0) {
        for (const q of existingQuestions) {
          if (q.questionId) {
            await deleteQuestion(q.questionId);
          }
        }
      }

      for (const payload of payloads) {
        await createQuestion(questionBank.questionBankId, {
          ...payload,
          questionBankId: questionBank.questionBankId,
        });
      }

      // reload lại metadata + danh sách câu hỏi
      const reloadedQuestions = await reloadQuestionBank();
      if (reloadedQuestions) {
        setQuestions(questionsFromApi(reloadedQuestions));
      }

      showToast("success", t("workspace_detail.save_success"));
    } catch (e) {
      showToast(
        "error",
        safeMessage(e, t("workspace_detail.save_failed"))
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingleQuestion = async (id: string) => {
    if (!id || !questionBank?.questionBankId) return;
    setDeletingQuestionId(id);
    try {
      await deleteQuestion(id);

      const reloadedQuestions = await reloadQuestionBank();
      if (reloadedQuestions) {
        setQuestions(questionsFromApi(reloadedQuestions));
      }

      showToast("success", t("workspace_detail.delete_success"));
    } catch (e) {
      showToast(
        "error",
        safeMessage(e, t("workspace_detail.delete_failed"))
      );
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const questionsFromBank = useMemo(
    () =>
      (questionBank?.questions ?? []).slice().sort((a, b) => {
        const ao = typeof a.displayOrder === "number" ? a.displayOrder : 0;
        const bo = typeof b.displayOrder === "number" ? b.displayOrder : 0;
        return ao - bo;
      }),
    [questionBank]
  );

  if (loading)
    return (
        <FullScreenLoading message={t("common.loading")} overlay={false} />
    );

  if (err || !workspace || !org || !questionBank)
    return (
      <div className="max-w-3xl px-4 text-red-600 dark:text-red-400">
        {err ?? t("common.not_found")}
      </div>
    );

  return (
    <div className="min-w-0 relative px-4 pb-10">
      <div className="max-w-6xl mx-auto text-zinc-900 dark:text-zinc-50">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                router.push(`/profile/organizations/${orgId}/question-banks`)
              }
              className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
                Tạo câu hỏi cho bộ: {questionBank.bankName}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {workspace.workspaceName} · {org.orgName}
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu bộ câu hỏi"}
          </button>
        </div>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
            1. Thông tin bộ câu hỏi
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Tên bộ câu hỏi
              </div>
              <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {questionBank.bankName}
              </div>
              {questionBank.description && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  {questionBank.description}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Thuộc workspace
              </div>
              <div className="text-sm text-zinc-900 dark:text-zinc-50">
                {workspace.workspaceName}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              2. Nhập nội dung câu hỏi
            </h2>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-semibold">Tổng số câu hỏi:</span>{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                  {questions.length} câu
                </span>
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                  ({overview.filled} đã nhập)
                </span>
              </div>
              <button
                onClick={() => handleAddQuestion()}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Thêm câu hỏi
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-none"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Câu {idx + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        {q.text.trim() || q.answer.trim()
                          ? "Đã nhập"
                          : "Chưa nhập"}
                      </div>
                      {questions.length > 1 && (
                        <button
                          onClick={() => handleRemoveQuestion(idx)}
                          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-xs font-semibold p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Xóa câu hỏi này"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                        Nội dung câu hỏi
                      </label>
                      <textarea
                        value={q.text}
                        onChange={e =>
                          handleChangeQuestion(
                            idx,
                            "text",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-900 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-50"
                        placeholder="Nhập nội dung câu hỏi..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                        Loại câu hỏi
                      </label>
                      <select
                        value={q.questionType}
                        onChange={e =>
                          handleQuestionTypeChange(
                            idx,
                            e.target.value as QuestionType
                          )
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-50"
                      >
                        {QUESTION_TYPES.map(type => (
                          <option key={type} value={type}>
                            {QUESTION_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {q.questionType === "SHORT_ANSWER" && (
                    <div className="mt-4">
                      <label className="block text-xs text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                        Đáp án / Gợi ý trả lời
                      </label>
                      <textarea
                        value={q.answer}
                        onChange={e =>
                          handleChangeQuestion(idx, "answer", e.target.value)
                        }
                        className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-900 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-50"
                        placeholder="Nhập đáp án đúng hoặc lời giải thích..."
                      />
                    </div>
                  )}

                  {q.questionType === "MULTIPLE_CHOICE" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Danh sách lựa chọn
                        </span>
                        <button
                          onClick={() => handleAddOptionRow(idx)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-500"
                        >
                          + Thêm lựa chọn
                        </button>
                      </div>
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={opt.id}
                          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-800"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                              Phương án {optIdx + 1}
                            </span>
                            {q.options.length > MIN_OPTIONS && (
                              <button
                                className="text-xs text-red-500 hover:text-red-400"
                                onClick={() => handleRemoveOptionRow(idx, optIdx)}
                                type="button"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                          <input
                            value={opt.optionText}
                            onChange={e =>
                              updateOption(idx, optIdx, {
                                optionText: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-50"
                            placeholder="Nhập nội dung lựa chọn..."
                          />
                          <label className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={opt.isCorrect}
                              onChange={() => handleToggleOptionCorrect(idx, optIdx)}
                              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Đáp án đúng
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.questionType === "TRUE_FALSE" && (
                    <div className="mt-4">
                      <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Đáp án đúng
                      </span>
                      <div className="flex gap-4">
                        {TRUE_FALSE_CHOICES.map(choice => (
                          <label
                            key={choice.value}
                            className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"
                          >
                            <input
                              type="radio"
                              name={`tf-${idx}`}
                              value={choice.value}
                              checked={q.trueFalseAnswer === choice.value}
                              onChange={() =>
                                handleChangeQuestion(
                                  idx,
                                  "trueFalseAnswer",
                                  choice.value
                                )
                              }
                              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                            />
                            {choice.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {q.questionType === "PIN_ON_MAP" && (
                    <div className="mt-4">
                      <span className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Toạ độ chính xác
                      </span>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                            Vĩ độ
                          </label>
                          <input
                            type="number"
                            value={q.correctLatitude}
                            onChange={e =>
                              handleChangeQuestion(idx, "correctLatitude", e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-50"
                            placeholder="Ví dụ: 10.762622"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                            Kinh độ
                          </label>
                          <input
                            type="number"
                            value={q.correctLongitude}
                            onChange={e =>
                              handleChangeQuestion(idx, "correctLongitude", e.target.value)
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-50"
                            placeholder="Ví dụ: 106.660172"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                            Bán kính (m)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={q.acceptanceRadiusMeters}
                            onChange={e =>
                              handleChangeQuestion(
                                idx,
                                "acceptanceRadiusMeters",
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-900 dark:border-white/10 dark:text-zinc-50"
                            placeholder="Ví dụ: 100"
                          />
                        </div>
                      </div>
                      <PinLocationPicker
                        latitude={q.correctLatitude}
                        longitude={q.correctLongitude}
                        radiusMeters={q.acceptanceRadiusMeters}
                        onChange={(lat, lng) => {
                          handleChangeQuestion(idx, "correctLatitude", lat);
                          handleChangeQuestion(idx, "correctLongitude", lng);
                        }}
                        className="mt-4"
                      />
                    </div>
                  )}

                  {(() => {
                    const hasOptionalData =
                      q.questionImageUrl ||
                      q.questionAudioUrl ||
                      q.hintText.trim().length > 0 ||
                      q.explanation.trim().length > 0;
                    const isOpen = optionalOpen[q.id] ?? hasOptionalData;

                    return (
                      <div className="mt-6 rounded-xl border border-dashed border-zinc-200 bg-white dark:border-white/10 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() =>
                            setOptionalOpen(prev => ({ ...prev, [q.id]: !isOpen }))
                          }
                          className="flex w-full items-center justify-between px-4 py-3 text-left"
                        >
                          <div>
                            <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                              Nội dung bổ trợ (tùy chọn)
                            </span>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {hasOptionalData
                                ? "Đã thêm nội dung bổ trợ"
                                : "Thêm ảnh minh hoạ, audio, gợi ý hoặc giải thích khi cần."}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-emerald-600">
                            {isOpen ? "Thu gọn" : "Thêm"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="space-y-4 border-t border-dashed border-zinc-200 px-4 py-4 dark:border-white/10">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  Ảnh minh hoạ
                                </label>
                                {q.questionImageUrl ? (
                                  <div className="space-y-2">
                                    <img
                                      src={q.questionImageUrl}
                                      alt={`Question ${idx + 1} illustration`}
                                      className="w-full rounded-lg border border-zinc-200 object-cover dark:border-white/10"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                                        onClick={() => handleChangeQuestion(idx, "questionImageUrl", "")}
                                        disabled={uploadingImageFor === q.id}
                                      >
                                        Gỡ ảnh
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400">
                                    <span>
                                      {uploadingImageFor === q.id ? "Đang tải ảnh..." : "Nhấn để chọn ảnh (JPG, PNG, ≤ 5MB)"}
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={event => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void handleUploadQuestionImage(idx, file);
                                          event.target.value = "";
                                        }
                                      }}
                                      disabled={uploadingImageFor === q.id}
                                    />
                                  </label>
                                )}
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  Audio (thuyết minh / gợi ý)
                                </label>
                                {q.questionAudioUrl ? (
                                  <div className="space-y-2">
                                    <audio
                                      src={q.questionAudioUrl}
                                      controls
                                      className="w-full rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/10"
                                        onClick={() => handleChangeQuestion(idx, "questionAudioUrl", "")}
                                        disabled={uploadingAudioFor === q.id}
                                      >
                                        Gỡ audio
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:text-emerald-400">
                                    <span>
                                      {uploadingAudioFor === q.id ? "Đang tải audio..." : "Nhấn để chọn file audio (MP3, WAV, ≤ 10MB)"}
                                    </span>
                                    <input
                                      type="file"
                                      accept="audio/*"
                                      className="hidden"
                                      onChange={event => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void handleUploadQuestionAudio(idx, file);
                                          event.target.value = "";
                                        }
                                      }}
                                      disabled={uploadingAudioFor === q.id}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  Gợi ý (Hint)
                                </label>
                                <textarea
                                  value={q.hintText}
                                  onChange={e => handleChangeQuestion(idx, "hintText", e.target.value)}
                                  className="min-h-[80px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                                  placeholder="Nhập gợi ý để giúp học sinh (tùy chọn)..."
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                  Giải thích sau khi trả lời
                                </label>
                                <textarea
                                  value={q.explanation}
                                  onChange={e => handleChangeQuestion(idx, "explanation", e.target.value)}
                                  className="min-h-[80px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                                  placeholder="Nhập lời giải thích sẽ hiển thị sau khi trả lời..."
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-zinc-50">
            3. Tổng quan bộ câu hỏi
          </h2>

          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 mb-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
                  {questionBank.bankName}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {overview.filled}/{overview.total} câu đã nhập
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {overview.filled}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  câu hoàn thành
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/10">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Danh sách câu hỏi trong bộ
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {questionsFromBank.length} câu
              </span>
            </div>
            {questionsFromBank.length === 0 ? (
              <div className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                Chưa có câu hỏi nào trong bộ.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50/70 text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
                      <th className="px-4 py-2 text-left font-semibold w-16">
                        #
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        Nội dung
                      </th>
                      <th className="px-4 py-2 text-left font-semibold w-32">
                        Loại
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        Đáp án
                      </th>
                      <th className="px-4 py-2 text-right font-semibold w-32">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {questionsFromBank.map((q, idx) => (
                      <tr
                        key={q.questionId}
                        className="border-t border-zinc-100 hover:bg-zinc-50/70 dark:border-white/10 dark:hover:bg-zinc-900/60"
                      >
                        <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2 text-zinc-800 dark:text-zinc-50">
                          {q.questionText || q.correctAnswerText || "—"}
                        </td>
                        <td className="px-4 py-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          {getQuestionTypeLabel(q.questionType)}
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                          {summarizeAnswer(q)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {q.questionId && (
                            <button
                              onClick={() =>
                                handleDeleteSingleQuestion(q.questionId as string)
                              }
                              disabled={deletingQuestionId === q.questionId}
                              className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                            >
                              {deletingQuestionId === q.questionId ? "Đang xóa" : "Xóa"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

