"use client";

import { useEffect, useState } from "react";
import {
  adminGetGallerySubmissions,
  adminGetGallerySubmissionById,
  adminDeleteGallerySubmission,
  adminApproveOrRejectGallerySubmission,
  type MapGallerySummaryResponse,
  type MapGalleryDetailResponse,
  type MapGalleryStatus,
} from "@/lib/api-map-gallery";
import { getMapDetail } from "@/lib/api-maps";
import Loading from "@/app/loading";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusBadgeClasses(status: MapGalleryStatus) {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "rejected":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200";
  }
}

export default function MapGalleryAdminPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [viewingMapId, setViewingMapId] = useState<string | null>(null);

  const [submissions, setSubmissions] = useState<MapGallerySummaryResponse[]>([]);
  const [selected, setSelected] = useState<MapGalleryDetailResponse | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [draftRejectReason, setDraftRejectReason] = useState("");
  const [actionErr, setActionErr] = useState<string | null>(null);

  async function loadList() {
    try {
      setLoadingList(true);
      const data = await adminGetGallerySubmissions(
        statusFilter === "all" ? undefined : { status: statusFilter }
      );
      setSubmissions(data ?? []);
    } catch (err) {
      console.error(err);
      alert("Không tải được danh sách map gallery.");
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDetail(id: string) {
    try {
      setLoadingDetail(true);
      const data = await adminGetGallerySubmissionById(id);
      setSelected(data);
    } catch (err) {
      console.error(err);
      alert("Không tải được chi tiết map gallery.");
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleApprove() {
    if (!selected) return;
    setActionErr(null);
    setApproveOpen(true);
  }

  async function submitApprove() {
    if (!selected) return;

    try {
      setUpdating(true);
      setActionErr(null);

      const updated = await adminApproveOrRejectGallerySubmission(selected.id, {
        status: "approved",
        isFeatured: selected.isFeatured ?? false,
      });

      setSelected(updated);
      setSubmissions((prev) =>
        prev.map((x) =>
          x.id === updated.id
            ? { ...x, status: updated.status, isFeatured: updated.isFeatured }
            : x
        )
      );

      setApproveOpen(false);
    } catch (err) {
      console.error(err);
      setActionErr("Duyệt map gallery thất bại.");
    } finally {
      setUpdating(false);
    }
  }

  function handleReject() {
    if (!selected) return;
    setActionErr(null);
    setDraftRejectReason(selected.rejectionReason ?? "");
    setRejectOpen(true);
  }

  async function submitReject() {
    if (!selected) return;

    try {
      setUpdating(true);
      setActionErr(null);

      const reason = draftRejectReason.trim();

      const updated = await adminApproveOrRejectGallerySubmission(selected.id, {
        status: "rejected",
        rejectionReason: reason ? reason : null,
      });

      setSelected(updated);
      setSubmissions((prev) =>
        prev.map((x) =>
          x.id === updated.id ? { ...x, status: updated.status } : x
        )
      );

      setRejectOpen(false);
    } catch (err) {
      console.error(err);
      setActionErr("Từ chối map gallery thất bại.");
    } finally {
      setUpdating(false);
    }
  }


  async function handleDelete(id: string) {
    if (!confirm("Xoá submission này?")) return;

    try {
      setUpdating(true);
      await adminDeleteGallerySubmission(id);
      setSubmissions((prev) => prev.filter((x) => x.id !== id));
      if (selected?.id === id) setSelected(null);
      alert("Đã xoá submission.");
    } catch (err) {
      console.error(err);
      alert("Xoá submission thất bại.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleViewMap(mapId: string) {
    try {
      setViewingMapId(mapId);
      const mapDetail = await getMapDetail(mapId);
      const isStoryMap = mapDetail?.isStoryMap ?? false;

      if (isStoryMap) {
        window.open(`/storymap/${mapId}`, "_blank");
      } else {
        window.open(`/maps/publish?mapId=${mapId}&view=true`, "_blank");
      }
    } catch (err) {
      console.error(err);
      // Fallback: mở như storymap nếu không lấy được map detail
      window.open(`/storymap/${mapId}`, "_blank");
    } finally {
      setViewingMapId(null);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Map gallery</h1>
          <p className="text-sm text-neutral-500">
            Quản lý các map user gửi lên gallery (duyệt / từ chối / xoá).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Tất cả</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={loadList}
            disabled={loadingList}
            className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingList ? <Loading /> : "Làm mới"}
          </button>
        </div>
      </div>

      {/* List + Detail */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.8fr)]">
        {/* List */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Danh sách submissions
            </h2>
          </div>
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2 text-left">Tên map</th>
                  <th className="px-4 py-2 text-left">Tác giả</th>
                  <th className="px-4 py-2 text-left">Trạng thái</th>
                  <th className="px-4 py-2 text-left">Tạo lúc</th>
                  <th className="px-4 py-2 text-center w-[180px] whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 && !loadingList && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-neutral-500"
                    >
                      Không có submission nào.
                    </td>
                  </tr>
                )}

                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-neutral-100 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-2 align-middle">
                      <div className="font-medium text-neutral-900">{s.mapName}</div>
                      {s.description && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                          {s.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 align-middle text-neutral-700">
                      {s.authorName ?? "—"}
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(
                          s.status
                        )}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-middle text-xs text-neutral-500">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <div className="flex justify-center gap-2 whitespace-nowrap">
                        <button
                          onClick={() => handleViewMap(s.mapId)}
                          disabled={viewingMapId === s.mapId}
                          className="rounded-md border border-sky-400 px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Xem thử bản đồ"
                        >
                          {viewingMapId === s.mapId ? "..." : "Xem Map"}
                        </button>
                        <button
                          onClick={() => loadDetail(s.id)}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
                        >
                          Chi tiết
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={updating}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {loadingList && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-neutral-500"
                    >
                      <Loading />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              {selected ? "Chi tiết submission" : "Chưa chọn submission"}
            </h2>
          </div>
          <div className="space-y-4 p-4">
            {!selected && !loadingDetail && (
              <p className="text-sm text-neutral-500">
                Chọn một submission ở bảng bên trái để xem chi tiết.
              </p>
            )}

            {loadingDetail && (
              <div className="text-sm text-neutral-500"><Loading /></div>
            )}

            {selected && !loadingDetail && (
              <>
                {selected.previewImage && (
                  <div className="overflow-hidden rounded-lg border border-neutral-200">
                    <img
                      src={selected.previewImage}
                      alt={selected.mapName}
                      className="h-56 w-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-xs font-semibold uppercase text-neutral-500">
                      Tên map
                    </div>
                    <div className="font-medium text-neutral-900">
                      {selected.mapName}
                    </div>
                  </div>

                  {selected.description && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-neutral-500">
                        Mô tả
                      </div>
                      <div className="text-neutral-800">
                        {selected.description}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="font-semibold text-neutral-500">Tác giả</div>
                      <div className="text-neutral-800">{selected.authorName ?? "—"}</div>
                      <div className="text-neutral-500">
                        {selected.authorEmail ?? ""}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-neutral-500">Thời gian</div>
                      <div>Tạo: {formatDate(selected.createdAt)}</div>
                      <div>Publish: {formatDate(selected.publishedAt)}</div>
                      <div>Review: {formatDate(selected.reviewedAt)}</div>
                    </div>
                  </div>

                  {selected.tags && selected.tags.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-neutral-500">
                        Tags
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selected.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.rejectionReason && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      <div className="mb-1 font-semibold">Lý do từ chối</div>
                      <div>{selected.rejectionReason}</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => handleViewMap(selected.mapId)}
                    disabled={viewingMapId === selected.mapId}
                    className="inline-flex items-center rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {viewingMapId === selected.mapId ? "Đang tải..." : "👁 Xem Map"}
                  </button>

                  <button
                    onClick={handleApprove}
                    disabled={updating || selected.status === "approved"}
                    className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selected.status === "approved"
                      ? "Đã approved"
                      : updating
                        ? <Loading />
                        : "Approve"}
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={updating || selected.status === "rejected"}
                    className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selected.status === "rejected" ? "Đã rejected" : "Reject"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {approveOpen && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-500/16 border border-green-500/25 flex-shrink-0">
                  <span className="text-green-600 font-semibold">✓</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="m-0 text-lg font-semibold leading-tight">
                    Duyệt map lên gallery
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    Map <b>{selected.mapName}</b> sẽ hiển thị công khai trong gallery.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {actionErr && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {actionErr}
                </div>
              )}
              <div className="text-sm text-zinc-600">
                Kiểm tra lại nội dung/preview trước khi duyệt nhé.
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                onClick={() => {
                  if (updating) return;
                  setApproveOpen(false);
                }}
                disabled={updating}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-gradient-to-br from-green-600 to-green-700 text-white shadow-sm disabled:opacity-50"
                onClick={submitApprove}
                disabled={updating}
              >
                {updating ? "Đang duyệt..." : "Duyệt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-red-500/20 max-w-lg w-full mx-4">
            <div className="p-6 border-b border-zinc-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/18 border border-red-500/40 flex-shrink-0">
                  <span className="text-red-600 font-semibold">!</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="m-0 text-lg font-semibold leading-tight text-red-600">
                    Từ chối map gallery
                  </div>
                  <div className="text-zinc-500 text-sm mt-1">
                    Map <b>{selected.mapName}</b> sẽ bị từ chối. Anh có thể nhập lý do (không bắt buộc).
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-3">
              {actionErr && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {actionErr}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700">
                  Lý do từ chối
                </label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-y min-h-[92px] disabled:opacity-50"
                  placeholder="VD: Nội dung chưa phù hợp, thiếu mô tả, hình preview mờ..."
                  value={draftRejectReason}
                  disabled={updating}
                  onChange={(e) => setDraftRejectReason(e.target.value)}
                />
                <div className="text-zinc-500 text-xs">
                  Lý do này sẽ hiển thị trong chi tiết submission.
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                onClick={() => {
                  if (updating) return;
                  setRejectOpen(false);
                }}
                disabled={updating}
              >
                Hủy
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-red-500/40 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                onClick={submitReject}
                disabled={updating}
              >
                {updating ? "Đang từ chối..." : "Từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
