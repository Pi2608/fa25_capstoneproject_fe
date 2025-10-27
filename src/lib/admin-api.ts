// src/lib/admin-api.ts
import { getJson, postJson, putJson, delJson, apiFetch } from "./api";

/* ==================== COMMON ==================== */

export interface PageParams {
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * LƯU Ý VỀ BASE URL:
 * - NEXT_PUBLIC_API_BASE_URL của bạn đã là: http://localhost:5233/api/v1
 * - Do đó ở đây chỉ cần "/api/admin" (tránh bị /api/v1/api/v1/...).
 */
const ADMIN_BASE = "/api/admin";

/* ==================== USERS ==================== */

export interface GetUsersFilter extends PageParams {
  search?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

type AdminUsersResponse<TUser> = {
  users: TUser[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function adminGetUsers<TUser = unknown>(
  p: GetUsersFilter = {}
): Promise<Paged<TUser>> {
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.append(k, String(v));
  });
  const query = sp.toString() ? `?${sp.toString()}` : "";

  const res = await getJson<AdminUsersResponse<TUser>>(`${ADMIN_BASE}/users${query}`);

  return {
    items: Array.isArray(res.users) ? res.users : [],
    page: Number(res.page ?? 1),
    pageSize: Number(res.pageSize ?? (res.users?.length ?? 0)),
    totalItems: Number(res.totalCount ?? (res.users?.length ?? 0)),
    totalPages: Number(res.totalPages ?? 1),
  };
}

export function adminGetUserById<TUser = unknown>(userId: string) {
  return getJson<TUser>(`${ADMIN_BASE}/users/${userId}`);
}

export type UpdateUserStatusRequest = {
  userId: string;
  status: string;
  reason?: string;
};

export function adminUpdateUserStatus<TRes = unknown>(
  userId: string,
  body: UpdateUserStatusRequest
) {
  return putJson<UpdateUserStatusRequest, TRes>(`${ADMIN_BASE}/users/${userId}/status`, body);
}

export function adminDeleteUser<TRes = { success?: boolean }>(userId: string) {
  return delJson<TRes>(`${ADMIN_BASE}/users/${userId}`);
}

export function adminImpersonateUser<TRes = { token?: string }>(userId: string) {
  return apiFetch<TRes>(`${ADMIN_BASE}/users/${userId}/impersonate`, { method: "POST" });
}

/* ==================== ORGANIZATIONS ==================== */

export interface GetOrgsFilter extends PageParams {
  search?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

type AdminOrgsResponse<TOrg> = {
  organizations: TOrg[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function adminGetOrganizations<TOrg = unknown>(
  p: GetOrgsFilter = {}
): Promise<Paged<TOrg>> {
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.append(k, String(v));
  });
  const query = sp.toString() ? `?${sp.toString()}` : "";

  const res = await getJson<AdminOrgsResponse<TOrg>>(`${ADMIN_BASE}/organizations${query}`);

  return {
    items: Array.isArray(res.organizations) ? res.organizations : [],
    page: Number(res.page ?? 1),
    pageSize: Number(res.pageSize ?? (res.organizations?.length ?? 0)),
    totalItems: Number(res.totalCount ?? (res.organizations?.length ?? 0)),
    totalPages: Number(res.totalPages ?? 1),
  };
}

export function adminGetOrganizationById<TOrg = unknown>(orgId: string) {
  return getJson<TOrg>(`${ADMIN_BASE}/organizations/${orgId}`);
}

export function adminUpdateOrganizationStatus<TReq extends object, TRes = unknown>(
  orgId: string,
  body: TReq
) {
  return putJson<TReq, TRes>(`${ADMIN_BASE}/organizations/${orgId}/status`, body);
}

export function adminDeleteOrganization<TRes = { success?: boolean }>(orgId: string) {
  return delJson<TRes>(`${ADMIN_BASE}/organizations/${orgId}`);
}

export interface TransferOwnershipRequestDto {
  newOwnerId: string;
}

export function adminTransferOrganizationOwnership<TRes = unknown>(
  orgId: string,
  body: TransferOwnershipRequestDto
) {
  return postJson<TransferOwnershipRequestDto, TRes>(
    `${ADMIN_BASE}/organizations/${orgId}/transfer-ownership`,
    body
  );
}

/* ==================== ORG ADMIN (for owners) ==================== */

const ORG_ADMIN_BASE = "/organization-admin";

export function orgAdminGetUsage<TRes = unknown>(orgId: string) {
  return getJson<TRes>(`${ORG_ADMIN_BASE}/usage/${orgId}`);
}
export function orgAdminGetSubscription<TRes = unknown>(orgId: string) {
  return getJson<TRes>(`${ORG_ADMIN_BASE}/subscription/${orgId}`);
}
export function orgAdminGetBilling<TRes = unknown>(orgId: string) {
  return getJson<TRes>(`${ORG_ADMIN_BASE}/billing/${orgId}`);
}
export interface CheckQuotaRequestDto {
  resourceType: string;
  requestedAmount: number;
}
export function orgAdminCheckQuota<TRes = unknown>(orgId: string, body: CheckQuotaRequestDto) {
  return postJson<CheckQuotaRequestDto, TRes>(`${ORG_ADMIN_BASE}/usage/${orgId}/check-quota`, body);
}

/* ==================== SUBSCRIPTION PLANS ==================== */

export type CreateSubscriptionPlanRequest = {
  name: string;
  description?: string | null;
  priceMonthly: number;
  priceYearly: number;
  mapsLimit: number;
  exportsLimit: number;
  customLayersLimit: number;
  monthlyTokenLimit: number;
  isPopular: boolean;
  isActive: boolean;
};

export function adminGetSubscriptionPlans<TPlan = unknown>() {
  return getJson<TPlan[]>(`${ADMIN_BASE}/subscription-plans`);
}
export function adminGetSubscriptionPlanById<TPlan = unknown>(planId: number) {
  return getJson<TPlan>(`${ADMIN_BASE}/subscription-plans/${planId}`);
}
export function adminCreateSubscriptionPlan<TRes = unknown>(body: CreateSubscriptionPlanRequest) {
  return postJson<CreateSubscriptionPlanRequest, TRes>(`${ADMIN_BASE}/subscription-plans`, body);
}
export function adminUpdateSubscriptionPlan<TReq extends object, TRes = unknown>(
  planId: number,
  body: TReq
) {
  return putJson<TReq, TRes>(`${ADMIN_BASE}/subscription-plans/${planId}`, body);
}
export function adminDeleteSubscriptionPlan<TRes = { success?: boolean }>(planId: number) {
  return delJson<TRes>(`${ADMIN_BASE}/subscription-plans/${planId}`);
}
export function adminActivateSubscriptionPlan<TRes = { success?: boolean }>(planId: number) {
  return apiFetch<TRes>(`${ADMIN_BASE}/subscription-plans/${planId}/activate`, { method: "POST" });
}
export function adminDeactivateSubscriptionPlan<TRes = { success?: boolean }>(planId: number) {
  return apiFetch<TRes>(`${ADMIN_BASE}/subscription-plans/${planId}/deactivate`, { method: "POST" });
}

/* ==================== SUPPORT TICKETS ==================== */

export interface GetTicketsFilter extends PageParams {
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

export function adminGetSupportTickets<TTicket = unknown>(p: GetTicketsFilter = {}) {
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.append(k, String(v));
  });
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return getJson<Paged<TTicket>>(`${ADMIN_BASE}/support-tickets${query}`);
}

export function adminGetSupportTicketById<TTicket = unknown>(ticketId: string) {
  return getJson<TTicket>(`${ADMIN_BASE}/support-tickets/${ticketId}`);
}

export function adminUpdateSupportTicket<TReq extends object, TRes = unknown>(
  ticketId: string,
  body: TReq
) {
  return putJson<TReq, TRes>(`${ADMIN_BASE}/support-tickets/${ticketId}`, body);
}

export interface CloseTicketRequestDto {
  resolution: string;
}
export function adminCloseSupportTicket<TRes = unknown>(
  ticketId: string,
  body: CloseTicketRequestDto
) {
  return postJson<CloseTicketRequestDto, TRes>(`${ADMIN_BASE}/support-tickets/${ticketId}/close`, body);
}

export interface AssignTicketRequestDto {
  assignedToUserId: string;
}
export function adminAssignSupportTicket<TRes = unknown>(
  ticketId: string,
  body: AssignTicketRequestDto
) {
  return postJson<AssignTicketRequestDto, TRes>(`${ADMIN_BASE}/support-tickets/${ticketId}/assign`, body);
}

export interface EscalateTicketRequestDto {
  reason: string;
}
export function adminEscalateSupportTicket<TRes = unknown>(
  ticketId: string,
  body: EscalateTicketRequestDto
) {
  return postJson<EscalateTicketRequestDto, TRes>(`${ADMIN_BASE}/support-tickets/${ticketId}/escalate`, body);
}

/* ==================== USAGE & DASHBOARD (DÙNG CHO /dashboard) ==================== */

/** Tổng quan hệ thống: phục vụ 4 thẻ KPI trên dashboard */
export function adminGetSystemDashboard<TRes = unknown>() {
  return getJson<TRes>(`${ADMIN_BASE}/dashboard`);
}

/** Hoạt động gần đây: danh sách activity, dùng cho panel bên phải */
export function adminGetRecentActivities<TActivity = unknown>(p: PageParams = {}) {
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    sp.append(k, String(v));
  });
  const query = sp.toString() ? `?${sp.toString()}` : "";
  return getJson<Paged<TActivity>>(`${ADMIN_BASE}/activities${query}`);
}

/** Top users: dữ liệu cho bảng "Top accounts" */
export function adminGetTopUsers<TItem = unknown>(count = 10) {
  const q = new URLSearchParams({ count: String(count) }).toString();
  return getJson<TItem[]>(`${ADMIN_BASE}/top-users?${q}`);
}

/* ==================== ANALYTICS (nếu cần biểu đồ/extra) ==================== */

export function adminGetSystemAnalytics<TRes = unknown>(startDate: Date, endDate: Date) {
  const q = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }).toString();
  return getJson<TRes>(`${ADMIN_BASE}/analytics?${q}`);
}

export function adminGetTopOrganizations<TItem = unknown>(count = 10) {
  const q = new URLSearchParams({ count: String(count) }).toString();
  return getJson<TItem[]>(`${ADMIN_BASE}/top-organizations?${q}`);
}

export function adminGetRevenueAnalytics<TRes = unknown>(startDate: Date, endDate: Date) {
  const q = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  }).toString();
  return getJson<TRes>(`${ADMIN_BASE}/revenue-analytics?${q}`);
}

/* ==================== MAINTENANCE ==================== */

export interface MaintenanceRequestDto {
  maintenanceType: string;
}
export function adminPerformMaintenance<TRes = unknown>(body: MaintenanceRequestDto) {
  return postJson<MaintenanceRequestDto, TRes>(`${ADMIN_BASE}/maintenance`, body);
}
export function adminClearCache<TRes = { success?: boolean }>() {
  return apiFetch<TRes>(`${ADMIN_BASE}/cache/clear`, { method: "POST" });
}
export function adminBackup<TRes = unknown>() {
  return apiFetch<TRes>(`${ADMIN_BASE}/backup`, { method: "POST" });
}
export interface RestoreRequestDto {
  backupId: string;
}
export function adminRestore<TRes = unknown>(body: RestoreRequestDto) {
  return postJson<RestoreRequestDto, TRes>(`${ADMIN_BASE}/restore`, body);
}

/* ==================== CONFIGURATION ==================== */

export function adminGetConfiguration<TConf = Record<string, unknown>>() {
  return getJson<TConf>(`${ADMIN_BASE}/configuration`);
}
export function adminUpdateConfiguration<TRes = unknown>(configuration: Record<string, unknown>) {
  return putJson<Record<string, unknown>, TRes>(`${ADMIN_BASE}/configuration`, configuration);
}
export function adminResetConfiguration<TRes = { success?: boolean }>() {
  return apiFetch<TRes>(`${ADMIN_BASE}/configuration/reset`, { method: "POST" });
}

export function adminGetSystemUsage<TRes = unknown>() {
  return getJson<TRes>(`${ADMIN_BASE}/system-usage`);
}
