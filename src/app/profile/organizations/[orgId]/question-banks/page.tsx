"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
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
  updateQuestionBank,
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

type RowMenuState = {
  id: string;
  bank: QuestionBankDto;
  top: number;
  left: number;
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

function mapWorkspaceMapsToOptions(rawMaps: unknown): MapOption[] {
  if (!Array.isArray(rawMaps)) return [];
  return rawMaps
    .map(item => {
      const id = (item as any).mapId ?? (item as any).id ?? "";
      if (!id) return null;
      const name =
        (item as any).mapName ??
        (item as any).name ??
        (item as any).title ??
        id;
      return { id: String(id), name: String(name) };
    })
    .filter((opt): opt is MapOption => Boolean(opt?.id));
}

function resolveBankId(bank: QuestionBankDto | any): string {
  if (!bank) return "";
  return bank.questionBankId;
}

export default function QuestionBanksPage() {
  const { t } = useI18n();
  const tSingle = t as (
    path: string,
    vars?: Record<string, string | number>
  ) => string;
  const translate = (key: string) => tSingle(key);
  const router = useRouter();
  const { showToast } = useToast();
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const [org, setOrg] = useState<OrganizationDetailDto | null>(null);

  const [myBanks, setMyBanks] = useState<QuestionBankDto[]>([]);
  const [publicBanks, setPublicBanks] = useState<QuestionBankDto[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("my");

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachBank, setAttachBank] = useState<QuestionBankDto | null>(null);

  const [selectedMapId, setSelectedMapId] = useState("");
  const [maps, setMaps] = useState<MapOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [editingBank, setEditingBank] = useState<QuestionBankDto | null>(null);
  const [menuState, setMenuState] = useState<RowMenuState | null>(null);
  const isEditMode = Boolean(editingBank);

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
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value } = target;
    const nextValue =
      target instanceof HTMLInputElement && target.type === "checkbox"
        ? target.checked
        : value;
    setForm(prev => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const hydrateFormFromBank = (bank: QuestionBankDto) => {
    setForm({
      bankName: bank.bankName ?? "",
      description: bank.description ?? "",
      category: bank.category ?? "",
      tags: normalizeTags(bank.tags).join(", "),
      isTemplate: Boolean(bank.isTemplate),
      isPublic: Boolean(bank.isPublic),
    });
    setSelectedWorkspaceId(bank.workspaceId ?? "");
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

  const loadStorymaps = useCallback(async (workspaceId: string) => {
    try {
      const rawMaps = await getWorkspaceMaps(workspaceId);
      const options = mapWorkspaceMapsToOptions(rawMaps);
      setMaps(options);
    } catch (e) {
      console.error("Failed to load maps for workspace", e);
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
      setErr(safeMessage(e, translate("workspace_detail.request_failed")));
    } finally {
      setLoading(false);
    }
  }, [orgId, t, fetchBankDetails]);

  useEffect(() => {
    if (!orgId) return;
    void loadAll();
  }, [loadAll, orgId]);

  useEffect(() => {
    if (!isDialogOpen) {
      setSelectedWorkspaceId("");
      setEditingBank(null);
      return;
    }
    if (editingBank) return;
    if (!selectedWorkspaceId && workspaces.length > 0) {
      setSelectedWorkspaceId(workspaces[0].workspaceId);
    }
  }, [isDialogOpen, workspaces, selectedWorkspaceId, editingBank]);


  useEffect(() => {
    if (!attachDialogOpen || !attachBank) return;
    const workspaceId = String(
      (attachBank as any).workspaceId ?? (attachBank as any).WorkspaceId ?? ""
    );
    if (!workspaceId) return;

    let cancelled = false;

    async function fetchAttachMaps() {
      try {
        const rawMaps = await getWorkspaceMaps(workspaceId);
        if (cancelled) return;
        const options = mapWorkspaceMapsToOptions(rawMaps);
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load maps for question bank", e);
          showToast(
            "error",
            "Không thể tải danh sách storymap của workspace này."
          );
        }
      }
    }

    void fetchAttachMaps();

    return () => {
      cancelled = true;
    };
  }, [attachDialogOpen, attachBank, showToast]);

  useEffect(() => {
    if (!menuState) return;
    const handleDismiss = () => setMenuState(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuState(null);
    };
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
      window.removeEventListener("keydown", handleKey);
    };
  }, [menuState]);

  const handleSaveBank = async () => {
    if (!form.bankName.trim()) {
      showToast("error", "Vui lòng nhập tên bộ câu hỏi");
      return;
    }
    if (!selectedWorkspaceId) {
      showToast("error", "Vui lòng chọn workspace");
      return;
    }

    setSaving(true);
    try {
      const tagsArray =
        form.tags
          .split(",")
          .map(s => s.trim())
          .filter(Boolean) ?? [];

      const payload = {
        bankName: form.bankName.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        tags: tagsArray,
        workspaceId: selectedWorkspaceId,
        isTemplate: form.isTemplate,
        isPublic: form.isPublic,
      };

      if (editingBank) {
        const bankId = resolveBankId(editingBank);
        await updateQuestionBank(bankId, payload);
        showToast("success", "Cập nhật bộ câu hỏi thành công");
      } else {
        await createQuestionBank(payload);
        showToast("success", "Tạo bộ câu hỏi thành công");
      }

      setIsDialogOpen(false);
      resetForm();
      setSelectedWorkspaceId("");
      setEditingBank(null);

      void loadAll();
    } catch (e) {
      showToast(
        "error",
        safeMessage(
          e,
          editingBank
            ? "Không thể cập nhật bộ câu hỏi. Vui lòng thử lại."
            : "Không thể tạo bộ câu hỏi. Vui lòng thử lại."
        )
      );
    } finally {
      setSaving(false);
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
        {translate("workspace_detail.loading")}
      </div>
    );
  }

  if (err || !org) {
    return (
      <div className="max-w-3xl px-4 text-red-600 dark:text-red-400">
        {err ?? translate("workspace_detail.not_found")}
      </div>
    );
  }

  const displayBanks = activeTab === "my" ? myBanks : publicBanks;

  const getWorkspaceName = (workspaceId?: string | null) => {
    if (!workspaceId) return "—";
    const ws = workspaces.find(w => w.workspaceId === workspaceId);
    return ws?.workspaceName ?? workspaceId;
  };

  const goToEditQuestions = (id: string) => {
    router.push(
      `/profile/organizations/${orgId}/question-banks/${id}/question`
    );
  };

  const closeAttachDialog = () => {
    setAttachDialogOpen(false);
    setAttachBank(null);
  };

  const openAttachDialog = (bank: QuestionBankDto | any) => {
    setAttachBank(bank as QuestionBankDto);
    setAttachDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditingBank(null);
    setSelectedWorkspaceId("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (bank: QuestionBankDto | any) => {
    const typedBank = bank as QuestionBankDto;
    setEditingBank(typedBank);
    hydrateFormFromBank(typedBank);
    setIsDialogOpen(true);
  };

  const closeRowMenu = () => setMenuState(null);

  const toggleRowMenu = (
    bank: QuestionBankDto | any,
    button: HTMLButtonElement
  ) => {
    const typedBank = bank as QuestionBankDto;
    const rowId =
      (typedBank as any).id ??
      (typedBank as any).questionBankId ??
      resolveBankId(typedBank);
    if (!rowId) return;

    setMenuState(prev => {
      if (prev?.id === rowId) {
        return null;
      }
      if (typeof window === "undefined") return null;
      const rect = button.getBoundingClientRect();
      const width = 208;
      const padding = 16;
      const left = Math.max(
        padding,
        Math.min(rect.right - width, window.innerWidth - width - padding)
      );
      const top = rect.bottom + 8;
      return {
        id: rowId,
        bank: typedBank,
        top,
        left,
      };
    });
  };

  const handleAttachToStorymap = () => {
    if (!attachBank) {
      showToast("error", "Không tìm thấy bộ câu hỏi đang chọn.");
      return;
    }

    const bankId = resolveBankId(attachBank);
    if (!bankId) {
      showToast("error", "Không xác định được mã bộ câu hỏi.");
      return;
    }

    const params = new URLSearchParams();
    params.set("questionBankId", bankId);

    if (attachBank.bankName) params.set("bankName", attachBank.bankName);
    if (attachBank.description)
      params.set("bankDescription", attachBank.description);
    if (attachBank.category) params.set("category", attachBank.category);

    const tagsSource =
      bankDetails[bankId]?.tags?.length
        ? bankDetails[bankId].tags
        : normalizeTags((attachBank as any).tags);
    if (tagsSource.length > 0) {
      params.set("tags", tagsSource.join(","));
    }

    const totalQuestions =
      bankDetails[bankId]?.totalQuestions ?? getBaseQuestionCount(attachBank);
    params.set("totalQuestions", String(totalQuestions ?? 0));

    if (attachBank.createdAt) params.set("createdAt", attachBank.createdAt);
    if (attachBank.updatedAt) params.set("updatedAt", attachBank.updatedAt);


    closeAttachDialog();
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
            onClick={openCreateDialog}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Tạo bộ câu hỏi
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex rounded-full bg-zinc-100 p-1 text-xs dark:bg-zinc-900">
            <button
              onClick={() => setActiveTab("my")}
              className={`rounded-full px-4 py-1.5 font-medium ${activeTab === "my"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
            >
              Của tôi ({myBanks.length})
            </button>
            <button
              onClick={() => setActiveTab("public")}
              className={`rounded-full px-4 py-1.5 font-medium ${activeTab === "public"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
            >
              Công khai ({publicBanks.length})
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
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
                          <div className="flex flex-wrap justify-end gap-2">
                            {activeTab === "my" && (
                              <>
                                <button
                                  onClick={() => goToEditQuestions(id)}
                                  className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                                >
                                  Tạo / sửa
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    toggleRowMenu(bank, e.currentTarget);
                                  }}
                                  className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                                  aria-haspopup="menu"
                                  aria-expanded={menuState?.id === id}
                                >
                                  Tùy chọn
                                  <svg
                                    className="ml-1 h-3 w-3"
                                    viewBox="0 0 10 6"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      d="M1 1.25L5 5.25L9 1.25"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              </>
                            )}
                            {activeTab === "public" && (
                              <button
                                onClick={() => goToEditQuestions(id)}
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

        {menuState &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-40"
              onClick={closeRowMenu}
              role="presentation"
            >
              <div
                className="absolute z-50 rounded-2xl border border-zinc-200 bg-white p-2 text-xs shadow-2xl dark:border-white/10 dark:bg-zinc-900"
                style={{
                  top: menuState.top,
                  left: menuState.left,
                  width: 208,
                }}
                onClick={event => event.stopPropagation()}
                role="menu"
              >
                <button
                  onClick={() => {
                    openEditDialog(menuState.bank);
                    closeRowMenu();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  Sửa thông tin
                </button>
                <button
                  onClick={() => {
                    openAttachDialog(menuState.bank);
                    closeRowMenu();
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  Thêm vào storymap
                </button>
                <button
                  onClick={() => {
                    handleDeleteBank(menuState.id);
                    closeRowMenu();
                  }}
                  disabled={deletingBankId === menuState.id}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  {deletingBankId === menuState.id ? "Đang xóa..." : "Xóa"}
                </button>
              </div>
            </div>,
            document.body
          )}

        {isDialogOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {isEditMode ? "Chỉnh sửa bộ câu hỏi" : "Tạo bộ câu hỏi mới"}
                </h2>
                <button
                  onClick={() => {
                    if (!saving) {
                      setIsDialogOpen(false);
                      resetForm();
                      setSelectedWorkspaceId("");
                      setEditingBank(null);
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
                    if (!saving) {
                      setIsDialogOpen(false);
                      resetForm();
                      setSelectedWorkspaceId("");
                      setEditingBank(null);
                    }
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveBank}
                  disabled={saving}
                  className="rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                >
                  {saving
                    ? "Đang lưu..."
                    : isEditMode
                      ? "Lưu thay đổi"
                      : "Tạo bộ câu hỏi"}
                </button>
              </div>
            </div>
          </div>
        )}
        {attachDialogOpen && attachBank && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-50">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Gắn vào Storymap
                  </p>
                  <h2 className="text-lg font-semibold">
                    {attachBank.bankName}
                  </h2>
                </div>
                <button
                  onClick={closeAttachDialog}
                  className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-700 dark:text-zinc-100">
                      Workspace
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {getWorkspaceName((attachBank as any).workspaceId)}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {`Số câu hỏi: ${bankDetails[resolveBankId(attachBank)]?.totalQuestions ??
                      getBaseQuestionCount(attachBank)
                      }`}
                  </div>
                </div>

                {maps.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                    Workspace này chưa có storymap nào. Vào trang workspace để tạo mới trước.
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Chọn storymap
                    </label>
                    <select
                      value={selectedMapId}
                      onChange={e => setSelectedMapId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-sky-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
                    >
                      <option value="">Chọn storymap</option>
                      {maps.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeAttachDialog}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAttachToStorymap}
                  disabled={!selectedMapId}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  Mở Storymap
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
