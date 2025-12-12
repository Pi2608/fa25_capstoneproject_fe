"use client";

import {
  adminGetPostById,
  adminUpdateCommunityPost,
  adminDeleteCommunityPost,
  type CommunityPostUpdateRequest,
} from "@/lib/api-community";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Loading from "@/app/loading";

const TOPICS = ["Product", "Tutorial", "Stories", "Education", "Business"] as const;

export default function EditCommunityPostPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const id = params?.id ?? "";

  const [post, setPost] = useState<any>(null);
  const [formData, setFormData] = useState<CommunityPostUpdateRequest>({
    title: "",
    excerpt: "",
    contentHtml: "",
    topic: "Education",
    isPublished: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPost = async () => {
      if (!id) {
        setError("Thiếu ID bài viết.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await adminGetPostById(id);
        if (!cancelled) {
          setPost(data);
          setFormData({
            title: data.title,
            excerpt: data.excerpt,
            contentHtml: data.contentHtml,
            topic: data.topic,
            isPublished: data.isPublished,
            publishedAt: data.publishedAt,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Không thể tải bài viết.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPost();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!id) return;

    setSaving(true);
    try {
      await adminUpdateCommunityPost(id, {
        ...formData,
        publishedAt: formData.isPublished && !post?.publishedAt 
          ? new Date().toISOString() 
          : formData.publishedAt,
      });
      alert("Đã cập nhật bài viết thành công!");
      router.push("/community-posts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật bài viết thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài viết này? Hành động này không thể hoàn tác.")) {
      return;
    }

    setDeleting(true);
    try {
      await adminDeleteCommunityPost(id);
      router.push("/community-posts");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xóa bài viết thất bại.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="p-12 text-center"><Loading /></div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="p-5">
        <div className="p-4 mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700">
          {error}
        </div>
        <Link
          href="/community-posts"
          className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors inline-block mt-4"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0 mb-2">Chỉnh sửa bài viết</h1>
          <p className="text-zinc-400 m-0">
            {post?.slug && (
              <code className="text-sm bg-zinc-800 px-2 py-1 rounded">
                {post.slug}
              </code>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/community-posts"
            className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            ← Quay lại
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? "Đang xóa..." : "Xóa"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Tiêu đề <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Tóm tắt (Excerpt)</label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 resize-y"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Nội dung HTML <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.contentHtml}
            onChange={(e) => setFormData((prev) => ({ ...prev, contentHtml: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 resize-y font-mono text-sm"
            rows={15}
            required
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Chủ đề</label>
            <select
              value={formData.topic ?? ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, topic: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-zinc-300 flex items-center">
              <input
                type="checkbox"
                checked={formData.isPublished ?? false}
                onChange={(e) => setFormData((prev) => ({ ...prev, isPublished: e.target.checked }))}
                className="mr-2"
              />
              Đã xuất bản
            </label>
            {post?.publishedAt && (
              <small className="text-zinc-400 text-sm block mt-1">
                Xuất bản lúc: {new Date(post.publishedAt).toLocaleString("vi-VN")}
              </small>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <Link
            href="/community-posts"
            className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Hủy
          </Link>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}

