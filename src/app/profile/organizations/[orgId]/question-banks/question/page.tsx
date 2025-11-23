"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";
import { getWorkspaceById } from "@/lib/api-workspaces";
import {
  getOrganizationById,
  OrganizationDetailDto,
} from "@/lib/api-organizations";
import { Workspace } from "@/types/workspace";
import {
  createQuestion,
  deleteQuestion,
  getQuestionBank,
  getQuestionsOfQuestionBank,  // 👈 NEW
  QuestionBankDto,
  QuestionDto,
} from "@/lib/api-ques";
import { getMapDetail } from "@/lib/api-maps";

type Question = {
  id: string;
  text: string;
  answer: string;
  remoteId?: string;
};

type QuestionSet = {
  id: string;
  name: string;
  questions: Question[];
};

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

function createInitialSets(): QuestionSet[] {
  const makeQuestions = (count: number, prefix: string): Question[] =>
    Array.from({ length: count }).map((_, idx) => ({
      id: `${prefix}-${idx + 1}`,
      text: "",
      answer: "",
    }));

  return [
    {
      id: "set1",
      name: "Bộ câu hỏi 1 (10 câu)",
      questions: makeQuestions(10, "s1q"),
    },
    {
      id: "set2",
      name: "Bộ câu hỏi 2 (5 câu)",
      questions: makeQuestions(5, "s2q"),
    },
  ];
}

function questionSetsFromApi(apiQuestions: QuestionDto[]): QuestionSet[] {
  const base = createInitialSets();
  if (!apiQuestions || apiQuestions.length === 0) return base;

  const sorted = [...apiQuestions].sort((a, b) => {
    const ao = typeof a.displayOrder === "number" ? a.displayOrder : 0;
    const bo = typeof b.displayOrder === "number" ? b.displayOrder : 0;
    return ao - bo;
  });

  let index = 0;
  for (const q of sorted) {
    let targetSetIdx = 0;
    let questionIdx = index;

    if (index < 10) {
      targetSetIdx = 0;
      questionIdx = index;
    } else if (index < 20) {
      targetSetIdx = 1;
      questionIdx = index - 10;
    } else {
      break;
    }

    const set = base[targetSetIdx];
    const orig = set.questions[questionIdx];
    set.questions[questionIdx] = {
      ...orig,
      text: q.questionText ?? "",
      answer: q.correctAnswerText ?? "",
      remoteId: q.id,
    };

    index++;
  }

  return base;
}

export default function QuestionBuilderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { showToast } = useToast();

  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const searchParams = useSearchParams();
  const bankId = searchParams.get("bankId") ?? "";
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const mapIdFromQuery = searchParams.get("mapId") ?? "";

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [questionBank, setQuestionBank] = useState<QuestionBankDto | null>(
    null
  );
  const [mapName, setMapName] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [questionSets, setQuestionSets] = useState<QuestionSet[]>(() =>
    createInitialSets()
  );
  const [activeSetId, setActiveSetId] = useState<string>("set1");
  const [saving, setSaving] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null
  );

  const activeSet = useMemo(
    () => questionSets.find(s => s.id === activeSetId) ?? questionSets[0],
    [questionSets, activeSetId]
  );

  const loadAll = useCallback(async () => {
    if (!orgId || !workspaceId || !bankId) {
      setErr("Thiếu thông tin bộ câu hỏi. Vui lòng quay lại workspace.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErr(null);

      const [orgRes, workspaceRes, bankRes, questionsRes] = await Promise.all([
        getOrganizationById(orgId),
        getWorkspaceById(workspaceId),
        getQuestionBank(bankId),
        getQuestionsOfQuestionBank(bankId), // 👈 lấy toàn bộ câu hỏi
      ]);

      setOrg(orgRes.organization);
      setWorkspace(workspaceRes);
      // gắn danh sách câu hỏi vào questionBank để dùng lại ở phía dưới
      setQuestionBank({ ...bankRes, questions: questionsRes });

      const mapId = bankRes.mapId || mapIdFromQuery || null;
      if (mapId) {
        try {
          const mapRes = await getMapDetail(mapId);
          const m: any = mapRes?.map ?? mapRes;
          const name =
            m?.name || m?.mapName || m?.map_name || String(mapId);
          setMapName(name);
        } catch {
          setMapName(String(mapId));
        }
      } else {
        setMapName(null);
      }

      if (questionsRes.length > 0) {
        const sets = questionSetsFromApi(questionsRes);
        setQuestionSets(sets);
        setActiveSetId(sets[0]?.id ?? "set1");
      } else {
        setQuestionSets(createInitialSets());
        setActiveSetId("set1");
      }
    } catch (e) {
      setErr(safeMessage(e, t("workspace_detail.request_failed")));
    } finally {
      setLoading(false);
    }
  }, [orgId, workspaceId, bankId, mapIdFromQuery, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleChangeQuestion = (
    setId: string,
    index: number,
    field: "text" | "answer",
    value: string
  ) => {
    setQuestionSets(prev =>
      prev.map(set => {
        if (set.id !== setId) return set;
        const questions = [...set.questions];
        const q = { ...questions[index], [field]: value };
        questions[index] = q;
        return { ...set, questions };
      })
    );
  };

  const handleSave = async () => {
    if (!questionBank?.id) {
      showToast(
        "error",
        "Không tìm thấy bộ câu hỏi. Vui lòng quay lại workspace và tạo lại."
      );
      return;
    }

    const payloadQuestions = questionSets
      .flatMap(set => set.questions)
      .map((q, idx) => ({
        text: q.text.trim(),
        answer: q.answer.trim(),
        index: idx,
      }))
      .filter(x => x.text || x.answer);

    if (payloadQuestions.length === 0) {
      showToast(
        "error",
        "Bạn chưa nhập nội dung cho câu hỏi nào. Hãy nhập ít nhất một câu trước khi lưu."
      );
      return;
    }

    setSaving(true);
    try {
      // lấy các câu hiện có từ API /questions để xoá
      const existingQuestions = await getQuestionsOfQuestionBank(
        questionBank.id
      );
      if (existingQuestions.length > 0) {
        for (const q of existingQuestions) {
          if (q.id) {
            await deleteQuestion(q.id);
          }
        }
      }

      let displayOrder = 1;
      for (const q of payloadQuestions) {
        await createQuestion(questionBank.id, {
          questionBankId: questionBank.id,
          locationId: null,
          questionType: "MULTIPLE_CHOICE",
          questionText: q.text || q.answer || "",
          questionImageUrl: "",
          questionAudioUrl: "",
          points: 0,
          timeLimit: 0,
          correctAnswerText: q.answer || "",
          correctLatitude: 0,
          correctLongitude: 0,
          acceptanceRadiusMeters: 0,
          hintText: "",
          explanation: "",
          displayOrder: displayOrder++,
          options: q.answer
            ? [
                {
                  optionText: q.answer,
                  optionImageUrl: "",
                  isCorrect: true,
                  displayOrder: 1,
                },
              ]
            : [],
        });
      }

      // reload lại metadata + danh sách câu hỏi
      const [reloadedBank, reloadedQuestions] = await Promise.all([
        getQuestionBank(questionBank.id),
        getQuestionsOfQuestionBank(questionBank.id),
      ]);

      setQuestionBank({
        ...reloadedBank,
        questions: reloadedQuestions,
      });

      const sets = questionSetsFromApi(reloadedQuestions ?? []);
      setQuestionSets(sets);
      setActiveSetId(sets[0]?.id ?? "set1");

      showToast("success", "Đã lưu bộ câu hỏi lên server.");
    } catch (e) {
      showToast(
        "error",
        safeMessage(e, "Không thể lưu bộ câu hỏi. Vui lòng thử lại.")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingleQuestion = async (id: string) => {
    if (!id || !questionBank?.id) return;
    setDeletingQuestionId(id);
    try {
      await deleteQuestion(id);

      const [reloadedBank, reloadedQuestions] = await Promise.all([
        getQuestionBank(questionBank.id),
        getQuestionsOfQuestionBank(questionBank.id),
      ]);

      setQuestionBank({
        ...reloadedBank,
        questions: reloadedQuestions,
      });

      const sets = questionSetsFromApi(reloadedQuestions ?? []);
      setQuestionSets(sets);
      setActiveSetId(sets[0]?.id ?? "set1");
      showToast("success", "Đã xóa câu hỏi");
    } catch (e) {
      showToast(
        "error",
        safeMessage(e, "Không thể xóa câu hỏi. Vui lòng thử lại.")
      );
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const setsOverview = useMemo(
    () =>
      questionSets.map(set => {
        const filled = set.questions.filter(
          q => q.text.trim().length > 0 || q.answer.trim().length > 0
        ).length;
        return { id: set.id, name: set.name, total: set.questions.length, filled };
      }),
    [questionSets]
  );

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
      <div className="min-h-[60vh] animate-pulse text-zinc-500 dark:text-zinc-400 px-4">
        {t("workspace_detail.loading")}
      </div>
    );

  if (err || !workspace || !org || !questionBank)
    return (
      <div className="max-w-3xl px-4 text-red-600 dark:text-red-400">
        {err ?? t("workspace_detail.not_found")}
      </div>
    );

  return (
    <div className="min-w-0 relative px-4 pb-10">
      <div className="max-w-6xl mx-auto text-zinc-900 dark:text-zinc-50">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                router.push(
                  `/profile/organizations/${orgId}/workspaces/${workspaceId}`
                )
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
              {(questionBank.mapId || mapName) && (
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  Gắn với bản đồ:{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {mapName ?? String(questionBank.mapId)}
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              2. Nhập nội dung câu hỏi
            </h2>
            <div className="flex flex-wrap gap-2">
              {questionSets.map(set => (
                <button
                  key={set.id}
                  onClick={() => setActiveSetId(set.id)}
                  className={`px-4 py-1.5 rounded-full text-sm border transition ${
                    activeSetId === set.id
                      ? "bg-emerald-500 text-white border-emerald-400"
                      : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:bg-white/5 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/10"
                  }`}
                >
                  {set.name}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
            <div className="mb-4 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold">Đang chỉnh:</span>{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                {activeSet.name}
              </span>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {activeSet.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 sm:p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-none"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Câu {idx + 1}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      {q.text.trim() || q.answer.trim()
                        ? "Đã nhập"
                        : "Chưa nhập"}
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
                            activeSet.id,
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
                        Đáp án / Gợi ý trả lời
                      </label>
                      <textarea
                        value={q.answer}
                        onChange={e =>
                          handleChangeQuestion(
                            activeSet.id,
                            idx,
                            "answer",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg bg-white border border-zinc-200 px-3 py-2 text-sm text-zinc-900 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-white/10 dark:text-zinc-50"
                        placeholder="Nhập đáp án đúng hoặc lời giải thích..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3 text-zinc-900 dark:text-zinc-50">
            3. Tổng quan bộ câu hỏi
          </h2>

          <div className="grid gap-3 sm:grid-cols-3 mb-4">
            {setsOverview.map(s => (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 flex flex-col justify-between shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none"
              >
                <div className="text-sm font-semibold mb-1 text-zinc-900 dark:text-zinc-50">
                  {s.name}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                  {s.filled}/{s.total} câu đã nhập
                </div>
                <button
                  onClick={() => setActiveSetId(s.id)}
                  className="self-start mt-auto text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
                >
                  Chỉnh bộ này
                </button>
              </div>
            ))}
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
                        key={q.id}
                        className="border-t border-zinc-100 hover:bg-zinc-50/70 dark:border-white/10 dark:hover:bg-zinc-900/60"
                      >
                        <td className="px-4 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2 text-zinc-800 dark:text-zinc-50">
                          {q.questionText || q.correctAnswerText || "—"}
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                          {q.correctAnswerText || "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {q.id && (
                            <button
                              onClick={() =>
                                handleDeleteSingleQuestion(q.id as string)
                              }
                              disabled={deletingQuestionId === q.id}
                              className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                            >
                              {deletingQuestionId === q.id ? "Đang xóa" : "Xóa"}
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
