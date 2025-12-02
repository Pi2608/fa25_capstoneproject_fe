"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  createQuestionBank,
  deleteQuestionBank,
  updateQuestionBank,
  attachSessionToQuestionBank,
  type QuestionBankDto,
} from "@/lib/api-ques";
import type { Workspace } from "@/types/workspace";
import {
  QuestionBankFormState,
  TabKey,
  MapOption,
  BankExtra,
  RowMenuState,
  safeMessage,
  normalizeTags,
  labelFromCount,
  resolveBankId,
} from "@/hooks/question-bank-common";
import { useQuestionBanksData } from "@/hooks/useQuestionBanksData";
import { useBankForm } from "@/hooks/useBankForm";
import { useAttachDialog } from "@/hooks/useAttachDialog";
import { useRowMenu } from "@/hooks/useRowMenu";

type HeaderMode = "light" | "dark";

function useThemeMode(): HeaderMode {
  const [mode, setMode] = useState<HeaderMode>("light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;

    const update = () => {
      setMode(html.classList.contains("dark") ? "dark" : "light");
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return mode;
}

function BankFormDialog({
  isOpen,
  isEditMode,
  saving,
  form,
  workspaces,
  selectedWorkspaceId,
  onChange,
  onWorkspaceChange,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  isEditMode: boolean;
  saving: boolean;
  form: QuestionBankFormState;
  workspaces: Workspace[];
  selectedWorkspaceId: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onWorkspaceChange: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEditMode ? "Chỉnh sửa bộ câu hỏi" : "Tạo bộ câu hỏi mới"}
          </h2>
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Tên bộ câu hỏi">
            <input
              name="bankName"
              value={form.bankName}
              onChange={onChange}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="VD: Bộ câu hỏi chương 1..."
            />
          </Field>

          <Field label="Mô tả">
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50 min-h-[80px]"
              placeholder="Mô tả ngắn..."
            />
          </Field>

          <Field label="Danh mục">
            <input
              name="category"
              value={form.category}
              onChange={onChange}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="VD: Lịch sử, Địa lý..."
            />
          </Field>

          <Field label="Tags (phân cách bằng dấu phẩy)">
            <input
              name="tags"
              value={form.tags}
              onChange={onChange}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
              placeholder="VD: ôn tập, giữa kỳ"
            />
          </Field>

          <Field label="Workspace">
            <select
              value={selectedWorkspaceId}
              onChange={(e) => onWorkspaceChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Chọn workspace</option>
              {workspaces.map((ws) => (
                <option key={ws.workspaceId} value={ws.workspaceId}>
                  {ws.workspaceName}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-center gap-4">
            <Checkbox
              name="isTemplate"
              checked={form.isTemplate}
              onChange={onChange}
              label="Dùng như template"
            />
            <Checkbox
              name="isPublic"
              checked={form.isPublic}
              onChange={onChange}
              label="Công khai trong tổ chức"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            Hủy
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
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
  );
}

function AttachDialog({
  isOpen,
  bank,
  maps,
  selectedMapId,
  saving,
  getWorkspaceName,
  bankDetails,
  onMapChange,
  onAttach,
  onClose,
}: {
  isOpen: boolean;
  bank: QuestionBankDto | null;
  maps: MapOption[];
  selectedMapId: string;
  saving: boolean;
  getWorkspaceName: (id?: string | null) => string;
  bankDetails: Record<string, BankExtra>;
  onMapChange: (id: string) => void;
  onAttach: () => void;
  onClose: () => void;
}) {
  if (!isOpen || !bank) return null;

  const questionCount = bankDetails[resolveBankId(bank)]?.totalQuestions ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Gắn vào Storymap
            </p>
            <h2 className="text-lg font-semibold">{bank.bankName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <span className="font-medium">Workspace</span>
              <span className="text-xs text-zinc-500">
                {getWorkspaceName((bank as any).workspaceId)}
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Số câu hỏi: {questionCount}
            </div>
          </div>

          {maps.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
              Workspace này chưa có storymap nào.
            </div>
          ) : (
            <Field label="Chọn storymap">
              <select
                value={selectedMapId}
                onChange={(e) => onMapChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Chọn storymap</option>
                {maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            Hủy
          </button>
          <button
            onClick={onAttach}
            disabled={!selectedMapId || saving}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {saving ? "Đang xử lý..." : "Thêm vào storymap"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RowMenu({
  state,
  deletingBankId,
  onEdit,
  onAttach,
  onDelete,
  onClose,
}: {
  state: RowMenuState | null;
  deletingBankId: string | null;
  onEdit: (bank: QuestionBankDto) => void;
  onAttach: (bank: QuestionBankDto) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  if (!state || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute z-50 rounded-2xl border border-zinc-200 bg-white p-2 text-xs shadow-2xl dark:border-white/10 dark:bg-zinc-900"
        style={{ top: state.top, left: state.left, width: 208 }}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        <MenuButton
          onClick={() => {
            onEdit(state.bank);
            onClose();
          }}
        >
          Sửa thông tin
        </MenuButton>
        <MenuButton
          onClick={() => {
            onAttach(state.bank);
            onClose();
          }}
        >
          Thêm vào storymap
        </MenuButton>
        <MenuButton
          danger
          disabled={deletingBankId === state.id}
          onClick={() => {
            onDelete(state.id);
            onClose();
          }}
        >
          {deletingBankId === state.id ? "Đang xóa..." : "Xóa"}
        </MenuButton>
      </div>
    </div>,
    document.body
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
      {label}
    </label>
    {children}
  </div>
);

const Checkbox = ({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  label: string;
}) => (
  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
    <input type="checkbox" name={name} checked={checked} onChange={onChange} />
    <span>{label}</span>
  </label>
);

const MenuButton = ({
  children,
  danger,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center rounded-lg px-3 py-2 text-left font-medium ${danger
      ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/10"
      } disabled:opacity-60`}
  >
    {children}
  </button>
);

export default function QuestionBanksPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const mode = useThemeMode();

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [attachSaving, setAttachSaving] = useState(false);

  const data = useQuestionBanksData(orgId);
  const bankForm = useBankForm(data.workspaces);
  const attachDialog = useAttachDialog();
  const rowMenu = useRowMenu();

  const displayBanks = activeTab === "my" ? data.myBanks : data.publicBanks;

  const getWorkspaceName = (workspaceId?: string | null) => {
    if (!workspaceId) return "—";
    return (
      data.workspaces.find((w) => w.workspaceId === workspaceId)
        ?.workspaceName ?? workspaceId
    );
  };

  const handleSave = async () => {
    if (!bankForm.form.bankName.trim())
      return showToast("error", "Vui lòng nhập tên bộ câu hỏi");
    if (!bankForm.selectedWorkspaceId)
      return showToast("error", "Vui lòng chọn workspace");

    bankForm.setSaving(true);
    try {
      const payload = {
        bankName: bankForm.form.bankName.trim(),
        description: bankForm.form.description.trim() || null,
        category: bankForm.form.category.trim() || null,
        tags: bankForm.form.tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        workspaceId: bankForm.selectedWorkspaceId,
        isTemplate: bankForm.form.isTemplate,
        isPublic: bankForm.form.isPublic,
      };

      if (bankForm.editingBank) {
        await updateQuestionBank(resolveBankId(bankForm.editingBank), payload);
        showToast("success", "Cập nhật thành công");
      } else {
        await createQuestionBank(payload);
        showToast("success", "Tạo thành công");
      }
      bankForm.close();
      data.loadAll();
    } catch (e) {
      showToast("error", safeMessage(e, "Không thể lưu bộ câu hỏi"));
    } finally {
      bankForm.setSaving(false);
    }
  };

  const handleDelete = async (bankId: string) => {
    setDeletingBankId(bankId);
    try {
      await deleteQuestionBank(bankId);
      showToast("success", "Đã xóa bộ câu hỏi");
      data.removeBankFromList(bankId);
    } catch (e) {
      showToast("error", safeMessage(e, "Không thể xóa bộ câu hỏi"));
    } finally {
      setDeletingBankId(null);
    }
  };

  const handleAttach = async () => {
    if (!attachDialog.bank || !attachDialog.selectedMapId) return;
    const bankId = resolveBankId(attachDialog.bank);

    setAttachSaving(true);
    try {
      // Note: Changed from attachMapToQuestionBank to attachSessionToQuestionBank
      // attachDialog.selectedMapId is now treated as sessionId
      await attachSessionToQuestionBank(bankId, attachDialog.selectedMapId);
      showToast("success", "Đã gắn question bank vào session thành công");
      // Note: updateBanksMapId might need to be updated to handle sessions
      data.updateBanksMapId(bankId, attachDialog.selectedMapId);
      attachDialog.close();
    } catch (e) {
      showToast("error", safeMessage(e, "Không thể gắn question bank vào session"));
    } finally {
      setAttachSaving(false);
    }
  };

  const goToEditQuestions = (id: string) => {
    router.push(`/profile/organizations/${orgId}/question-banks/${id}/question`);
  };

  if (data.loading) {
    return (
      <div className="min-h-[60vh] px-4 text-zinc-500 animate-pulse">
        Đang tải...
      </div>
    );
  }

  if (data.err || !data.org) {
    return (
      <div className="max-w-3xl px-4 text-red-600">
        {data.err ?? "Không tìm thấy tổ chức"}
      </div>
    );
  }

  return (
    <div className="min-w-0 px-4 pb-10">
      <div className="mx-auto max-w-6xl text-zinc-900 dark:text-zinc-50">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/profile/organizations/${orgId}`)}
              className="px-3 py-1.5 rounded-lg border text-sm border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              style={{
                color: mode === "dark" ? "#e5e7eb" : "#4b5563",
              }}
            >
              ← Quay lại
            </button>
            <div>
              <h1
                className="text-2xl font-semibold sm:text-3xl"
                style={{
                  color: mode === "dark" ? "#f9fafb" : "#047857",
                }}
              >
                Bộ câu hỏi
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {data.org.orgName}
              </p>
            </div>
          </div>
          <button
            onClick={bankForm.openCreate}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Tạo bộ câu hỏi
          </button>
        </div>

        {/* Tabs */}
        {/* Tabs */}
        <div className="mb-4">
          <div className="inline-flex rounded-full bg-zinc-100 p-1 text-xs dark:bg-zinc-900">
            {(["my", "public"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${activeTab === tab
                    ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800 dark:text-emerald-300"
                    : "text-zinc-600 hover:bg-white hover:text-emerald-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-emerald-300"
                  }`}
              >
                {tab === "my"
                  ? `Của tôi (${data.myBanks.length})`
                  : `Công khai (${data.publicBanks.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
            <h2 className="font-semibold text-emerald-600 dark:text-emerald-300">
              {activeTab === "my"
                ? "Bộ câu hỏi của tôi"
                : "Bộ câu hỏi công khai"}
            </h2>
            <span className="text-xs text-zinc-500">
              {displayBanks.length} bộ
            </span>
          </div>


          {displayBanks.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">
              {activeTab === "my"
                ? "Chưa có bộ câu hỏi nào."
                : "Chưa có bộ câu hỏi công khai nào."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50/70 text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
                    {[
                      "Tên bộ",
                      "Mô tả",
                      "Số câu hỏi",
                      "Tags",
                      "Workspace",
                      "Hành động",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-2 font-semibold ${h === "Hành động" ? "text-right" : "text-left"
                          }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayBanks.map((bank) => {
                    const id = resolveBankId(bank);
                    const extra = data.bankDetails[id];
                    const count = extra?.totalQuestions ?? 0;
                    const tags = extra?.tags?.length
                      ? extra.tags
                      : normalizeTags(bank.tags);

                    return (
                      <tr
                        key={id}
                        className="border-t border-zinc-100 dark:border-white/10"
                      >
                        <td className="px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-300">
                          {bank.bankName}
                        </td>
                        <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                          {bank.description || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              count === 0
                                ? "text-zinc-400"
                                : "font-semibold text-emerald-600"
                            }
                          >
                            {labelFromCount(count)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-zinc-600">
                          {tags.length ? tags.join(", ") : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500">
                          {bank.bankName}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            {activeTab === "my" ? (
                              <>
                                <button
                                  onClick={() => goToEditQuestions(id)}
                                  className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                                >
                                  Tạo / sửa
                                </button>
                                <button
                                  onClick={(e) => rowMenu.toggle(bank, e.currentTarget)}
                                  aria-haspopup="menu"
                                  className="
    inline-flex items-center justify-center
    rounded-full border border-sky-500
    px-4 py-1.5 text-xs font-semibold
    bg-sky-500 text-white
    shadow-[0_8px_20px_rgba(56,189,248,0.45)]
    hover:bg-sky-400 hover:border-sky-400
    focus:outline-none focus:ring-2 focus:ring-sky-300
    dark:bg-sky-500 dark:border-sky-400 dark:text-white
    dark:hover:bg-sky-400
  "
                                >
                                  Tùy chọn ▾
                                </button>

                              </>
                            ) : (
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

        {/* Dialogs & Menu */}
        <RowMenu
          state={rowMenu.state}
          deletingBankId={deletingBankId}
          onEdit={bankForm.openEdit}
          onAttach={attachDialog.open}
          onDelete={handleDelete}
          onClose={rowMenu.close}
        />

        <BankFormDialog
          isOpen={bankForm.isOpen}
          isEditMode={bankForm.isEditMode}
          saving={bankForm.saving}
          form={bankForm.form}
          workspaces={data.workspaces}
          selectedWorkspaceId={bankForm.selectedWorkspaceId}
          onChange={bankForm.handleChange}
          onWorkspaceChange={bankForm.setSelectedWorkspaceId}
          onSave={handleSave}
          onClose={bankForm.close}
        />

        <AttachDialog
          isOpen={attachDialog.isOpen}
          bank={attachDialog.bank}
          maps={attachDialog.maps}
          selectedMapId={attachDialog.selectedMapId}
          saving={attachSaving}
          getWorkspaceName={getWorkspaceName}
          bankDetails={data.bankDetails}
          onMapChange={attachDialog.setSelectedMapId}
          onAttach={handleAttach}
          onClose={attachDialog.close}
        />
      </div>
    </div>
  );
}
