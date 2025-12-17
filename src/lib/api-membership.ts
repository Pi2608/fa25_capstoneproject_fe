/**
 * Membership & Payment API (Plans, Subscriptions, Transactions)
 */

import { getJson, postJson, apiFetch, ApiErrorShape } from "./api-core";

// ===== PLANS =====
export type Plan = {
  planId: number;
  planName: string;
  description?: string | null;
  priceMonthly?: number | null;
  durationMonths: number;
  maxOrganizations: number;
  maxLocationsPerOrg: number;
  maxMapsPerMonth: number;
  maxUsersPerOrg: number;
  mapQuota: number;
  exportQuota: number;
  maxCustomLayers: number;
  monthlyTokens: number;
  prioritySupport: boolean;
  features?: string | null; // JSON string
  // Interactive Points Feature Limits
  maxInteractionsPerMap: number;
  maxMediaFileSizeBytes: number;
  maxVideoFileSizeBytes: number;
  maxAudioFileSizeBytes: number;
  maxConnectionsPerMap: number;
  allow3DEffects: boolean;
  allowVideoContent: boolean;
  allowAudioContent: boolean;
  allowAnimatedConnections: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string | null;
};

export type PlanSummary = {
  planId: number;
  planName: string;
  description?: string | null;
  priceMonthly?: number | null;
  features: string[];
};

export function getPlans() {
  return getJson<Plan[]>("/membership-plan/active");
}

export function getPlanById(planId: number) {
  return getJson<Plan>(`/membership-plan/${planId}`);
}

// Helper function to parse features JSON
export function parsePlanFeatures(plan: Plan): string[] {
  if (!plan.features) return [];
  try {
    const parsed = JSON.parse(plan.features);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Helper function to get plan summary for display
export function getPlanSummary(plan: Plan): PlanSummary {
  return {
    planId: plan.planId,
    planName: plan.planName,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    features: parsePlanFeatures(plan),
  };
}

// ===== MEMBERSHIP =====
export type CurrentMembershipDto = {
  membershipId: string
  userId: string
  orgId: string
  orgName: string
  planId: number
  planName: string
  billingCycleStartDate: string
  billingCycleEndDate: string
  status: string
  autoRenew?: boolean
  lastResetDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type GetCurrentMembershipResponse = { membership: CurrentMembershipDto }

export async function getMyMembership(orgId: string): Promise<CurrentMembershipDto | null> {
  const res = await getJson<GetCurrentMembershipResponse | CurrentMembershipDto>(
    `/user/me/membership/${orgId}`
  );
  if (res && typeof res === "object" && "membership" in res) {
    return (res as GetCurrentMembershipResponse).membership;
  }
  return res as CurrentMembershipDto;
}

export interface CurrentMembership {
  membershipId: string
  userId: string
  orgId: string
  orgName: string
  planId: number
  planName: string
  startDate: string
  endDate: string
  status: string
  autoRenew: boolean
}

export async function getMyOrgMembership(orgId: string) {
  return getJson<{ membership: CurrentMembership }>(`/user/me/membership/${orgId}`)
}

export type MyMembership = {
  planId: number;
  status: "active" | "expired" | "pending" | string;
};

export function getMyMembershipStatus() {
  return getJson<MyMembership>("/membership/me");
}

export type MembershipResponse = {
  membershipId: string;
  status: "active" | "expired" | "pending" | string;
};

export type RawAccessTool = {
  accessToolId?: number | string;
  accessToolName?: string;
  accessToolDescription?: string;
  iconUrl?: string;
  requiredMembership?: boolean;
};

function isApiError(x: unknown): x is ApiErrorShape {
  return Boolean(
    x &&
    typeof x === "object" &&
    "status" in x &&
    "message" in x &&
    typeof (x as { status: unknown }).status === "number" &&
    typeof (x as { message: unknown }).message === "string"
  );
}

function mentionsMissingBody(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("implicit body inferred") || m.includes("no body was provided");
}

export function createOrRenewMembership(payload: {
  membershipId?: string;
  userId?: string;
  orgId?: string;
  planId?: number;
  autoRenew?: boolean;
}) {
  const body: Record<string, unknown> = {};

  if (payload.membershipId) body.MembershipId = payload.membershipId;
  if (payload.userId) body.UserId = payload.userId;
  if (payload.orgId) body.OrgId = payload.orgId;
  if (typeof payload.planId === "number") body.PlanId = payload.planId;
  if (typeof payload.autoRenew === "boolean") body.AutoRenew = payload.autoRenew;

  return postJson<typeof body, MembershipResponse>("/membership/create-or-renew", body)
    .catch(async (err) => {
      if (!isApiError(err)) throw err;

      if (mentionsMissingBody(err.message)) {
        const qs = new URLSearchParams();
        if (payload.membershipId) qs.set("membershipId", payload.membershipId);
        if (payload.userId) qs.set("userId", payload.userId);
        if (payload.orgId) qs.set("orgId", payload.orgId);
        if (typeof payload.planId === "number") qs.set("planId", String(payload.planId));
        if (typeof payload.autoRenew === "boolean") qs.set("autoRenew", String(payload.autoRenew));

        return apiFetch<MembershipResponse>(`/membership/create-or-renew?${qs.toString()}`, { method: "POST" });
      }

      throw err;
    });
}


// ===== PAYMENT =====
export type PaymentGateway = "vnPay" | "payOS" | "payPal";
export type PaymentPurpose = "membership" | "addon" | "upgrade";

export interface SubscribeRequest {
  userId: string;
  orgId: string;
  planId: number;
  paymentMethod: PaymentGateway;
  autoRenew: boolean;
}

export interface SubscribeResponse {
  transactionId: string;
  paymentUrl: string;
  status: string;
  message: string;
  paymentGateway: PaymentGateway;
  qrCode?: string;
  orderCode?: string;
}

export function subscribeToPlan(body: SubscribeRequest) {
  return postJson<SubscribeRequest, SubscribeResponse>(
    "/payment/subscribe",
    body
  );
}

export interface UpgradeRequest {
  userId: string;
  orgId: string;
  newPlanId: number;
  paymentMethod: PaymentGateway;
  autoRenew: boolean;
}

export interface UpgradeResponse {
  transactionId: string;
  paymentUrl: string;
  status: string;
  message: string;
  proRatedAmount?: number;
  unusedCredit: number;
  proratedNewPlanCost: number;
  daysRemaining: number;
  paymentGateway: PaymentGateway;
  qrCode?: string;
  orderCode?: string;
}

export function upgradePlan(body: UpgradeRequest) {
  return postJson<UpgradeRequest, UpgradeResponse>(
    "/payment/upgrade",
    body
  );
}

export interface PaymentConfirmationRequest {
  paymentGateway: PaymentGateway;
  purpose: string;
  transactionId: string;
  status: "success" | "failed" | "cancelled";
  paymentId: string;
  orderCode?: string;
}

export interface PaymentConfirmationResponse {
  transactionId: string;
  status: string;
  message: string;
  membershipUpdated: boolean;
  notificationSent: boolean;
}

export function confirmPayment(body: PaymentConfirmationRequest) {
  return postJson<PaymentConfirmationRequest, PaymentConfirmationResponse>(
    "/payment/confirm",
    body
  );
}

export interface CancelPaymentRequest {
  paymentGateway: PaymentGateway;
  paymentId: string;
  orderCode: string;
  transactionId: string;
}

export interface CancelPaymentResponse {
  status: string;
  gatewayName: string;
}

export function cancelPayment(body: CancelPaymentRequest) {
  return postJson<CancelPaymentRequest, CancelPaymentResponse>(
    "/payment/cancel",
    body
  );
}

export interface RetryPaymentRequest {
  transactionId: string;
}

export interface RetryPaymentResponse {
  transactionId: string;
  paymentUrl: string;
  status: string;
  message?: string;
}

export function retryPayment(body: RetryPaymentRequest) {
  return postJson<RetryPaymentRequest, RetryPaymentResponse>(
    "/payment/retry",
    body
  );
}

export interface PaymentHistoryItem {
  transactionId: string;
  amount: number;
  status: string;
  purpose: string;
  description?: string; // Human-readable description
  transactionDate: string;
  createdAt: string;
  transactionReference?: string;
  canRetry?: boolean;
  paymentGateway?: {
    gatewayId: string;
    name: string;
  };
  plannedPlan?: {
    planId: number;
    planName: string;
    description?: string;
    priceMonthly?: number;
    durationMonths?: number;
    maxLocationsPerOrg?: number;
    maxMapsPerMonth?: number;
    mapQuota?: number;
    exportQuota?: number;
    maxUsersPerOrg?: number;
    maxCustomLayers?: number;
    monthlyTokens?: number;
    prioritySupport?: boolean;
    features?: string; // JSON string
    maxInteractionsPerMap?: number;
    maxMediaFileSizeBytes?: number;
    maxVideoFileSizeBytes?: number;
    maxAudioFileSizeBytes?: number;
    maxConnectionsPerMap?: number;
    allow3DEffects?: boolean;
    allowVideoContent?: boolean;
    allowAudioContent?: boolean;
    allowAnimatedConnections?: boolean;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string | null;
  };
  pendingPayment?: {
    paymentUrl?: string;
    lastUpdatedAt?: string;
  };
  membership?: {
    membershipId: string;
    startDate: string;
    endDate?: string;
    status: string;
    autoRenew: boolean;
    plan?: {
      planId: number;
      planName: string;
      description: string;
      priceMonthly: number;
      durationMonths: number;
    };
    organization?: {
      orgId: string;
      orgName: string;
      abbreviation: string;
    };
  };
}

export interface PaymentHistoryResponse {
  payments: PaymentHistoryItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export function getPaymentHistory(page = 1, pageSize = 20) {
  return getJson<PaymentHistoryResponse>(`/payment/history?page=${page}&pageSize=${pageSize}`);
}

// Pending payment types
export interface PendingTransactionDto {
  transactionId: string;
  planId: number;
  planName: string;
  amount: number;
  currency: string;
  createdAt: string;
  paymentUrl?: string;
  expiresAt?: string;
  expiresInMinutes: number;
  description: string;
}

export interface PendingPaymentCheckResponse {
  hasPending: boolean;
  transaction?: PendingTransactionDto;
}

export interface CancelPaymentRequest {
  reason: string;
  notes?: string;
}

export interface CancelPaymentResponse {
  success: boolean;
  transactionId: string;
  newStatus: string;
  cancellationReason: string;
  message: string;
}

// Check for pending payment for organization
export function checkPendingPaymentForOrg(orgId: string) {
  return getJson<PendingPaymentCheckResponse>(`/payment/pending-for-org/${orgId}`);
}

// Cancel payment with reason
export function cancelPaymentWithReason(transactionId: string, request: CancelPaymentRequest) {
  return postJson<CancelPaymentRequest, CancelPaymentResponse>(
    `/payment/cancel/${transactionId}`,
    request
  );
}
