"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  adminGetOrganizations,
  adminUpdateOrganizationStatus,
  adminDeleteOrganization,
  type Paged,
  type OrgStatus,
} from "@/lib/admin-api";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { useLoading } from "@/contexts/LoadingContext";
import { useI18n } from "@/i18n/I18nProvider";

type Organization = {
  orgId: string;
  name: string;
  ownerName: string;
  status: OrgStatus;
  createdAt?: string | null;
  totalMembers?: number | null;
};

type EditDraft = {
  orgId: string;
  currentStatus: OrgStatus;
  nextStatus: OrgStatus;
  reason: string;
};

export default function OrganizationsPage() {
  const { isDark } = useTheme();
  const loading = useLoading();
  const theme = getThemeClasses(isDark);
  const { t } = useI18n();
  const [rows, setRows] = useState<Organization[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<string>("all");

  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      loading.showLoading();

      try {
        const res: Paged<Organization> =
          await adminGetOrganizations<Organization>({
            page,
            pageSize: 10,
            search: search.trim() || undefined,
            status: status === "all" ? undefined : (status as OrgStatus),
          });

        if (cancelled) return;
        setRows(res.items ?? []);
        setTotalPages(Math.max(1, res.totalPages ?? 1));
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : t("admin", "cannot_load_orgs");
          loading.setLoadingMessage(msg);
        }
      } finally {
        if (!cancelled) loading.hideLoading();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, search, status]);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value);
    setPage(1);
  };

  const openEditModal = (org: Organization) => {
    const toggledStatus: OrgStatus =
      org.status === "Suspended" ? "Active" : "Suspended";

    setDraft({
      orgId: org.orgId,
      currentStatus: org.status,
      nextStatus: toggledStatus,
      reason: "",
    });
  };

  const closeEditModal = () => {
    if (submitting) return;
    setDraft(null);
  };

  const onDraftStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      nextStatus: e.target.value as OrgStatus,
    });
  };

  const onDraftReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      reason: e.target.value,
    });
  };

  const submitUpdate = async () => {
    if (!draft) return;
    if (!draft.reason.trim()) {
      alert("Vui lòng nhập lý do.");
      return;
    }

    setSubmitting(true);

    const prevStatus: OrgStatus = draft.currentStatus;
    const newStatus: OrgStatus = draft.nextStatus;
    const orgId = draft.orgId;
    const reasonText = draft.reason.trim();

    // optimistic UI
    setRows((list) =>
      list.map((x) =>
        x.orgId === orgId ? { ...x, status: newStatus } : x
      )
    );

    try {
      await adminUpdateOrganizationStatus(orgId, {
        orgId,
        status: newStatus,
        reason: reasonText,
      });
      setDraft(null);
    } catch {
      // rollback
      setRows((list) =>
        list.map((x) =>
          x.orgId === orgId ? { ...x, status: prevStatus } : x
        )
      );
      alert(t("admin", "cannot_update_status"));
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (org: Organization) => {
    setDeleteTarget(org);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);

    const orgId = deleteTarget.orgId;

    try {
      await adminDeleteOrganization(orgId);

      // remove from list
      setRows((list) => list.filter((x) => x.orgId !== orgId));

      setDeleteTarget(null);
    } catch {
      alert(t("admin", "cannot_delete_org"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-5">
      <section className={`${isDark ? "bg-zinc-900/50" : "bg-white"} p-6 rounded-lg border ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
        <div className="flex items-center justify-between mb-6">
          <h3>Quản lý tổ chức</h3>
          <div className="flex items-center gap-2">
            <input
              className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${theme.input} placeholder:${isDark ? "text-zinc-400" : "text-gray-400"}`}
              placeholder="Tìm theo tên…"
              value={search}
              onChange={onSearchChange}
            />
            <select
              className={`px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${theme.select}`}
              value={status}
              onChange={onStatusChange}
            >
              <option value="all">{t("admin", "all_statuses")}</option>
              <option value="Active">{t("admin", "status_active")}</option>
              <option value="Suspended">{t("admin", "status_suspended")}</option>
            </select>
          </div>
        </div>

        <div
          className={`overflow-auto border rounded-lg mt-2 ${
            isDark ? "border-zinc-800" : "border-gray-200"
          }`}
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  Tên tổ chức
                </th>
                <th
                  className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  Chủ sở hữu
                </th>
                <th
                  className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  {t("admin", "members")}
                </th>
                <th
                  className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  {t("admin", "status")}
                </th>
                <th
                  className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                >
                  Ngày tạo
                </th>
                <th
                  className={`p-3 border-b text-left font-extrabold text-xs ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/95 text-zinc-400"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}
                ></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`p-4 text-center ${
                      isDark ? "text-zinc-400" : "text-gray-500"
                    }`}
                  >
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                rows.map((o) => (
                  <tr key={o.orgId}>
                    <td
                      className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}
                    >
                      {o.name}
                    </td>
                    <td
                      className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}
                    >
                      {o.ownerName}
                    </td>
                    <td
                      className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}
                    >
                      {o.totalMembers ?? "–"}
                    </td>
                    <td
                      className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}
                    >
                      {o.status === "Suspended" ? (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">
                          {t("admin", "status_suspended")}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">
                          {t("admin", "status_active")}
                        </span>
                      )}
                    </td>
                    <td
                      className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}
                    >
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleDateString("vi-VN")
                        : "–"}
                    </td>
                    <td
                      className={`p-3 border-b text-left ${
                        isDark ? "border-zinc-800" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/organizations/${o.orgId}`}
                          className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0"
                        >
                          Chi tiết
                        </Link>
                        <span className="text-zinc-400">|</span>
                        <button
                          className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0"
                          onClick={() => openEditModal(o)}
                        >
                          Sửa
                        </button>
                        <span className="text-zinc-400">|</span>
                        <button
                          className="text-red-600 hover:underline cursor-pointer bg-transparent border-0 p-0"
                          onClick={() => openDeleteModal(o)}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>
          <div className="flex items-center gap-2">
            <b>Trang {page}</b> <span>/ {totalPages}</span>
          </div>
          <button
            className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      </section>

      {/* Modal cập nhật trạng thái tổ chức */}
      {draft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-zinc-900" : "bg-white"} rounded-lg p-6 shadow-sm max-w-lg w-full border ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
            <div className={`flex items-start gap-4 pb-3 border-b ${isDark ? "border-zinc-800" : "border-gray-200"} mb-5`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-zinc-800/90 text-zinc-200" : "bg-gray-100 text-gray-700"}`}>
                {draft.nextStatus === "Suspended" ? (
                  <span className="text-red-500">!</span>
                ) : (
                  <span className="text-green-500">✓</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="m-0 text-2xl font-bold leading-none whitespace-nowrap text-ellipsis overflow-hidden">
                  Cập nhật trạng thái tổ chức
                </div>
                <div className={`${theme.textMuted} mt-1`}>
                  Thay đổi trạng thái hoạt động của tổ chức. Hệ thống sẽ ghi
                  nhận lý do để phục vụ kiểm tra và đối soát.
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {t("admin", "new_status")}
                  <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <select
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${theme.select}`}
                    value={draft.nextStatus}
                    disabled={submitting}
                    onChange={onDraftStatusChange}
                  >
                    <option value="Active">{t("admin", "status_active")}</option>
                    <option value="Suspended">{t("admin", "status_suspended")}</option>
                  </select>
                </div>
                <div className={`${theme.textMuted} text-sm`}>
                  {t("admin", "org_suspended_note")}
                </div>
              </div>

              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {t("admin", "change_reason")}
                  <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <textarea
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors resize-y ${theme.input}`}
                    placeholder={t("admin", "org_reason_placeholder")}
                    value={draft.reason}
                    disabled={submitting}
                    onChange={onDraftReasonChange}
                  />
                </div>
                <div className={`${theme.textMuted} text-sm`}>
                  {t("admin", "org_reason_note")}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                disabled={submitting}
                onClick={closeEditModal}
              >
                {t("common", "cancel")}
              </button>
              <button
                className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                disabled={submitting}
                onClick={submitUpdate}
              >
                {submitting ? t("admin", "saving") : t("admin", "save_changes")}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${isDark ? "bg-zinc-900" : "bg-white"} rounded-lg p-6 shadow-sm border ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
            <div className={`flex items-start gap-4 pb-3 border-b ${isDark ? "border-zinc-800" : "border-gray-200"} mb-5`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-zinc-800/90 text-zinc-200" : "bg-gray-100 text-gray-700"}`}>
                <span className="text-red-500">!</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="m-0 text-2xl font-bold leading-none whitespace-nowrap text-ellipsis overflow-hidden">
                  Xóa tổ chức này?
                </div>
                <div className={`${theme.textMuted} mt-1`}>
                  Thao tác này sẽ xóa vĩnh viễn tổ chức{" "}
                  <span className={`font-semibold ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                    {deleteTarget.name}
                  </span>{" "}
                  và toàn bộ dữ liệu liên quan. Hành động này không thể hoàn tác.
                </div>
              </div>
            </div>

            <div className="space-y-6 mb-5">
              <div className={`${theme.textMuted} text-sm`}>
                Vui lòng xác nhận rằng bạn hiểu hậu quả và muốn tiếp tục.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                disabled={deleting}
                onClick={closeDeleteModal}
              >
                {t("common", "cancel")}
              </button>

              <button
                className="px-4 py-2 rounded-lg border border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? t("admin", "deleting") : t("admin", "delete_permanently")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
