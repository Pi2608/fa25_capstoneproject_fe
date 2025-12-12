"use client";

import { adminGetAllPosts, adminDeleteCommunityPost, type CommunityPostSummaryResponse } from "@/lib/api-community";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { useLoading } from "@/contexts/LoadingContext";

const TOPICS = ["All", "Product", "Tutorial", "Stories", "Education", "Business"] as const;
type Topic = (typeof TOPICS)[number];

export default function CommunityPostsPage() {
  const loading = useLoading();
  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);
  const [posts, setPosts] = useState<CommunityPostSummaryResponse[]>([]);
  const [topicFilter, setTopicFilter] = useState<Topic>("All");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      loading.showLoading();
      try {
        const data = await adminGetAllPosts();
        if (!cancelled) {
          setPosts(data);
        }
      } catch (e) {
        if (!cancelled) {
          loading.setLoadingMessage(e instanceof Error ? e.message : "Không thể tải danh sách bài viết.");
        }
      } finally {
        if (!cancelled) {
          loading.hideLoading();
        }
      }
    };

    loadPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài viết này?")) return;

    setDeletingId(id);
    try {
      await adminDeleteCommunityPost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xóa bài viết thất bại.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredPosts = topicFilter === "All" 
    ? posts 
    : posts.filter((p) => p.topic === topicFilter);

  const fmtDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0 mb-2">Quản lý Bài viết Cộng đồng</h1>
          <p className={`${theme.textMuted} m-0`}>Tạo, chỉnh sửa và quản lý các bài viết cộng đồng</p>
        </div>
        <Link
          href="/community-posts/new"
          className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer inline-flex items-center gap-2"
        >
          <span>+</span>
          <span>Tạo bài viết mới</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <label className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Chủ đề:</label>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value as Topic)}
            className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${theme.select}`}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "Tất cả" : t}
              </option>
            ))}
          </select>
        </div>
      </div>

        <div className={`overflow-auto border ${theme.tableBorder} rounded-lg`}>  
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Tiêu đề</th>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Slug</th>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Chủ đề</th>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Ngày xuất bản</th>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Trạng thái</th>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs w-[140px]`}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id}>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <strong>{post.title}</strong>
                      {post.excerpt && (
                        <div className={`text-sm ${theme.textMuted} mt-1`}>
                          {post.excerpt.slice(0, 60)}...
                        </div>
                      )}
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <code className={`text-sm px-2 py-1 rounded ${isDark ? "bg-zinc-800" : "bg-gray-100"}`}>
                        {post.slug}
                      </code>
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>{post.topic || "N/A"}</td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {post.publishedAt ? fmtDate(post.publishedAt) : "Chưa xuất bản"}
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {post.isPublished ? (
                        <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700">
                          Đã xuất bản
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                          Chưa xuất bản
                        </span>
                      )}
                    </td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <div className="flex gap-2">
                        <Link
                          href={`/community-posts/${post.id}/edit`}
                          className={`w-9 h-9 grid place-items-center rounded-lg border transition-colors ${
                            isDark
                              ? "border-zinc-800 bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700"
                              : "border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                          title="Chỉnh sửa"
                        >
                          <EditIcon />
                        </Link>
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={deletingId === post.id}
                          className={`w-9 h-9 grid place-items-center rounded-lg border transition-colors disabled:opacity-50 ${
                            isDark
                              ? "border-zinc-800 bg-zinc-800/90 text-red-500 hover:bg-zinc-700"
                              : "border-gray-300 bg-gray-100 text-red-600 hover:bg-gray-200"
                          }`}
                          title="Xóa"
                        >
                          {deletingId === post.id ? <SpinnerIcon /> : <DeleteIcon />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="32" strokeDashoffset="32">
        <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite" />
        <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

