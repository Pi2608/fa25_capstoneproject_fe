"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import {
  createQuestionBank,
  deleteQuestionBank,
  updateQuestionBank,
  type QuestionBankDto,
} from "@/lib/api-ques";
import type { Workspace } from "@/types/workspace";
import {
  QuestionBankFormState,
  TabKey,
  BankExtra,
  RowMenuState,
  safeMessage,
  normalizeTags,
  labelFromCount,
  resolveBankId,
} from "@/hooks/question-bank-common";
import { useQuestionBanksData } from "@/hooks/useQuestionBanksData";
import { useBankForm } from "@/hooks/useBankForm";
import { useRowMenu } from "@/hooks/useRowMenu";

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
  const { resolvedTheme, theme } = useTheme();
  const { t } = useI18n();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className={`w-full max-w-lg rounded-2xl p-5 shadow-xl ${themeClasses.panel}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
            {isEditMode
              ? t("org_question_banks", "dialog_title_edit")
              : t("org_question_banks", "dialog_title_create")}
          </h2>
          <button
            onClick={onClose}
            className={`text-sm ${
              isDark
                ? "text-zinc-500 hover:text-white"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <Field
            label={t("org_question_banks", "field_name_label")}
            isDark={isDark}
            themeClasses={themeClasses}
          >
            <input
              name="bankName"
              value={form.bankName}
              onChange={onChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
              placeholder={t(
                "org_question_banks",
                "field_name_placeholder"
              )}
            />
          </Field>

          <Field
            label={t("org_question_banks", "field_desc_label")}
            isDark={isDark}
            themeClasses={themeClasses}
          >
            <textarea
              name="description"
              value={form.description}
              onChange={onChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px] ${themeClasses.input}`}
              placeholder={t(
                "org_question_banks",
                "field_desc_placeholder"
              )}
            />
          </Field>

          <Field
            label={t("org_question_banks", "field_category_label")}
            isDark={isDark}
            themeClasses={themeClasses}
          >
            <input
              name="category"
              value={form.category}
              onChange={onChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
              placeholder={t(
                "org_question_banks",
                "field_category_placeholder"
              )}
            />
          </Field>

          <Field
            label={t("org_question_banks", "field_tags_label")}
            isDark={isDark}
            themeClasses={themeClasses}
          >
            <input
              name="tags"
              value={form.tags}
              onChange={onChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
              placeholder={t(
                "org_question_banks",
                "field_tags_placeholder"
              )}
            />
          </Field>

          <Field
            label={t("org_question_banks", "field_workspace_label")}
            isDark={isDark}
            themeClasses={themeClasses}
          >
            <select
              value={selectedWorkspaceId}
              onChange={(e) => onWorkspaceChange(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.select}`}
            >
              <option value="">
                {t(
                  "org_question_banks",
                  "field_workspace_placeholder"
                )}
              </option>
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
              label={t(
                "org_question_banks",
                "field_isTemplate_label"
              )}
              isDark={isDark}
              themeClasses={themeClasses}
            />
            <Checkbox
              name="isPublic"
              checked={form.isPublic}
              onChange={onChange}
              label={t(
                "org_question_banks",
                "field_isPublic_label"
              )}
              isDark={isDark}
              themeClasses={themeClasses}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className={`rounded-lg border px-3 py-1.5 text-sm ${themeClasses.button}`}
          >
            {t("org_question_banks", "dialog_btn_cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {saving
              ? t("org_question_banks", "dialog_btn_saving")
              : isEditMode
              ? t("org_question_banks", "dialog_btn_save_edit")
              : t("org_question_banks", "dialog_btn_save_create")}
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
  onDelete,
  onClose,
}: {
  state: RowMenuState | null;
  deletingBankId: string | null;
  onEdit: (bank: QuestionBankDto) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const { resolvedTheme, theme } = useTheme();
  const { t } = useI18n();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  if (!state || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className={`absolute z-50 rounded-2xl border p-2 text-xs shadow-2xl ${themeClasses.panel}`}
        style={{ top: state.top, left: state.left, width: 208 }}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        <MenuButton
          onClick={() => {
            onEdit(state.bank);
            onClose();
          }}
          isDark={isDark}
        >
          {t("org_question_banks", "menu_edit")}
        </MenuButton>
        <MenuButton
          danger
          disabled={deletingBankId === state.id}
          onClick={() => {
            onDelete(state.id);
            onClose();
          }}
          isDark={isDark}
        >
          {deletingBankId === state.id
            ? t("org_question_banks", "menu_deleting")
            : t("org_question_banks", "menu_delete")}
        </MenuButton>
      </div>
    </div>,
    document.body
  );
}

const Field = ({
  label,
  children,
  isDark,
  themeClasses,
}: {
  label: string;
  children: React.ReactNode;
  isDark: boolean;
  themeClasses: ReturnType<typeof getThemeClasses>;
}) => (
  <div>
    <label className={`mb-1 block text-xs font-medium ${themeClasses.textMuted}`}>
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
  isDark,
  themeClasses,
}: {
  name: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  label: string;
  isDark: boolean;
  themeClasses: ReturnType<typeof getThemeClasses>;
}) => (
  <label className={`inline-flex items-center gap-2 text-xs ${themeClasses.textMuted}`}>
    <input type="checkbox" name={name} checked={checked} onChange={onChange} />
    <span>{label}</span>
  </label>
);

const MenuButton = ({
  children,
  danger,
  disabled,
  onClick,
  isDark,
}: {
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  isDark: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex w-full items-center rounded-lg px-3 py-2 text-left font-medium disabled:opacity-60 ${
      danger
        ? isDark
          ? "text-red-400 hover:bg-red-500/10"
          : "text-red-600 hover:bg-red-50"
        : isDark
        ? "text-zinc-200 hover:bg-white/10"
        : "text-gray-700 hover:bg-gray-100"
    }`}
  >
    {children}
  </button>
);

export default function QuestionBanksPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  const data = useQuestionBanksData(orgId);
  const bankForm = useBankForm(data.workspaces);
  const rowMenu = useRowMenu();

  const displayBanks = activeTab === "my" ? data.myBanks : data.publicBanks;

  const handleSave = async () => {
    if (!bankForm.form.bankName.trim()) {
      return showToast(
        "error",
        t("org_question_banks", "toast_missing_name")
      );
    }
    if (!bankForm.selectedWorkspaceId) {
      return showToast(
        "error",
        t("org_question_banks", "toast_missing_workspace")
      );
    }

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
        showToast(
          "success",
          t("org_question_banks", "toast_update_success")
        );
      } else {
        await createQuestionBank(payload);
        showToast(
          "success",
          t("org_question_banks", "toast_create_success")
        );
      }
      bankForm.close();
      data.loadAll();
    } catch (e) {
      showToast(
        "error",
        safeMessage(
          e,
          t("org_question_banks", "toast_save_error")
        )
      );
    } finally {
      bankForm.setSaving(false);
    }
  };

  const handleDelete = async (bankId: string) => {
    setDeletingBankId(bankId);
    try {
      await deleteQuestionBank(bankId);
      showToast(
        "success",
        t("org_question_banks", "toast_delete_success")
      );
      data.removeBankFromList(bankId);
    } catch (e) {
      showToast(
        "error",
        safeMessage(
          e,
          t("org_question_banks", "toast_delete_error")
        )
      );
    } finally {
      setDeletingBankId(null);
    }
  };

  const goToEditQuestions = (id: string) => {
    router.push(
      `/profile/organizations/${orgId}/question-banks/${id}/question`
    );
  };

  if (data.loading) {
    return (
      <div
        className={`min-h-[60vh] px-4 animate-pulse ${themeClasses.textMuted}`}
      >
        {t("org_question_banks", "loading_text")}
      </div>
    );
  }

  if (data.err || !data.org) {
    return (
      <div
        className={`max-w-3xl px-4 ${
          isDark ? "text-red-400" : "text-red-600"
        }`}
      >
        {data.err ?? t("org_question_banks", "error_not_found")}
      </div>
    );
  }

  return (
    <div className="min-w-0 px-4 pb-10">
      <div
        className={`mx-auto max-w-6xl ${
          isDark ? "text-zinc-50" : "text-zinc-900"
        }`}
      >
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/profile/organizations/${orgId}`)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${themeClasses.button}`}
            >
              {t("org_question_banks", "header_back")}
            </button>
            <div>
              <h1
                className={`text-2xl font-semibold sm:text-3xl ${
                  isDark ? "text-zinc-100" : "text-emerald-700"
                }`}
              >
                {t("org_question_banks", "header_title")}
              </h1>
              <p className={`text-sm ${themeClasses.textMuted}`}>
                {data.org.orgName}
              </p>
            </div>
          </div>
          <button
            onClick={bankForm.openCreate}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            {t("org_question_banks", "header_create_btn")}
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4">
          <div
            className={`inline-flex rounded-full p-1 text-xs ${
              isDark ? "bg-zinc-900" : "bg-zinc-100"
            }`}
          >
            {(["my", "public"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
                  activeTab === tab
                    ? isDark
                      ? "bg-zinc-800 text-emerald-300 shadow-sm"
                      : "bg-white text-emerald-600 shadow-sm"
                    : isDark
                    ? "text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300"
                    : "text-zinc-600 hover:bg-white hover:text-emerald-600"
                }`}
              >
                {tab === "my"
                  ? t("org_question_banks", "tabs_my", {
                      count: data.myBanks.length,
                    })
                  : t("org_question_banks", "tabs_public", {
                      count: data.publicBanks.length,
                    })}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <section
          className={`rounded-2xl border shadow-sm ${themeClasses.panel}`}
        >
          <div
            className={`flex items-center justify-between border-b px-4 py-3 text-sm font-semibold ${themeClasses.tableBorder}`}
          >
            <h2
              className={`font-semibold ${
                isDark ? "text-emerald-300" : "text-emerald-600"
              }`}
            >
              {activeTab === "my"
                ? t("org_question_banks", "section_title_my")
                : t("org_question_banks", "section_title_public")}
            </h2>
            <span className={`text-xs ${themeClasses.textMuted}`}>
              {t("org_question_banks", "section_count", {
                count: displayBanks.length,
              })}
            </span>
          </div>

          {displayBanks.length === 0 ? (
            <div className={`px-4 py-6 text-sm ${themeClasses.textMuted}`}>
              {activeTab === "my"
                ? t("org_question_banks", "empty_my")
                : t("org_question_banks", "empty_public")}
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
                    {[
                      t("org_question_banks", "th_name"),
                      t("org_question_banks", "th_desc"),
                      t("org_question_banks", "th_questions"),
                      t("org_question_banks", "th_tags"),
                      t("org_question_banks", "th_workspace"),
                      t("org_question_banks", "th_actions"),
                    ].map((h, idx) => (
                      <th
                        key={idx}
                        className={`px-4 py-2 font-semibold ${
                          idx === 5 ? "text-right" : "text-left"
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
                    const extra: BankExtra | undefined = data.bankDetails[id];
                    const count = extra?.totalQuestions ?? 0;
                    const tags = extra?.tags?.length
                      ? extra.tags
                      : normalizeTags(bank.tags);

                    return (
                      <tr
                        key={id}
                        className={`border-t ${themeClasses.tableBorder}`}
                      >
                        <td
                          className={`px-4 py-2 font-semibold ${
                            isDark ? "text-emerald-300" : "text-emerald-600"
                          }`}
                        >
                          {bank.bankName}
                        </td>
                        <td className={`px-4 py-2 ${themeClasses.tableCell}`}>
                          {bank.description || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              count === 0
                                ? themeClasses.textMuted
                                : `font-semibold ${
                                    isDark
                                      ? "text-emerald-300"
                                      : "text-emerald-600"
                                  }`
                            }
                          >
                            {labelFromCount(count)}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-2 ${
                            isDark ? "text-zinc-400" : "text-zinc-600"
                          }`}
                        >
                          {tags.length ? tags.join(", ") : "—"}
                        </td>
                        <td
                          className={`px-4 py-2 text-xs ${themeClasses.textMuted}`}
                        >
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
                                  {t(
                                    "org_question_banks",
                                    "btn_edit_questions"
                                  )}
                                </button>
                                <button
                                  onClick={(e) =>
                                    rowMenu.toggle(bank, e.currentTarget)
                                  }
                                  aria-haspopup="menu"
                                  className="inline-flex items-center justify-center rounded-full border border-sky-500 px-4 py-1.5 text-xs font-semibold bg-sky-500 text-white shadow-[0_8px_20px_rgba(56,189,248,0.45)] hover:bg-sky-400 hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                                >
                                  {t(
                                    "org_question_banks",
                                    "btn_options"
                                  )}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => goToEditQuestions(id)}
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                  isDark
                                    ? "bg-zinc-800 text-zinc-50 hover:bg-zinc-700"
                                    : "bg-gray-800 text-white hover:bg-gray-700"
                                }`}
                              >
                                {t(
                                  "org_question_banks",
                                  "btn_view_use"
                                )}
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
      </div>
    </div>
  );
}
