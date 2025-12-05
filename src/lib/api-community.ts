import { getToken } from "./api-core";
import { apiFetch } from "./api-core";

const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface CommunityPostSummaryResponse {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  topic: string;
  publishedAt: string;
}

export interface CommunityPostDetailResponse {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  topic: string;
  publishedAt: string;
  isPublished: boolean;
}

export interface CommunityPostCreateRequest {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  topic: string;
  publishedAt?: string;
  isPublished?: boolean;
}

export interface CommunityPostUpdateRequest {
  title?: string;
  excerpt?: string;
  contentHtml?: string;
  topic?: string;
  publishedAt?: string;
  isPublished?: boolean;
}

// Public APIs
export async function getPublishedPosts(topic?: string): Promise<CommunityPostSummaryResponse[]> {
  const query = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return apiFetch<CommunityPostSummaryResponse[]>(`/community/posts${query}`);
}

export async function getPostBySlug(slug: string): Promise<CommunityPostDetailResponse> {
  return apiFetch<CommunityPostDetailResponse>(`/community/posts/${encodeURIComponent(slug)}`);
}

// Admin APIs
export async function adminGetAllPosts(): Promise<CommunityPostSummaryResponse[]> {
  return apiFetch<CommunityPostSummaryResponse[]>("/community/admin/posts");
}

export async function adminGetPostById(id: string): Promise<CommunityPostDetailResponse> {
  return apiFetch<CommunityPostDetailResponse>(`/community/admin/posts/${encodeURIComponent(id)}`);
}

export async function adminCreateCommunityPost(
  request: CommunityPostCreateRequest
): Promise<CommunityPostDetailResponse> {
  return apiFetch<CommunityPostDetailResponse>("/community/admin/posts", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function adminUpdateCommunityPost(
  id: string,
  request: CommunityPostUpdateRequest
): Promise<CommunityPostDetailResponse> {
  return apiFetch<CommunityPostDetailResponse>(`/community/admin/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function adminDeleteCommunityPost(id: string): Promise<void> {
  return apiFetch<void>(`/community/admin/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// Upload image for community posts
export async function uploadCommunityPostImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${base}/community/admin/posts/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to upload image");
  }

  const data = await response.json();
  return data.imageUrl || data.url || "";
}
