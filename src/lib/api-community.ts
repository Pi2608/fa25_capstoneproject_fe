import { getJson, postJson, putJson, delJson } from "./api-core";

export type CommunityPostSummaryResponse = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  topic?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  isPublished?: boolean;
};

export type CommunityPostDetailResponse = CommunityPostSummaryResponse & {
  contentHtml: string;
  isPublished: boolean;
};

export type CommunityPostAdminCreateRequest = {
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  topic?: string | null;
  publishedAt?: string | null;
  isPublished: boolean;
};

export type CommunityPostAdminUpdateRequest = Partial<CommunityPostAdminCreateRequest>;

export async function getCommunityPosts(
  topic?: string,
): Promise<CommunityPostSummaryResponse[]> {
  let url = "/community/posts";
  if (topic && topic.trim().length > 0) {
    url += `?topic=${encodeURIComponent(topic)}`;
  }
  return getJson<CommunityPostSummaryResponse[]>(url);
}

export async function getCommunityPostBySlug(
  slug: string,
): Promise<CommunityPostDetailResponse> {
  const url = `/community/posts/${encodeURIComponent(slug)}`;
  return getJson<CommunityPostDetailResponse>(url);
}

export async function adminGetCommunityPosts(): Promise<
  CommunityPostSummaryResponse[]
> {
  return getJson<CommunityPostSummaryResponse[]>("/community/admin/posts");
}

export async function adminGetCommunityPostById(
  id: string,
): Promise<CommunityPostDetailResponse> {
  const url = `/community/admin/posts/${encodeURIComponent(id)}`;
  return getJson<CommunityPostDetailResponse>(url);
}

export async function adminCreateCommunityPost(
  payload: CommunityPostAdminCreateRequest,
): Promise<CommunityPostDetailResponse> {
  return postJson<CommunityPostAdminCreateRequest, CommunityPostDetailResponse>(
    "/community/admin/posts",
    payload,
  );
}

export async function adminUpdateCommunityPost(
  id: string,
  payload: CommunityPostAdminUpdateRequest,
): Promise<CommunityPostDetailResponse> {
  const url = `/community/admin/posts/${encodeURIComponent(id)}`;
  return putJson<CommunityPostAdminUpdateRequest, CommunityPostDetailResponse>(
    url,
    payload,
  );
}

export async function adminDeleteCommunityPost(id: string): Promise<void> {
  const url = `/community/admin/posts/${encodeURIComponent(id)}`;
  await delJson<void>(url);
}
