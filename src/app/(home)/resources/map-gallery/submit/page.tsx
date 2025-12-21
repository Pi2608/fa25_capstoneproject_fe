"use client";

import { useEffect, useState } from "react";
import {
  submitMapToGallery,
  getMyGallerySubmission,
  updateMyGallerySubmission,
  MapGalleryCategory,
  MapGalleryDetailResponse,
} from "@/lib/api-map-gallery";
import { getMyMaps, MapDto, publishMap } from "@/lib/api-maps";
import { useToast } from "@/contexts/ToastContext";


const CATEGORY_OPTIONS: { value: MapGalleryCategory; label: string }[] = [
  { value: "general", label: "Tổng quan / General" },
  { value: "business", label: "Kinh doanh / Business" },
  { value: "planning", label: "Quy hoạch / Planning" },
  { value: "logistics", label: "Logistics" },
  { value: "research", label: "Nghiên cứu / Research" },
  { value: "operations", label: "Vận hành / Operations" },
  { value: "education", label: "Giáo dục / Education" },
];

type ApiErrorShape = {
  status: number;
  message: string;
};

function isApiError(e: unknown): e is ApiErrorShape {
  return !!e && typeof e === "object" && "status" in e && typeof (e as any).status === "number";
}

type BannerType = "success" | "error" | "info";

function Banner({
  type,
  message,
  onClose,
}: {
  type: BannerType;
  message: string;
  onClose: () => void;
}) {
  const base =
    "pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2 text-sm shadow-lg max-w-sm";
  const styleMap: Record<BannerType, string> = {
    success: "border-emerald-500/40 bg-emerald-950/80 text-emerald-100",
    error: "border-red-500/40 bg-red-950/80 text-red-100",
    info: "border-zinc-500/40 bg-zinc-950/80 text-zinc-100",
  };
  const dotMap: Record<BannerType, string> = {
    success: "bg-emerald-400",
    error: "bg-red-400",
    info: "bg-zinc-400",
  };

  return (
    <div className={`${base} ${styleMap[type]}`}>
      <span className={`mt-1 h-2 w-2 rounded-full ${dotMap[type]}`} />
      <div className="flex-1 text-xs sm:text-sm">{message}</div>
      <button
        onClick={onClose}
        className="ml-1 rounded-full px-2 text-xs text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
      >
        ✕
      </button>
    </div>
  );
}

export default function MapGallerySubmitPage() {
  const { showToast } = useToast();
  const [maps, setMaps] = useState<MapDto[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [mapsError, setMapsError] = useState<string | null>(null);

  const [selectedMapId, setSelectedMapId] = useState<string>("");

  const [mapName, setMapName] = useState("");
  const [description, setDescription] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [category, setCategory] = useState<MapGalleryCategory>("general");
  const [tagsInput, setTagsInput] = useState("");

  const [loadingCheck, setLoadingCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [existingSubmission, setExistingSubmission] =
    useState<MapGalleryDetailResponse | null>(null);
  const [statusInfo, setStatusInfo] = useState<string | null>(null);

  // Load tất cả map của user
  useEffect(() => {
    let isMounted = true;
    const loadMaps = async () => {
      setLoadingMaps(true);
      setMapsError(null);
      try {
        const res = await getMyMaps();
        if (!isMounted) return;
        setMaps(res);
        if (res.length > 0) {
          setSelectedMapId(res[0].id);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setMapsError(err?.message || "Không thể tải danh sách bản đồ của bạn.");
      } finally {
        if (isMounted) setLoadingMaps(false);
      }
    };
    loadMaps();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedMap = maps.find((m) => m.id === selectedMapId) ?? null;

  // Load / đồng bộ submission theo mapId
  const loadSubmissionForMap = async (
    mapIdToLoad: string,
    opts?: { silent?: boolean }
  ) => {
    if (!mapIdToLoad) return;
    setLoadingCheck(true);
    setStatusInfo(null);
    try {
      const detail = await getMyGallerySubmission(mapIdToLoad);
      setExistingSubmission(detail);
      setMapName(detail.mapName);
      setDescription(detail.description);
      setPreviewImage(detail.previewImage ?? "");
      setCategory(detail.category);
      setTagsInput((detail.tags || []).join(", "));

      let statusText = "";
      if (detail.status === "pending") statusText = "Đang chờ duyệt";
      else if (detail.status === "approved") statusText = "Đã được duyệt";
      else if (detail.status === "rejected") statusText = "Bị từ chối";
      else statusText = `Trạng thái: ${detail.status}`;

      if (detail.rejectionReason) {
        statusText += ` • Lý do: ${detail.rejectionReason}`;
      }

      setStatusInfo(statusText);
      if (!opts?.silent) {
        showToast("success", "Đã tải submission hiện có cho bản đồ này.");
      }
    } catch (err: any) {
      if (isApiError(err) && err.status === 404) {
        // Chưa có submission → fill từ map gốc
        setExistingSubmission(null);
        const baseMap = maps.find((m) => m.id === mapIdToLoad);
        setMapName(baseMap?.name ?? "");
        setDescription(baseMap?.description ?? "");
        setPreviewImage(baseMap?.previewImage ?? "");
        setCategory("general");
        setTagsInput("");
        setStatusInfo(
          "Bản đồ này chưa được gửi lên thư viện. Bạn có thể tạo submission mới."
        );
        if (!opts?.silent) {
          showToast(
            "info",
            "Map này chưa có submission. Hãy điền thông tin và gửi mới."
          );
        }
      } else {
        if (!opts?.silent) {
          showToast(
            "error",
            err?.message || "Không thể kiểm tra submission hiện có."
          );
        }
      }
    } finally {
      setLoadingCheck(false);
    }
  };

  useEffect(() => {
    if (!selectedMapId || maps.length === 0) return;
    
    const baseMap = maps.find((m) => m.id === selectedMapId);
    if (baseMap) {
      setMapName(baseMap.name ?? "");
      setDescription(baseMap.description ?? "");
      setPreviewImage(baseMap.previewImage ?? "");
      setCategory("general");
      setTagsInput("");
      setExistingSubmission(null);
      setStatusInfo("Chọn 'Tải / làm mới từ Gallery' để kiểm tra submission hiện có.");
    }
  }, [selectedMapId, maps]);

  const handleSubmit = async () => {
    const trimmedName = mapName.trim();

    if (!selectedMapId) {
      showToast("error", "Vui lòng chọn một bản đồ để gửi lên Gallery.");
      return;
    }

    if (!trimmedName) {
      showToast("error", "Vui lòng nhập đầy đủ Tên bản đồ.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSubmitting(true);
    try {
      // Check if map is published, if not, publish it first
      const currentMap = maps.find((m) => m.id === selectedMapId);
      if (currentMap && currentMap.status !== "published") {
        showToast("info", "Đang publish bản đồ...");
        await publishMap(selectedMapId);
        showToast("success", "Bản đồ đã được publish thành công.");
      }

      if (existingSubmission) {
        await updateMyGallerySubmission(existingSubmission.id, {
          mapName: trimmedName,
          description: description,
          previewImage: previewImage.trim() || null,
          category,
          tags,
        });
        showToast("success", "Cập nhật submission thành công.");
      } else {
        await submitMapToGallery({
          mapId: selectedMapId,
          mapName: trimmedName,
          description: description,
          previewImage: previewImage.trim() || null,
          category,
          tags,
        });
        showToast("success", "Gửi bản đồ lên thư viện thành công.");
      }
    } catch (err: any) {
      showToast("error", err?.message || "Gửi bản đồ thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const tags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10 text-zinc-100">
        {/* Hero */}
        <section className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-emerald-950/50 p-6 shadow-xl ring-1 ring-emerald-500/20">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Gửi bản đồ lên Thư viện Cộng đồng
          </h1>
          <p className="mt-2 text-sm text-zinc-300">
            Chọn một bản đồ đã publish của bạn, thêm mô tả và thẻ chủ đề. Bản đồ
            sẽ được gửi tới đội ngũ quản trị duyệt trước khi xuất hiện trong
            Gallery công khai.
          </p>
        </section>

        {/* Form + Preview */}
        <section className="mt-6 grid gap-6 rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-6 ring-1 ring-emerald-500/20 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* LEFT: FORM */}
          <div className="space-y-6">
            {/* Chọn map */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100">
                1. Chọn bản đồ của bạn
              </label>
              {loadingMaps ? (
                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-400">
                  Đang tải danh sách bản đồ...
                </div>
              ) : mapsError ? (
                <div className="rounded-xl border border-red-500/40 bg-red-950/70 px-3 py-2 text-sm text-red-100">
                  {mapsError}
                </div>
              ) : maps.length === 0 ? (
                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/80 px-3 py-3 text-sm text-zinc-300">
                  Bạn chưa có bản đồ nào. Hãy tạo bản đồ trước rồi quay lại gửi
                  lên Gallery.
                </div>
              ) : (
                <>
                  <select
                    value={selectedMapId}
                    onChange={(e) => setSelectedMapId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/70"
                  >
                    {maps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.status ? `(${m.status})` : ""}{" "}
                        {m.isPublic ? "• Public" : "• Private"}
                      </option>
                    ))}
                  </select>
                  {selectedMap && (
                    <p className="text-xs text-zinc-400">
                      Workspace: {selectedMap.workspaceName || "—"} • Trạng thái:{" "}
                      {selectedMap.status || "không rõ"} •{" "}
                      {selectedMap.isPublic
                        ? "Đang ở chế độ Public"
                        : "Chỉ mình bạn xem được"}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        selectedMapId && loadSubmissionForMap(selectedMapId)
                      }
                      disabled={loadingCheck || !selectedMapId}
                      className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:border-emerald-400/80 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingCheck
                        ? "Đang đồng bộ..."
                        : "Tải / làm mới từ Gallery"}
                    </button>
                    {statusInfo && (
                      <span className="text-[11px] text-emerald-300">
                        {statusInfo}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Tên + Category */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100">
                  2. Tên bản đồ hiển thị trong Gallery
                </label>
                <input
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  placeholder="Ví dụ: Bản đồ ngập lụt Quận 7"
                  className="w-full rounded-xl border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/70"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100">
                  Danh mục
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as MapGalleryCategory)
                  }
                  className="w-full rounded-xl border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/70"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mô tả */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100">
                3. Mô tả bản đồ
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Giải thích ngắn gọn mục đích, dữ liệu và cách sử dụng bản đồ này."
                className="w-full rounded-xl border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/70"
              />
              <p className="text-xs text-zinc-400">
                Mô tả rõ ràng sẽ giúp người khác dễ hiểu và tăng cơ hội được
                chọn Featured.
              </p>
            </div>

            {/* Preview image */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100">
                4. Ảnh preview (URL, tùy chọn)
              </label>
              <input
                value={previewImage}
                onChange={(e) => setPreviewImage(e.target.value)}
                placeholder="Dán link ảnh thumbnail hoặc để trống để hệ thống tự tạo."
                className="w-full rounded-xl border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/70"
              />
              <p className="text-xs text-zinc-400">
                Nên dùng ảnh 16:9, chất lượng tốt. Có thể là screenshot vùng
                bản đồ chính.
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100">
                5. Tags (phân tách bằng dấu phẩy)
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="ví dụ: flood, education, district-7"
                className="w-full rounded-xl border border-zinc-700/70 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-400/70"
              />
              <p className="text-xs text-zinc-400">
                Thêm một vài từ khóa để người khác dễ tìm (không cần quá nhiều).
              </p>
            </div>

            {/* Submit */}
            <div className="flex flex-col items-start justify-between gap-3 pt-4 sm:flex-row sm:items-center">
              <p className="text-xs text-zinc-400">
                Khi nhấn gửi, bản đồ sẽ được gửi tới đội ngũ quản trị để duyệt.
                Bạn vẫn có thể quay lại trang này để chỉnh sửa nội dung nếu cần.
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !selectedMapId}
                className="w-full rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting
                  ? "Đang gửi…"
                  : existingSubmission
                  ? "Cập nhật submission"
                  : "Gửi bản đồ lên Gallery"}
              </button>
            </div>
          </div>

          {/* RIGHT: PREVIEW */}
          <aside className="flex flex-col gap-4 rounded-2xl border border-zinc-700/60 bg-zinc-950/80 p-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Preview trong Gallery
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-700/70 bg-zinc-900/80">
              <div className="aspect-[16/9] w-full bg-zinc-800">
                {previewImage.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewImage}
                    alt={mapName || "Map preview"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500/20 via-emerald-400/10 to-transparent text-xs text-emerald-200">
                    Preview sẽ hiển thị ở đây
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                    {CATEGORY_OPTIONS.find((c) => c.value === category)?.label ??
                      "Danh mục"}
                  </span>
                  {existingSubmission && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                      Đã gửi
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold">
                  {mapName || "Tên bản đồ sẽ hiển thị tại đây"}
                </div>
                <p className="line-clamp-3 text-xs text-zinc-400">
                  {description ||
                    "Mô tả ngắn gọn về bản đồ sẽ hiển thị tại đây."}
                </p>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 ring-1 ring-zinc-700/80"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {/* {selectedMap && (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Map ID:{" "}
                    <span className="break-all">{selectedMap.id}</span>
                  </p>
                )} */}
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Đây chỉ là preview giao diện card trong Gallery. Bản đồ thực tế sau
              khi được duyệt sẽ hiển thị cùng các bản đồ khác ở trang Thư viện.
            </p>
          </aside>
        </section>
      </main>
    </>
  );
}
