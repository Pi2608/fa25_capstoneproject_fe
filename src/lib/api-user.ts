/**
 * User Profile, Notifications, Usage/Quota API
 */

import { getJson, postJson, apiFetch } from "./api-core";

// ===== USER PROFILE =====
export interface UpdateUserPersonalInfoRequest {
  fullName: string;
  phone: string;
}

export interface UpdateUserPersonalInfoResponse {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  updatedAt: string;
}

export async function updateMyPersonalInfo(
  data: UpdateUserPersonalInfoRequest
): Promise<UpdateUserPersonalInfoResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/user/me/personal-info`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to update personal info");
  }

  return res.json();
}

// ===== USAGE / QUOTA =====
export type UsageResourceType =
  | "Maps"
  | "Layers"
  | "Members"
  | "StorageBytes"
  | string;

export interface CheckQuotaRequest {
  resourceType: UsageResourceType;
  requestedAmount: number;
}

export interface CheckQuotaResponse {
  isAllowed: boolean;
  resourceType?: UsageResourceType;
  requestedAmount?: number;
  remaining?: number;
  limit?: number | null;
  message?: string;
}

export interface UserUsageResponse {
  userId?: string;
  orgId?: string;
  period?: string | null;
  lastReset?: string | null;

  mapsUsed?: number;
  mapsLimit?: number | null;
  layersUsed?: number;
  layersLimit?: number | null;
  membersUsed?: number;
  membersLimit?: number | null;
  storageUsedBytes?: number;
  storageLimitBytes?: number | null;

  [k: string]: unknown;
}

export interface UsageQuotaDto {
  resourceType: string;
  currentUsage: number;
  limit: number;
  percentageUsed: number;
  isUnlimited: boolean;
  isExceeded: boolean;
}

export interface OrganizationUsageResponse {
  organizationId: string;
  organizationName: string;
  membershipId: string;
  planName: string;
  quotas: UsageQuotaDto[];
  totalMembers: number;
  lastResetDate: string;
  nextResetDate: string;
}

export function getUserUsage(orgId: string) {
  return getJson<UserUsageResponse>(`/usage/user/${encodeURIComponent(orgId)}`);
}

export function getOrganizationUsage(orgId: string) {
  return getJson<OrganizationUsageResponse>(`/usage/organization/${encodeURIComponent(orgId)}`);
}

export interface OrganizationMapsUsageResponse {
  organizationId: string;
  organizationName: string;
  totalMaps: number;
  totalViews: number;
  maps: {
    id: string;
    name: string;
    description: string;
    views: number;
    isPublic: boolean;
    status: string;
    isStoryMap: boolean;
    createdAt: string;
    updatedAt: string;
    ownerId: string;
    ownerName: string;
    workspaceName: string;
  }[];
}

export interface PlanLimitsResponse {
  planName: string;
  priceMonthly: number;
  organizationMax?: number | null;
  locationMax?: number | null;
  viewsMonthly?: number | null;
  mapsMax?: number | null;
  membersMax?: number | null;
  mapQuota?: number | null;
  exportQuota?: number | null;
  maxLayer?: number | null;
  tokenMonthly?: number | null;
  mediaFileMax?: number | null;
  videoFileMax?: number | null;
  audioFileMax?: number | null;
}

export function getOrganizationMapsUsage(orgId: string) {
  return getJson<OrganizationMapsUsageResponse>(`/usage/organization/${encodeURIComponent(orgId)}/maps`);
}

export function getPlanLimits(planId: number) {
  return getJson<PlanLimitsResponse>(`/usage/plans/${planId}/limits`);
}

export function checkUserQuota(orgId: string, req: CheckQuotaRequest) {
  return postJson<CheckQuotaRequest, CheckQuotaResponse>(
    `/usage/user/${encodeURIComponent(orgId)}/check-quota`,
    req
  );
}

export function consumeUserQuota(
  orgId: string,
  req: CheckQuotaRequest
) {
  return postJson<CheckQuotaRequest, { success: true; message?: string }>(
    `/usage/user/${encodeURIComponent(orgId)}/consume`,
    req
  );
}

// ===== NOTIFICATIONS =====
export type NotificationType =
  | "Info"
  | "Warning"
  | "Success"
  | "Error"
  | string;

export interface NotificationItem {
  notificationId: number;
  title?: string;
  message?: string;
  type?: NotificationType;
  isRead?: boolean;
  createdAt?: string;
  linkUrl?: string | null;
  orgId?: string | null;
  metadata?: string | null;
}

export interface GetUserNotificationsResponse {
  notifications: NotificationItem[];
  page: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
  unreadCount?: number;
}

export interface MarkNotificationReadResponse {
  ok?: boolean;
  notificationId?: number;
  message?: string;
}

export interface MarkAllNotificationsReadResponse {
  ok?: boolean;
  affected?: number;
  message?: string;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function unwrapNotificationsEnvelope(res: unknown): GetUserNotificationsResponse {
  const base: GetUserNotificationsResponse = {
    notifications: [],
    page: 1,
    pageSize: 20,
    totalItems: undefined,
    totalPages: undefined,
  };

  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    const list =
      (Array.isArray(o.notifications) ? (o.notifications as unknown[]) :
        Array.isArray(o.items) ? (o.items as unknown[]) :
          Array.isArray(o.data) ? (o.data as unknown[]) : []) as unknown[];

    const mapped: NotificationItem[] = list.map((x) => {
      const it = (x ?? {}) as Record<string, unknown>;
      const id =
        asNumber(it.notificationId) ??
        asNumber(it.id) ??
        0;
      return {
        notificationId: id ?? 0,
        title: typeof it.title === "string" ? it.title : undefined,
        message: typeof it.message === "string" ? it.message : undefined,
        type: typeof it.type === "string" ? it.type : undefined,
        isRead: typeof it.isRead === "boolean" ? it.isRead : undefined,
        createdAt: typeof it.createdAt === "string" ? it.createdAt : undefined,
        linkUrl: typeof it.linkUrl === "string" ? it.linkUrl : null,
        orgId: typeof it.orgId === "string" ? it.orgId : null,
        metadata: typeof it.metadata === "string" ? it.metadata : null,
      };
    });

    const page = asNumber(o.page) ?? 1;
    const pageSize = asNumber(o.pageSize) ?? 20;
    // Backend returns totalCount (camelCase from TotalCount)
    const totalItems = asNumber(o.totalCount) ?? asNumber(o.totalItems) ?? asNumber(o.total);
    const totalPages = asNumber(o.totalPages);
    const unreadCount = asNumber(o.unreadCount);

    return {
      notifications: mapped,
      page,
      pageSize,
      totalItems: totalItems ?? undefined,
      totalPages: totalPages ?? undefined,
      unreadCount: unreadCount ?? undefined,
    };
  }

  return base;
}

export async function getUserNotifications(page = 1, pageSize = 20): Promise<GetUserNotificationsResponse> {
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }).toString();
  const res = await getJson<unknown>(`/notifications?${q}`);
  return unwrapNotificationsEnvelope(res);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await getJson<unknown>(`/notifications/unread-count`);
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    const n = o.unreadCount;
    if (typeof n === "number" && Number.isFinite(n)) return n;
    if (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))) return Number(n);
  }
  return 0;
}

export function markNotificationAsRead(notificationId: number) {
  return apiFetch<MarkNotificationReadResponse>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PUT",
  });
}

export function markAllNotificationsAsRead() {
  return apiFetch<MarkAllNotificationsReadResponse>(`/notifications/mark-all-read`, {
    method: "PUT",
  });
}
