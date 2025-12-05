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
  const [rows, setRows] = useState<Organization[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<"Tất cả" | OrgStatus>("Tất cả");

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
            status: status === "Tất cả" ? undefined : status,
          });

        if (cancelled) return;
        setRows(res.items ?? []);
        setTotalPages(Math.max(1, res.totalPages ?? 1));
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error
              ? e.message
              : "Không thể tải danh sách tổ chức.";
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
    setStatus(e.target.value as "Tất cả" | OrgStatus);
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
      alert("Không thể cập nhật trạng thái tổ chức.");
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
      alert("Không thể xóa tổ chức. Vui lòng thử lại.");
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
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="Active">Hoạt động</option>
              <option value="Suspended">Đã khóa</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${theme.tableBorder}`}>
              <thead>
                <tr>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Tên tổ chức</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Chủ sở hữu</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Thành viên</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Trạng thái</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}>Ngày tạo</th>
                  <th className={`${isDark ? "text-zinc-400" : "text-gray-600"}`}></th>
                </tr>
              </thead>
              <tbody>
                  {rows.map((o) => (
                    <tr key={o.orgId}>
                      <td>{o.name}</td>
                      <td>{o.ownerName}</td>
                      <td>{o.totalMembers ?? "–"}</td>
                      <td>
                        {o.status === "Suspended" ? (
                          <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500">Đã khóa</span>
                        ) : (
                          <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-500">Hoạt động</span>
                        )}
                      </td>
                      <td>
                        {o.createdAt
                          ? new Date(o.createdAt).toLocaleDateString("vi-VN")
                          : "–"}
                      </td>
                      <td className="flex items-center gap-2">
                        <Link
                          href={`/organizations/${o.orgId}`}
                          className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                        >
                          Chi tiết
                        </Link>

                        <span className={theme.textMuted}>|</span>

                        <button
                          className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                          onClick={() => openEditModal(o)}
                        >
                          Sửa
                        </button>

                          <span className={theme.textMuted}>|</span>

                        <button
                          className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                          onClick={() => openDeleteModal(o)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  Trạng thái mới
                  <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <select
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors ${theme.select}`}
                    value={draft.nextStatus}
                    disabled={submitting}
                    onChange={onDraftStatusChange}
                  >
                    <option value="Active">Hoạt động</option>
                    <option value="Suspended">Đã khóa</option>
                  </select>
                </div>
                <div className={`${theme.textMuted} text-sm`}>
                  "Đã khóa" sẽ tạm chặn quyền truy cập của toàn bộ thành viên
                  trong tổ chức này.
                </div>
              </div>

              <div className="space-y-2">
                <label className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  Lý do thay đổi
                  <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <textarea
                    className={`w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors resize-y ${theme.input}`}
                    placeholder="VD: Hoạt động bất thường, cần tạm ngưng để kiểm tra thanh toán."
                    value={draft.reason}
                    disabled={submitting}
                    onChange={onDraftReasonChange}
                  />
                </div>
                <div className={`${theme.textMuted} text-sm`}>
                  Lý do này sẽ được lưu trong lịch sử hoạt động quản trị.
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                disabled={submitting}
                onClick={closeEditModal}
              >
                Hủy
              </button>
              <button
                className={`px-4 py-2 rounded-lg border transition-colors ${theme.button}`}
                disabled={submitting}
                onClick={submitUpdate}
              >
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
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
                Hủy
              </button>

              <button
                className="px-4 py-2 rounded-lg border border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                disabled={deleting}
                onClick={confirmDelete}
              >
                {deleting ? "Đang xóa..." : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
