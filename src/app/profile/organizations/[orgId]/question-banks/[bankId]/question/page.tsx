"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
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
import Loading from "@/app/loading";

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

const TRUE_FALSE_CHOICES: Array<{ value: "TRUE" | "FALSE" }> = [
  { value: "TRUE" },
  { value: "FALSE" },
];

const DEFAULT_POINTS = 100;
const DEFAULT_TIME_LIMIT = 30;
const MIN_OPTIONS = 2;

const PinLocationPicker = dynamic<PinLocationPickerProps>(
  () =>
    import("@/components/question-banks/PinLocationPicker").then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed text-sm">
        <Loading />
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

function summarizeAnswer(question: QuestionDto, t: ReturnType<typeof useI18n>["t"]): string {
  switch (question.questionType) {
    case "MULTIPLE_CHOICE": {
      const correct = question.options
        ?.filter((opt) => opt.isCorrect)
        .map((opt) => opt.optionText)
        .filter(Boolean);
      return correct && correct.length > 0 ? correct.join(", ") : "—";
    }
    case "TRUE_FALSE": {
      const trueIsCorrect =
        question.options?.find(
          (opt) => opt.optionText?.toLowerCase() === "true"
        )?.isCorrect ?? true;
      return trueIsCorrect
        ? t("org_question_builder", "tf_true_label")
        : t("org_question_builder", "tf_false_label");
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
      return t("org_question_builder", "pin_answer_summary", {
        lat: question.correctLatitude,
        lon: question.correctLongitude,
        radius: question.acceptanceRadiusMeters,
      });
    default:
      return question.correctAnswerText || "—";
  }
}

function getQuestionTypeLabel(
  type: string,
  t: ReturnType<typeof useI18n>["t"]
) {
  switch (type as QuestionType) {
    case "MULTIPLE_CHOICE":
      return t("org_question_builder", "type_multiple_choice");
    case "TRUE_FALSE":
      return t("org_question_builder", "type_true_false");
    case "SHORT_ANSWER":
      return t("org_question_builder", "type_short_answer");
    case "PIN_ON_MAP":
      return t("org_question_builder", "type_pin_on_map");
    default:
      return type;
  }
}

export default function QuestionBuilderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { showToast } = useToast();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const params = useParams<{ orgId: string; bankId: string }>();
  const orgId = params?.orgId ?? "";
  const bankId = params?.bankId ?? "";

  const {
    org,
    workspace,
    questionBank,
    sessionNames,
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
  const [uploadingImageFor, setUploadingImageFor] =
    useState<string | null>(null);
  const [uploadingAudioFor, setUploadingAudioFor] =
    useState<string | null>(null);
  const [optionalOpen, setOptionalOpen] = useState<Record<string, boolean>>({});

  const handleQuestionTypeChange = (index: number, nextType: QuestionType) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], questionType: nextType };

      if (
        nextType === "MULTIPLE_CHOICE" &&
        current.options.length < MIN_OPTIONS
      ) {
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
        current.acceptanceRadiusMeters =
          current.acceptanceRadiusMeters ?? "";
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
    setQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[questionIndex] };
      q.options = q.options.map((opt, idx) =>
        idx === optionIndex ? { ...opt, ...changes } : opt
      );
      updated[questionIndex] = q;
      return updated;
    });
  };

  const handleToggleOptionCorrect = (
    questionIndex: number,
    optionIndex: number
  ) => {
    setQuestions((prev) => {
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
    setQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[questionIndex] };
      const nextOrder = q.options.length + 1;
      q.options = [...q.options, createBlankOption(nextOrder)];
      updated[questionIndex] = q;
      return updated;
    });
  };

  const handleRemoveOptionRow = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) => {
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
    const questionId = questions[index]?.id;
    if (!questionId) return;

    setUploadingImageFor(questionId);
    try {
      const url = await uploadQuestionImage(file);
      handleChangeQuestion(index, "questionImageUrl", url);
      showToast(
        "success",
        t("org_question_builder", "toast_upload_image_success")
      );
    } catch (error) {
      showToast(
        "error",
        safeMessage(
          error,
          t("org_question_builder", "toast_upload_image_error")
        )
      );
    } finally {
      setUploadingImageFor(null);
    }
  };

  const handleUploadQuestionAudio = async (index: number, file: File) => {
    const questionId = questions[index]?.id;
    if (!questionId) return;

    setUploadingAudioFor(questionId);
    try {
      const url = await uploadQuestionAudio(file);
      handleChangeQuestion(index, "questionAudioUrl", url);
      showToast(
        "success",
        t("org_question_builder", "toast_upload_audio_success")
      );
    } catch (error) {
      showToast(
        "error",
        safeMessage(
          error,
          t("org_question_builder", "toast_upload_audio_error")
        )
      );
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
      throw new Error(
        t("org_question_builder", "validation_question_text_required")
      );
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
          .filter((opt) => opt.optionText.length > 0);

        if (preparedOptions.length < MIN_OPTIONS) {
          throw new Error(
            t("org_question_builder", "validation_mc_min_options")
          );
        }

        if (!preparedOptions.some((opt) => opt.isCorrect)) {
          throw new Error(
            t("org_question_builder", "validation_mc_need_correct")
          );
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
          throw new Error(
            t("org_question_builder", "validation_short_answer_required")
          );
        }
        payload.correctAnswerText = answer;
        break;
      }
      case "PIN_ON_MAP": {
        const lat = Number.parseFloat(question.correctLatitude);
        const lon = Number.parseFloat(question.correctLongitude);
        const radius = Number.parseFloat(question.acceptanceRadiusMeters);

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          throw new Error(
            t("org_question_builder", "validation_pin_coords_required")
          );
        }

        if (Number.isNaN(radius) || radius <= 0) {
          throw new Error(
            t("org_question_builder", "validation_pin_radius_required")
          );
        }

        payload.correctLatitude = lat;
        payload.correctLongitude = lon;
        payload.acceptanceRadiusMeters = radius;
        break;
      }
      default:
        throw new Error(
          t("org_question_builder", "validation_question_type_not_supported")
        );
    }

    payload.questionImageUrl = question.questionImageUrl || "";
    payload.questionAudioUrl = question.questionAudioUrl || "";

    return payload;
  };

  const handleSave = async () => {
    if (!questionBank?.questionBankId) {
      showToast(
        "error",
        t("org_question_builder", "error_missing_question_bank")
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
              : t("org_question_builder", "validation_question_invalid");
          throw new Error(
            t("org_question_builder", "validation_question_index_error", {
              index: idx + 1,
              message,
            })
          );
        }
      });

      if (payloads.length === 0) {
        throw new Error(
          t("org_question_builder", "validation_no_valid_questions")
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

      const reloadedQuestions = await reloadQuestionBank();
      if (reloadedQuestions) {
        setQuestions(questionsFromApi(reloadedQuestions));
      }

      showToast(
        "success",
        t("org_question_builder", "toast_save_success")
      );
    } catch (e) {
      showToast(
        "error",
        safeMessage(
          e,
          t("org_question_builder", "toast_save_failed")
        )
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

      showToast(
        "success",
        t("org_question_builder", "toast_delete_success")
      );
    } catch (e) {
      showToast(
        "error",
        safeMessage(
          e,
          t("org_question_builder", "toast_delete_failed")
        )
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

  if (loading) {
    return null;
  }

  if (err || !workspace || !org || !questionBank)
    return (
      <div
        className={`max-w-3xl px-4 ${
          isDark ? "text-red-400" : "text-red-600"
        }`}
      >
        {err ?? t("common.not_found")}
      </div>
    );

  return (
    <div className="min-w-0 relative px-4 pb-10">
      <div
        className={`max-w-6xl mx-auto ${
          isDark ? "text-zinc-50" : "text-zinc-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                router.push(`/profile/organizations/${orgId}/question-banks`)
              }
              className={`px-3 py-1.5 rounded-lg border text-sm ${themeClasses.button}`}
            >
              {t("org_question_builder", "header_back")}
            </button>
            <div>
              <h1
                className={`text-2xl sm:text-3xl font-semibold ${
                  isDark ? "text-zinc-100" : "text-emerald-700"
                }`}
              >
                {t("org_question_builder", "header_title", {
                  name: questionBank.bankName,
                })}
              </h1>
              <p className={`text-sm ${themeClasses.textMuted}`}>
                {workspace.workspaceName} · {org.orgName}
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60"
          >
            {saving
              ? t("org_question_builder", "header_save_saving")
              : t("org_question_builder", "header_save")}
          </button>
        </div>

        {/* 1. Info */}
        <section
          className={`mb-8 rounded-2xl border px-4 py-5 shadow-sm ${themeClasses.panel}`}
        >
          <h2
            className={`text-lg font-semibold mb-4 ${
              isDark ? "text-emerald-300" : "text-emerald-600"
            }`}
          >
            {t("org_question_builder", "step1_title")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className={`text-xs ${themeClasses.textMuted}`}>
                {t("org_question_builder", "step1_bank_name_label")}
              </div>
              <div
                className={`text-base font-semibold ${
                  isDark ? "text-emerald-300" : "text-emerald-600"
                }`}
              >
                {questionBank.bankName}
              </div>
              {questionBank.description && (
                <p className={`text-xs mt-1 ${themeClasses.textMuted}`}>
                  {questionBank.description}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className={`text-xs ${themeClasses.textMuted}`}>
                {t("org_question_builder", "step1_workspace_label")}
              </div>
              <div
                className={`text-base font-semibold ${
                  isDark ? "text-emerald-300" : "text-emerald-600"
                }`}
              >
                {workspace.workspaceName}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Input questions */}
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <h2
              className={`text-lg font-semibold ${
                isDark ? "text-emerald-300" : "text-emerald-600"
              }`}
            >
              {t("org_question_builder", "step2_title")}
            </h2>
          </div>

          <div
            className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${themeClasses.panel}`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div
                className={`text-sm ${
                  isDark ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                {t("org_question_builder", "summary_line", {
                  total: questions.length,
                  filled: overview.filled,
                })}
              </div>
              <button
                onClick={() => handleAddQuestion()}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                {t("org_question_builder", "add_question_btn")}
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isFilled =
                  q.text.trim().length > 0 || q.answer.trim().length > 0;
                const questionId = q.id;

                const hasOptionalData =
                  q.questionImageUrl ||
                  q.questionAudioUrl ||
                  q.hintText.trim().length > 0 ||
                  q.explanation.trim().length > 0;
                const isOpen = optionalOpen[questionId] ?? hasOptionalData;

                return (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-3 sm:p-4 shadow-sm ${
                      isDark
                        ? "border-white/10 bg-zinc-900/80"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`text-sm font-semibold ${
                          isDark ? "text-zinc-50" : "text-zinc-900"
                        }`}
                      >
                        {t("org_question_builder", "question_title", {
                          index: idx + 1,
                        })}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-xs ${themeClasses.textMuted}`}>
                          {isFilled
                            ? t(
                                "org_question_builder",
                                "question_status_filled"
                              )
                            : t(
                                "org_question_builder",
                                "question_status_empty"
                              )}
                        </div>
                        {questions.length > 1 && (
                          <button
                            onClick={() => handleRemoveQuestion(idx)}
                            className={`text-xs font-semibold p-1.5 rounded transition-colors ${
                              isDark
                                ? "text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                : "text-red-500 hover:text-red-600 hover:bg-red-50"
                            }`}
                            title={t(
                              "org_question_builder",
                              "question_delete_title"
                            )}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <label
                          className={`block text-xs font-semibold mb-1 ${
                            isDark ? "text-zinc-300" : "text-zinc-700"
                          }`}
                        >
                          {t(
                            "org_question_builder",
                            "question_content_label"
                          )}
                        </label>
                        <textarea
                          value={q.text}
                          onChange={(e) =>
                            handleChangeQuestion(idx, "text", e.target.value)
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.input}`}
                          placeholder={t(
                            "org_question_builder",
                            "question_content_placeholder"
                          )}
                        />
                      </div>

                      <div>
                        <label
                          className={`block text-xs font-semibold mb-1 ${
                            isDark ? "text-zinc-300" : "text-zinc-700"
                          }`}
                        >
                          {t(
                            "org_question_builder",
                            "question_type_label"
                          )}
                        </label>
                        <select
                          value={q.questionType}
                          onChange={(e) =>
                            handleQuestionTypeChange(
                              idx,
                              e.target.value as QuestionType
                            )
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.select}`}
                        >
                          {QUESTION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {getQuestionTypeLabel(type, t)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* SHORT ANSWER */}
                    {q.questionType === "SHORT_ANSWER" && (
                      <div className="mt-4">
                        <label
                          className={`block text-xs font-semibold mb-1 ${
                            isDark ? "text-zinc-300" : "text-zinc-700"
                          }`}
                        >
                          {t(
                            "org_question_builder",
                            "short_answer_label"
                          )}
                        </label>
                        <textarea
                          value={q.answer}
                          onChange={(e) =>
                            handleChangeQuestion(
                              idx,
                              "answer",
                              e.target.value
                            )
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.input}`}
                          placeholder={t(
                            "org_question_builder",
                            "short_answer_placeholder"
                          )}
                        />
                      </div>
                    )}

                    {/* MULTIPLE CHOICE */}
                    {q.questionType === "MULTIPLE_CHOICE" && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-semibold ${
                              isDark ? "text-zinc-300" : "text-zinc-700"
                            }`}
                          >
                            {t(
                              "org_question_builder",
                              "mc_list_label"
                            )}
                          </span>
                          <button
                            onClick={() => handleAddOptionRow(idx)}
                            className={`text-xs font-semibold ${
                              isDark
                                ? "text-emerald-300 hover:text-emerald-200"
                                : "text-emerald-600 hover:text-emerald-500"
                            }`}
                          >
                            {t(
                              "org_question_builder",
                              "mc_add_option_btn"
                            )}
                          </button>
                        </div>
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={opt.id}
                            className={`rounded-lg border p-3 ${
                              isDark
                                ? "border-white/10 bg-zinc-800"
                                : "border-zinc-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-xs font-semibold ${themeClasses.textMuted}`}
                              >
                                {t(
                                  "org_question_builder",
                                  "mc_option_label",
                                  { index: optIdx + 1 }
                                )}
                              </span>
                              {q.options.length > MIN_OPTIONS && (
                                <button
                                  className={`text-xs ${
                                    isDark
                                      ? "text-red-400 hover:text-red-300"
                                      : "text-red-500 hover:text-red-400"
                                  }`}
                                  onClick={() =>
                                    handleRemoveOptionRow(idx, optIdx)
                                  }
                                  type="button"
                                >
                                  {t(
                                    "org_question_builder",
                                    "mc_delete_option_btn"
                                  )}
                                </button>
                              )}
                            </div>
                            <input
                              value={opt.optionText}
                              onChange={(e) =>
                                updateOption(idx, optIdx, {
                                  optionText: e.target.value,
                                })
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.input}`}
                              placeholder={t(
                                "org_question_builder",
                                "mc_option_placeholder"
                              )}
                            />
                            <label
                              className={`mt-2 inline-flex items-center gap-2 text-xs font-medium ${themeClasses.textMuted}`}
                            >
                              <input
                                type="checkbox"
                                checked={opt.isCorrect}
                                onChange={() =>
                                  handleToggleOptionCorrect(idx, optIdx)
                                }
                                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              {t(
                                "org_question_builder",
                                "mc_mark_correct_label"
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TRUE/FALSE */}
                    {q.questionType === "TRUE_FALSE" && (
                      <div className="mt-4">
                        <span
                          className={`block text-xs font-semibold mb-2 ${
                            isDark ? "text-zinc-300" : "text-zinc-700"
                          }`}
                        >
                          {t(
                            "org_question_builder",
                            "tf_correct_label"
                          )}
                        </span>
                        <div className="flex gap-4">
                          {TRUE_FALSE_CHOICES.map((choice) => (
                            <label
                              key={choice.value}
                              className={`inline-flex items-center gap-2 text-sm ${
                                isDark ? "text-zinc-200" : "text-zinc-700"
                              }`}
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
                              {choice.value === "TRUE"
                                ? t(
                                    "org_question_builder",
                                    "tf_true_label"
                                  )
                                : t(
                                    "org_question_builder",
                                    "tf_false_label"
                                  )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PIN ON MAP */}
                    {q.questionType === "PIN_ON_MAP" && (
                      <div className="mt-4">
                        <span
                          className={`block text-xs font-semibold mb-2 ${
                            isDark ? "text-zinc-300" : "text-zinc-700"
                          }`}
                        >
                          {t(
                            "org_question_builder",
                            "pin_exact_label"
                          )}
                        </span>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label
                              className={`block text-[11px] uppercase tracking-wide mb-1 ${themeClasses.textMuted}`}
                            >
                              {t(
                                "org_question_builder",
                                "pin_lat_label"
                              )}
                            </label>
                            <input
                              type="number"
                              value={q.correctLatitude}
                              onChange={(e) =>
                                handleChangeQuestion(
                                  idx,
                                  "correctLatitude",
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.input}`}
                              placeholder={t(
                                "org_question_builder",
                                "pin_lat_placeholder"
                              )}
                            />
                          </div>
                          <div>
                            <label
                              className={`block text-[11px] uppercase tracking-wide mb-1 ${themeClasses.textMuted}`}
                            >
                              {t(
                                "org_question_builder",
                                "pin_lon_label"
                              )}
                            </label>
                            <input
                              type="number"
                              value={q.correctLongitude}
                              onChange={(e) =>
                                handleChangeQuestion(
                                  idx,
                                  "correctLongitude",
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.input}`}
                              placeholder={t(
                                "org_question_builder",
                                "pin_lon_placeholder"
                              )}
                            />
                          </div>
                          <div>
                            <label
                              className={`block text-[11px] uppercase tracking-wide mb-1 ${themeClasses.textMuted}`}
                            >
                              {t(
                                "org_question_builder",
                                "pin_radius_label"
                              )}
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={q.acceptanceRadiusMeters}
                              onChange={(e) =>
                                handleChangeQuestion(
                                  idx,
                                  "acceptanceRadiusMeters",
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 ${themeClasses.input}`}
                              placeholder={t(
                                "org_question_builder",
                                "pin_radius_placeholder"
                              )}
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

                    {/* Optional content */}
                    <div
                      className={`mt-6 rounded-xl border border-dashed ${
                        isDark
                          ? "border-white/10 bg-white/5"
                          : "border-zinc-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOptionalOpen((prev) => ({
                            ...prev,
                            [questionId]: !isOpen,
                          }))
                        }
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div>
                          <span
                            className={`block text-sm font-semibold ${
                              isDark ? "text-zinc-100" : "text-zinc-800"
                            }`}
                          >
                            {t(
                              "org_question_builder",
                              "optional_title"
                            )}
                          </span>
                          <p
                            className={`text-xs ${themeClasses.textMuted}`}
                          >
                            {hasOptionalData
                              ? t(
                                  "org_question_builder",
                                  "optional_subtitle_filled"
                                )
                              : t(
                                  "org_question_builder",
                                  "optional_subtitle_empty"
                                )}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            isDark ? "text-emerald-300" : "text-emerald-600"
                          }`}
                        >
                          {isOpen
                            ? t(
                                "org_question_builder",
                                "optional_toggle_collapse"
                              )
                            : t(
                                "org_question_builder",
                                "optional_toggle_expand"
                              )}
                        </span>
                      </button>

                      {isOpen && (
                        <div
                          className={`space-y-4 border-t border-dashed px-4 py-4 ${themeClasses.tableBorder}`}
                        >
                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Image */}
                            <div className="space-y-2">
                              <label
                                className={`text-xs font-semibold ${
                                  isDark ? "text-zinc-300" : "text-zinc-700"
                                }`}
                              >
                                {t(
                                  "org_question_builder",
                                  "optional_image_label"
                                )}
                              </label>
                              {q.questionImageUrl ? (
                                <div className="space-y-2">
                                  <img
                                    src={q.questionImageUrl}
                                    alt={`Question ${idx + 1} illustration`}
                                    className={`w-full rounded-lg border object-cover ${themeClasses.tableBorder}`}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${themeClasses.button}`}
                                      onClick={() =>
                                        handleChangeQuestion(
                                          idx,
                                          "questionImageUrl",
                                          ""
                                        )
                                      }
                                      disabled={
                                        uploadingImageFor === questionId
                                      }
                                    >
                                      {t(
                                        "org_question_builder",
                                        "optional_image_remove"
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label
                                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs ${themeClasses.textMuted} ${
                                    isDark
                                      ? "border-white/10 hover:border-emerald-500 hover:text-emerald-400"
                                      : "border-gray-300 hover:border-emerald-400 hover:text-emerald-600"
                                  }`}
                                >
                                  <span>
                                    {uploadingImageFor === questionId ? (
                                      <Loading />
                                    ) : (
                                      t(
                                        "org_question_builder",
                                        "optional_image_upload"
                                      )
                                    )}
                                  </span>

                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file =
                                        event.target.files?.[0];
                                      if (file) {
                                        void handleUploadQuestionImage(
                                          idx,
                                          file
                                        );
                                        event.target.value = "";
                                      }
                                    }}
                                    disabled={
                                      uploadingImageFor === questionId
                                    }
                                  />
                                </label>
                              )}
                            </div>

                            {/* Audio */}
                            <div className="space-y-2">
                              <label
                                className={`text-xs font-semibold ${
                                  isDark ? "text-zinc-300" : "text-zinc-700"
                                }`}
                              >
                                {t(
                                  "org_question_builder",
                                  "optional_audio_label"
                                )}
                              </label>
                              {q.questionAudioUrl ? (
                                <div className="space-y-2">
                                  <audio
                                    src={q.questionAudioUrl}
                                    controls
                                    className={`w-full rounded-lg p-2 ${
                                      isDark ? "bg-zinc-800" : "bg-zinc-100"
                                    }`}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold ${themeClasses.button}`}
                                      onClick={() =>
                                        handleChangeQuestion(
                                          idx,
                                          "questionAudioUrl",
                                          ""
                                        )
                                      }
                                      disabled={
                                        uploadingAudioFor === questionId
                                      }
                                    >
                                      {t(
                                        "org_question_builder",
                                        "optional_audio_remove"
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label
                                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs ${themeClasses.textMuted} ${
                                    isDark
                                      ? "border-white/10 hover:border-emerald-500 hover:text-emerald-400"
                                      : "border-gray-300 hover:border-emerald-400 hover:text-emerald-600"
                                  }`}
                                >
                                  <span>
                                    {uploadingAudioFor === questionId ? (
                                      <Loading />
                                    ) : (
                                      t(
                                        "org_question_builder",
                                        "optional_audio_upload"
                                      )
                                    )}
                                  </span>

                                  <input
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={(event) => {
                                      const file =
                                        event.target.files?.[0];
                                      if (file) {
                                        void handleUploadQuestionAudio(
                                          idx,
                                          file
                                        );
                                        event.target.value = "";
                                      }
                                    }}
                                    disabled={
                                      uploadingAudioFor === questionId
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label
                                className={`mb-1 block text-xs font-semibold ${
                                  isDark ? "text-zinc-300" : "text-zinc-700"
                                }`}
                              >
                                {t(
                                  "org_question_builder",
                                  "optional_hint_label"
                                )}
                              </label>
                              <textarea
                                value={q.hintText}
                                onChange={(e) =>
                                  handleChangeQuestion(
                                    idx,
                                    "hintText",
                                    e.target.value
                                  )
                                }
                                className={`min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                                placeholder={t(
                                  "org_question_builder",
                                  "optional_hint_placeholder"
                                )}
                              />
                            </div>
                            <div>
                              <label
                                className={`mb-1 block text-xs font-semibold ${
                                  isDark ? "text-zinc-300" : "text-zinc-700"
                                }`}
                              >
                                {t(
                                  "org_question_builder",
                                  "optional_explanation_label"
                                )}
                              </label>
                              <textarea
                                value={q.explanation}
                                onChange={(e) =>
                                  handleChangeQuestion(
                                    idx,
                                    "explanation",
                                    e.target.value
                                  )
                                }
                                className={`min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                                placeholder={t(
                                  "org_question_builder",
                                  "optional_explanation_placeholder"
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. Overview */}
        <section>
          <h2
            className={`mb-3 text-lg font-semibold ${
              isDark ? "text-emerald-300" : "text-emerald-700"
            }`}
          >
            {t("org_question_builder", "step3_title")}
          </h2>

          <div
            className={`mb-4 rounded-xl border px-4 py-3 shadow-sm ${themeClasses.panel}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={`mb-1 text-sm font-semibold ${
                    isDark ? "text-emerald-300" : "text-emerald-700"
                  }`}
                >
                  {questionBank.bankName}
                </div>
                <div className={`text-xs ${themeClasses.textMuted}`}>
                  {t("org_question_builder", "overview_subtitle", {
                    filled: overview.filled,
                    total: overview.total,
                  })}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-bold ${
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  }`}
                >
                  {overview.filled}
                </div>
                <div className={`text-xs ${themeClasses.textMuted}`}>
                  {t(
                    "org_question_builder",
                    "overview_completed_label"
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            className={`rounded-2xl border shadow-sm ${themeClasses.panel}`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-3 ${themeClasses.tableBorder}`}
            >
              <h3
                className={`text-sm font-semibold ${
                  isDark ? "text-zinc-50" : "text-zinc-900"
                }`}
              >
                {t(
                  "org_question_builder",
                  "overview_list_title"
                )}
              </h3>
              <span className={`text-xs ${themeClasses.textMuted}`}>
                {t(
                  "org_question_builder",
                  "overview_list_count",
                  { count: questionsFromBank.length }
                )}
              </span>
            </div>
            {questionsFromBank.length === 0 ? (
              <div
                className={`px-4 py-4 text-sm ${themeClasses.textMuted}`}
              >
                {t(
                  "org_question_builder",
                  "overview_empty"
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr
                      className={`${
                        isDark ? "bg-zinc-900/70" : "bg-zinc-50/70"
                      } ${themeClasses.tableHeader}`}
                    >
                      <th className="w-16 px-4 py-2 text-left font-semibold">
                        {t("org_question_builder", "th_index")}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        {t("org_question_builder", "th_content")}
                      </th>
                      <th className="w-32 px-4 py-2 text-left font-semibold">
                        {t("org_question_builder", "th_type")}
                      </th>
                      <th className="px-4 py-2 text-left font-semibold">
                        {t("org_question_builder", "th_answer")}
                      </th>
                      <th className="w-32 px-4 py-2 text-right font-semibold">
                        {t("org_question_builder", "th_actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={
                      isDark ? "text-zinc-50" : "text-zinc-700"
                    }
                  >
                    {questionsFromBank.map((q, idx) => (
                      <tr
                        key={q.questionId}
                        className={`border-t ${themeClasses.tableBorder} ${
                          isDark
                            ? "hover:bg-zinc-900/60"
                            : "hover:bg-zinc-50/70"
                        }`}
                      >
                        <td
                          className={`px-4 py-2 text-xs ${themeClasses.textMuted}`}
                        >
                          {idx + 1}
                        </td>

                        <td className={`px-4 py-2 ${themeClasses.tableCell}`}>
                          {q.questionText ||
                            q.correctAnswerText ||
                            "—"}
                        </td>

                        <td
                          className={`px-4 py-2 text-xs uppercase tracking-wide ${themeClasses.textMuted}`}
                        >
                          {getQuestionTypeLabel(q.questionType, t)}
                        </td>
                        <td
                          className={`px-4 py-2 ${
                            isDark ? "text-zinc-300" : "text-zinc-600"
                          }`}
                        >
                          {summarizeAnswer(q, t)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {q.questionId && (
                            <button
                              onClick={() =>
                                handleDeleteSingleQuestion(
                                  q.questionId as string
                                )
                              }
                              disabled={
                                deletingQuestionId === q.questionId
                              }
                              className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                            >
                              {deletingQuestionId === q.questionId
                                ? t(
                                    "org_question_builder",
                                    "btn_deleting"
                                  )
                                : t(
                                    "org_question_builder",
                                    "btn_delete"
                                  )}
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
