"use client";

import { adminCreateCommunityPost, type CommunityPostCreateRequest } from "@/lib/api-community";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TOPICS = ["Product", "Tutorial", "Stories", "Education", "Business"] as const;

export default function NewCommunityPostPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CommunityPostCreateRequest>({
    slug: "",
    title: "",
    excerpt: "",
    contentHtml: "",
    topic: "Education",
    isPublished: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.slug.trim() || !formData.title.trim()) {
      setError("Slug và tiêu đề là bắt buộc.");
      return;
    }

    setSaving(true);
    try {
      const result = await adminCreateCommunityPost({
        ...formData,
        publishedAt: formData.isPublished ? new Date().toISOString() : undefined,
      });
      router.push(`/community-posts/${result.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo bài viết thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const loadSampleContent = () => {
    const sampleContent = `<h1>Chào mừng đến với IMOS</h1>
<p>Đây là một bài viết mẫu để giới thiệu về hệ thống bản đồ tương tác của chúng tôi.</p>

<h2>Tính năng nổi bật</h2>
<ul>
  <li><strong>Bản đồ tương tác:</strong> Tạo và chỉnh sửa bản đồ một cách trực quan</li>
  <li><strong>Hợp tác thời gian thực:</strong> Làm việc nhóm hiệu quả</li>
  <li><strong>Thư viện mẫu:</strong> Khởi đầu nhanh chóng với các template có sẵn</li>
</ul>

<h2>Hướng dẫn sử dụng</h2>
<ol>
  <li>Tạo bản đồ mới từ template hoặc từ đầu</li>
  <li>Thêm các lớp dữ liệu (layers) vào bản đồ</li>
  <li>Chỉnh sửa và tùy chỉnh theo nhu cầu</li>
  <li>Xuất bản và chia sẻ với cộng đồng</li>
</ol>

<h3>Ví dụ về liên kết</h3>
<p>Tham khảo thêm tại <a href="https://example.com">trang chủ</a> của chúng tôi.</p>

<p><em>Lưu ý: Đây chỉ là nội dung mẫu để test editor. Bạn có thể xóa và thay thế bằng nội dung thực tế.</em></p>`;

    setFormData((prev) => ({
      ...prev,
      title: prev.title || "Bài viết mẫu về IMOS",
      slug: prev.slug || "bai-viet-mau-ve-imos",
      excerpt: prev.excerpt || "Giới thiệu về hệ thống bản đồ tương tác IMOS với các tính năng nổi bật và hướng dẫn sử dụng cơ bản.",
      contentHtml: sampleContent,
    }));
  };

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0 mb-2">Tạo bài viết mới</h1>
          <p className="text-zinc-400 m-0">Thêm bài viết mới vào cộng đồng</p>
        </div>
        <Link
          href="/community-posts"
          className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          ← Quay lại
        </Link>
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
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            placeholder="Nhập tiêu đề bài viết"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            placeholder="bai-viet-moi"
            required
            pattern="[a-z0-9-]+"
          />
          <small className="text-zinc-400 text-sm block mt-1">
            URL-friendly: chỉ chữ thường, số và dấu gạch ngang
          </small>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Tóm tắt (Excerpt)
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 resize-y"
            placeholder="Mô tả ngắn gọn về bài viết"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-zinc-300">
              Nội dung HTML <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={loadSampleContent}
              className="px-3 py-1.5 text-sm bg-zinc-700 text-white border border-zinc-600 rounded hover:bg-zinc-600 transition-colors"
            >
              📝 Load nội dung mẫu
            </button>
          </div>
          <textarea
            value={formData.contentHtml}
            onChange={(e) => setFormData((prev) => ({ ...prev, contentHtml: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 resize-y font-mono text-sm"
            rows={15}
            required
            placeholder="Nhập nội dung HTML của bài viết"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Chủ đề</label>
            <select
              value={formData.topic}
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
                checked={formData.isPublished}
                onChange={(e) => setFormData((prev) => ({ ...prev, isPublished: e.target.checked }))}
                className="mr-2"
              />
              Xuất bản ngay
            </label>
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
            {saving ? "Đang lưu..." : "Tạo bài viết"}
          </button>
        </div>
      </form>
    </div>
  );
}

