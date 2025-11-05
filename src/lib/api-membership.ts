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
  startDate?: string | null
  endDate?: string | null
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

export async function createOrRenewMembership(payload: { planId: number }) {
  const body = { plan_id: payload.planId };

  try {
    return await postJson<typeof body, MembershipResponse>(
      "/membership/create-or-renew",
      body
    );
  } catch (err) {
    if (!isApiError(err)) throw err;

    if (mentionsMissingBody(err.message)) {
      const url = `/membership/create-or-renew?planId=${encodeURIComponent(payload.planId)}`;
      return await apiFetch<MembershipResponse>(url, { method: "POST" });
    }

    throw err;
  }
}

// ===== PAYMENT =====
export type PaymentGateway = "vnPay" | "payOS" | "stripe" | "payPal";
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

export interface PaymentHistoryItem {
  transactionId: string;
  amount: number;
  status: string;
  purpose: string;
  transactionDate: string;
  createdAt: string;
  transactionReference?: string;
  paymentGateway?: {
    gatewayId: string;
    name: string;
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
