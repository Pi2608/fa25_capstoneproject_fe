"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  getOrganizationById,
  type OrganizationDetailDto,
} from "@/lib/api-organizations";
import {
  getMyQuestionBanks,
  getPublicQuestionBanks,
  createQuestionBank,
  deleteQuestionBank,
  getQuestionBank,
  type QuestionBankDto,
} from "@/lib/api-ques";
import {
  getProjectsByOrganization,
  getWorkspaceMaps,
} from "@/lib/api-workspaces";
import type { Workspace } from "@/types/workspace";

type QuestionBankFormState = {
  bankName: string;
  description: string;
  category: string;
  tags: string;
  isTemplate: boolean;
  isPublic: boolean;
};

type TabKey = "my" | "public";

type MapOption = {
  id: string;
  name: string;
};

type BankExtra = {
  totalQuestions: number;
  tags: string[];
};

function safeMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

function getBaseQuestionCount(bank: QuestionBankDto | any): number {
  const anyBank = bank as any;
  const raw =
    anyBank.totalQuestions ??
    anyBank.TotalQuestions ??
    (Array.isArray(anyBank.questions) ? anyBank.questions.length : undefined);
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function labelFromCount(count: number): string {
  if (count === 0) return "Chưa có";
  if (count === 1) return "1 câu";
  return `${count} câu`;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

export default function QuestionBanksPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { showToast } = useToast();
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);

  const [myBanks, setMyBanks] = useState<QuestionBankDto[]>([]);
  const [publicBanks, setPublicBanks] = useState<QuestionBankDto[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("my");

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [maps, setMaps] = useState<MapOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedMapId, setSelectedMapId] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionBankFormState>({
    bankName: "",
    description: "",
    category: "",
    tags: "",
    isTemplate: false,
    isPublic: false,
  });

  const [bankDetails, setBankDetails] = useState<Record<string, BankExtra>>({});

  const resetForm = () =>
    setForm({
      bankName: "",
      description: "",
      category: "",
      tags: "",
      isTemplate: false,
      isPublic: false,
    });

  const handleFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const fetchBankDetails = useCallback(async (banks: QuestionBankDto[]) => {
    const ids = Array.from(
      new Set(
        banks
          .map(b => (b as any).id ?? (b as any).questionBankId ?? "")
          .filter(Boolean)
      )
    );
    if (ids.length === 0) {
      setBankDetails({});
      return;
    }
    try {
      const results = await Promise.all(
        ids.map(id =>
          getQuestionBank(id).catch(() => null)
        )
      );
      setBankDetails(() => {
        const map: Record<string, BankExtra> = {};
        results.forEach(detail => {
          if (!detail) return;
          const anyDetail = detail as any;
          const id =
            anyDetail.id ?? anyDetail.questionBankId ?? anyDetail.questionBankID;
          if (!id) return;
          const tags = normalizeTags(anyDetail.tags);
          const total = getBaseQuestionCount(anyDetail);
          map[id] = {
            totalQuestions: total,
            tags,
          };
        });
        return map;
      });
    } catch (e) {
      console.error("Failed to fetch bank details", e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);

      const [orgRes, myRes, publicRes, wsRes] = await Promise.all([
        getOrganizationById(orgId),
        getMyQuestionBanks(),
        getPublicQuestionBanks(),
        getProjectsByOrganization(orgId),
      ]);

      setOrg(orgRes.organization);
      setMyBanks(myRes);
      setPublicBanks(publicRes);
      setWorkspaces(wsRes);

      await fetchBankDetails([...myRes, ...publicRes]);
    } catch (e) {
      setErr(safeMessage(e, t("workspace_detail.request_failed")));
    } finally {
      setLoading(false);
    }
  }, [orgId, t, fetchBankDetails]);

  useEffect(() => {
    if (!orgId) return;
    void loadAll();
  }, [loadAll, orgId]);

  useEffect(() => {
    if (isDialogOpen) {
      if (!selectedWorkspaceId && workspaces.length > 0) {
        setSelectedWorkspaceId(workspaces[0].workspaceId);
      }
    } else {
      setSelectedWorkspaceId("");
      setSelectedMapId("");
      setMaps([]);
    }
  }, [isDialogOpen, workspaces, selectedWorkspaceId]);

  useEffect(() => {
    if (!isDialogOpen || !selectedWorkspaceId) return;
    let cancelled = false;

    async function fetchMaps() {
      try {
        const rawMaps = await getWorkspaceMaps(selectedWorkspaceId);
        if (cancelled) return;

        const options: MapOption[] = (rawMaps as any[]).map(m => {
          const id = (m as any).mapId ?? (m as any).id ?? "";
          const name =
            (m as any).mapName ??
            (m as any).name ??
            (m as any).title ??
            id;
          return { id: String(id), name: String(name) };
        });

        setMaps(options);
        if (options.length > 0 && !selectedMapId) {
          setSelectedMapId(options[0].id);
        }
      } catch (e) {
        console.error("Failed to load workspace maps", e);
      }
    }

    void fetchMaps();

    return () => {
      cancelled = true;
    };
  }, [isDialogOpen, selectedWorkspaceId, selectedMapId]);

  const handleCreateBank = async () => {
    if (!form.bankName.trim()) {
      showToast("error", "Vui lòng nhập tên bộ câu hỏi");
      return;
    }
    if (!selectedWorkspaceId) {
      showToast("error", "Vui lòng chọn workspace");
      return;
    }
    if (!selectedMapId) {
      showToast("error", "Vui lòng chọn map");
      return;
    }

    setCreating(true);
    try {
      const tagsArray =
        form.tags
          .split(",")
          .map(s => s.trim())
          .filter(Boolean) ?? [];

      await createQuestionBank({
        bankName: form.bankName.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        tags: tagsArray,
        workspaceId: selectedWorkspaceId,
        mapId: selectedMapId,
        isTemplate: form.isTemplate,
        isPublic: form.isPublic,
      });

      showToast("success", "Tạo bộ câu hỏi thành công");
      setIsDialogOpen(false);
      resetForm();
      setSelectedWorkspaceId("");
      setSelectedMapId("");
      setMaps([]);

      void loadAll();
    } catch (e) {
      showToast(
        "error",
        safeMessage(e, "Không thể tạo bộ câu hỏi. Vui lòng thử lại.")
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    if (!bankId) return;
    setDeletingBankId(bankId);
    try {
      await deleteQuestionBank(bankId);
      showToast("success", "Đã xóa bộ câu hỏi");
      setMyBanks(prev => prev.filter(b => (b as any).id !== bankId));
      setPublicBanks(prev => prev.filter(b => (b as any).id !== bankId));
      setBankDetails(prev => {
        const next = { ...prev };
        delete next[bankId];
        return next;
      });
    } catch (e) {
      showToast(
        "error",
        safeMessage(e, "Không thể xóa bộ câu hỏi. Vui lòng thử lại.")
      );
    } finally {
      setDeletingBankId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] px-4 text-zinc-500 dark:text-zinc-400 animate-pulse">
        {t("workspace_detail.loading")}
      </div>
    );
  }

  if (err || !org) {
    return (
      <div className="max-w-3xl px-4 text-red-600 dark:text-red-400">
        {err ?? t("workspace_detail.not_found")}
      </div>
    );
  }

  const displayBanks = activeTab === "my" ? myBanks : publicBanks;

  const getWorkspaceName = (workspaceId?: string | null) => {
    if (!workspaceId) return "—";
    const ws = workspaces.find(w => w.workspaceId === workspaceId);
    return ws?.workspaceName ?? workspaceId;
  };

  const goToEditQuestions = (bank: any, id: string) => {
    if (!bank.workspaceId) {
      // vẫn giữ check cũ để tránh lỗi ở trang question
      showToast(
        "info",
        "Bộ này chưa gắn workspace, bạn có thể gắn khi tạo session."
      );
      return;
    }

    const params = new URLSearchParams();
    params.set("bankId", id);
    params.set("workspaceId", String(bank.workspaceId));
    if (bank.mapId) {
      params.set("mapId", String(bank.mapId));
    }

    router.push(
      `/profile/organizations/${orgId}/question-banks/question?${params.toString()}`
    );
  };

  return (
    <div className="min-w-0 px-4 pb-10">
      <div className="mx-auto max-w-6xl text-zinc-900 dark:text-zinc-50">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/profile/organizations/${orgId}`)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                Bộ câu hỏi
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {org.orgName}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDialogOpen(true)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Tạo bộ câu hỏi
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full bg-zinc-100 p-1 text-xs dark:bg-zinc-900">
            <button
              onClick={() => setActiveTab("my")}
              className={`rounded-full px-4 py-1.5 font-medium ${
                activeTab === "my"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Của tôi ({myBanks.length})
            </button>
            <button
              onClick={() => setActiveTab("public")}
              className={`rounded-full px-4 py-1.5 font-medium ${
                activeTab === "public"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              Công khai ({publicBanks.length})
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
            <h2>
              {activeTab === "my"
                ? "Bộ câu hỏi của tôi"
                : "Bộ câu hỏi công khai"}
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {displayBanks.length} bộ
            </span>
          </div>

          {displayBanks.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
              {activeTab === "my"
                ? 'Chưa có bộ câu hỏi nào. Bấm "Tạo bộ câu hỏi" để bắt đầu.'
                : "Chưa có bộ câu hỏi công khai nào."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50/70 text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
                    <th className="px-4 py-2 text-left font-semibold">
                      Tên bộ
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Mô tả
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Số câu hỏi
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Tags
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">
                      Workspace
                    </th>
                    <th className="px-4 py-2 text-right font-semibold">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayBanks.map(bank => {
                    const id =
                      (bank as any).id ??
                      (bank as any).questionBankId ??
                      "";
                    const extra = id ? bankDetails[id] : undefined;
                    const count =
                      extra?.totalQuestions ?? getBaseQuestionCount(bank);
                    const countLabel = labelFromCount(count);
                    const countClass =
                      count === 0
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "font-semibold text-emerald-600 dark:text-emerald-400";
                    const tagsSource =
                      extra?.tags?.length
                        ? extra.tags
                        : normalizeTags((bank as any).tags);
                    const tagsLabel =
                      tagsSource.length > 0
                        ? tagsSource.join(", ")
                        : "—";

                    return (
                      <tr
                        key={id}
                        className="border-t border-zinc-100 hover:bg-zinc-50/70 dark:border-white/10 dark:hover:bg-zinc-900/60"
                      >
                        <td className="px-4 py-2 font-medium">
                          {(bank as any).bankName}
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                          {(bank as any).description || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span className={countClass}>{countLabel}</span>
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                          {tagsLabel}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {getWorkspaceName((bank as any).workspaceId)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            {activeTab === "my" && (
                              <>
                                <button
                                  onClick={() => goToEditQuestions(bank, id)}
                                  className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                                >
                                  Tạo / sửa
                                </button>
                                <button
                                  onClick={() => handleDeleteBank(id)}
                                  disabled={deletingBankId === id}
                                  className="inline-flex items-center rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                                >
                                  {deletingBankId === id
                                    ? "Đang xóa"
                                    : "Xóa"}
                                </button>
                              </>
                            )}
                            {activeTab === "public" && (
                              <button
                                onClick={() => goToEditQuestions(bank, id)}
                                className="inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-50 hover:bg-zinc-700"
                              >
                                Xem / sử dụng
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isDialogOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Tạo bộ câu hỏi mới
                </h2>
                <button
                  onClick={() => {
                    if (!creating) {
                      setIsDialogOpen(false);
                      resetForm();
                      setSelectedWorkspaceId("");
                      setSelectedMapId("");
                      setMaps([]);
                    }
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Tên bộ câu hỏi
                  </label>
                  <input
                    name="bankName"
                    value={form.bankName}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="VD: Bộ câu hỏi chương 1..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Mô tả
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    className="min-h-[80px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="Mô tả ngắn về bộ câu hỏi..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Danh mục
                  </label>
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="VD: Lịch sử, Địa lý..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Tags (phân cách bằng dấu phẩy)
                  </label>
                  <input
                    name="tags"
                    value={form.tags}
                    onChange={handleFormChange}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    placeholder="VD: ôn tập, giữa kỳ, trắc nghiệm"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Workspace
                    </label>
                    <select
                      value={selectedWorkspaceId}
                      onChange={e => {
                        setSelectedWorkspaceId(e.target.value);
                        setSelectedMapId("");
                        setMaps([]);
                      }}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">Chọn workspace</option>
                      {workspaces.map(ws => (
                        <option key={ws.workspaceId} value={ws.workspaceId}>
                          {ws.workspaceName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Map
                    </label>
                    <select
                      value={selectedMapId}
                      onChange={e => setSelectedMapId(e.target.value)}
                      disabled={!selectedWorkspaceId || maps.length === 0}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      {!selectedWorkspaceId && (
                        <option value="">Chọn workspace trước</option>
                      )}
                      {selectedWorkspaceId && maps.length === 0 && (
                        <option value="">Không có map trong workspace</option>
                      )}
                      {maps.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      name="isTemplate"
                      checked={form.isTemplate}
                      onChange={handleFormChange}
                    />
                    <span>Dùng như template</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      name="isPublic"
                      checked={form.isPublic}
                      onChange={handleFormChange}
                    />
                    <span>Công khai trong tổ chức</span>
                  </label>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    if (!creating) {
                      setIsDialogOpen(false);
                      resetForm();
                      setSelectedWorkspaceId("");
                      setSelectedMapId("");
                      setMaps([]);
                    }
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateBank}
                  disabled={creating}
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {creating ? "Đang tạo..." : "Tạo bộ câu hỏi"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
