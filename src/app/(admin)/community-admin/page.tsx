"use client";

import { useEffect, useState } from "react";
import {
  adminGetCommunityPosts,
  adminGetCommunityPostById,
  adminCreateCommunityPost,
  adminUpdateCommunityPost,
  adminDeleteCommunityPost,
  type CommunityPostSummaryResponse,
  type CommunityPostDetailResponse,
  type CommunityPostAdminCreateRequest,
  type CommunityPostAdminUpdateRequest,
} from "@/lib/api-community";
import Loading from "@/app/loading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";


type FormState = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  topic: string;
  contentHtml: string;
  publishedAt: string;
  isPublished: boolean;
};

const emptyForm: FormState = {
  slug: "",
  title: "",
  excerpt: "",
  topic: "",
  contentHtml: "",
  publishedAt: "",
  isPublished: true,
};

function formatDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

export default function AdminCommunityPage() {
  const [posts, setPosts] = useState<CommunityPostSummaryResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const loadList = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await adminGetCommunityPosts();
      setPosts(data);
    } catch (e) {
      setError("Không tải được danh sách bài viết.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

  const onSelectNew = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      publishedAt: new Date().toISOString(),
    });
  };

  const onSelectEdit = async (id: string) => {
    setError(null);
    try {
      const detail = await adminGetCommunityPostById(id);
      const f: FormState = {
        id: detail.id,
        slug: detail.slug,
        title: detail.title,
        excerpt: detail.excerpt,
        topic: detail.topic ?? "",
        contentHtml: detail.contentHtml,
        publishedAt: detail.publishedAt ?? new Date().toISOString(),
        isPublished: detail.isPublished,
      };
      setEditingId(id);
      setForm(f);
    } catch (e) {
      setError("Không tải được chi tiết bài viết.");
      console.error(e);
    }
  };

  const onChangeField = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const payload: CommunityPostAdminCreateRequest | CommunityPostAdminUpdateRequest = {
      slug: form.slug,
      title: form.title,
      excerpt: form.excerpt,
      topic: form.topic || undefined,
      contentHtml: form.contentHtml,
      publishedAt: form.publishedAt || new Date().toISOString(),
      isPublished: form.isPublished,
    };

    try {
      let result: CommunityPostDetailResponse;
      if (editingId) {
        result = await adminUpdateCommunityPost(editingId, payload);
      } else {
        result = await adminCreateCommunityPost(
          payload as CommunityPostAdminCreateRequest,
        );
        setEditingId(result.id);
      }

      await loadList();

      const updatedForm: FormState = {
        id: result.id,
        slug: result.slug,
        title: result.title,
        excerpt: result.excerpt,
        topic: result.topic ?? "",
        contentHtml: result.contentHtml,
        publishedAt: result.publishedAt ?? "",
        isPublished: result.isPublished,
      };
      setForm(updatedForm);
    } catch (e) {
      setError("Lưu bài viết thất bại.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (id: string, title: string) => {
    setDeleteErr(null);
    setPendingDelete({ id, title });
  };

  const cancelDelete = () => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteErr(null);
  };

  const doDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      await adminDeleteCommunityPost(pendingDelete.id);
      await loadList();
      if (editingId === pendingDelete.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      setPendingDelete(null);
    } catch (e) {
      setDeleteErr("Xoá bài viết thất bại.");
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Community posts</h1>
          <p className="text-sm text-zinc-500">
            Quản lý bài viết cộng đồng hiển thị cho người dùng.
          </p>
        </div>
        {/* <button
          type="button"
          onClick={onSelectNew}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
        >
          + Bài viết mới
        </button> */}
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Danh sách bài viết</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="px-2 py-2">Tiêu đề</th>
                  <th className="px-2 py-2">Slug</th>
                  <th className="px-2 py-2">Chủ đề</th>
                  <th className="px-2 py-2">Published</th>
                  <th className="px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-2 py-4 text-center text-sm text-zinc-400"
                    >
                      Chưa có bài viết nào.
                    </td>
                  </tr>
                )}
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-sm text-zinc-400">
                      <Loading />
                    </td>
                  </tr>
                ) : posts.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span>{p.title}</span>
                        {p.riskText && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{p.riskText}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-500">{p.slug}</td>
                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {p.topic || "-"}
                    </td>
                    <td className="px-2 py-2 text-xs text-zinc-500">
                      {formatDate(p.publishedAt)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectEdit(p.id)}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(p.id, p.title)}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {editingId ? "Chỉnh sửa bài viết" : "Tạo bài viết mới"}
          </h2>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Tiêu đề
                </label>
                <input
                  value={form.title}
                  onChange={(e) => onChangeField("title", e.target.value)}
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">
                  Slug
                </label>
                <input
                  value={form.slug}
                  onChange={(e) => onChangeField("slug", e.target.value)}
                  required
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Mô tả ngắn (excerpt)
              </label>
              <textarea
                value={form.excerpt}
                onChange={(e) => onChangeField("excerpt", e.target.value)}
                rows={2}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Chủ đề (topic)
              </label>
              <input
                value={form.topic}
                onChange={(e) => onChangeField("topic", e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Nội dung HTML
              </label>
              <textarea
                value={form.contentHtml}
                onChange={(e) => onChangeField("contentHtml", e.target.value)}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="isPublished"
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => onChangeField("isPublished", e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label
                htmlFor="isPublished"
                className="text-xs font-medium text-zinc-700"
              >
                Đã publish
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onSelectNew}
                className="rounded-md border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Làm mới form
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {saving ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Tạo bài viết"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-white shadow-xl">
            <div className="border-b border-red-100 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white">
                  !
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-red-900">
                    Xóa bài viết
                  </div>
                  <div className="mt-1 text-xs text-red-700">
                    Hành động này không thể hoàn tác. Bài viết chỉ có thể xóa nếu
                    phù hợp điều kiện hệ thống.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4">
              {deleteErr && (
                <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {deleteErr}
                </div>
              )}
              <p className="mb-1.5 text-sm text-zinc-900">
                Bạn có chắc muốn xóa{" "}
                <span className="font-semibold text-red-600">bài viết này</span> không?
              </p>
              <p className="text-xs leading-relaxed text-zinc-600">
                Bài viết{" "}
                <span className="font-semibold text-red-600">{pendingDelete.title}</span>{" "}
                sẽ bị xóa vĩnh viễn khỏi hệ thống nếu đủ điều kiện.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                onClick={cancelDelete}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={doDelete}
                disabled={deleting}
              >
                {deleting ? "Đang xoá…" : "Xoá bài viết"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
