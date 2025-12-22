/**
 * Organization Management API (Organizations, Members, Invitations)
 */

import { getJson, postJson, putJson, delJson, apiFetch } from "./api-core";

// ===== ORGANIZATION TYPES =====
export type OrganizationReqDto = {
  orgName: string;
  abbreviation: string;
  description?: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
};

export type OrganizationResDto = {
  result?: string;
  orgId: string;
};

export type OrganizationDetailDto = {
  orgId: string;
  orgName: string;
  abbreviation: string;
  description?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  createdAt?: string;
  isActive?: boolean;
};
export type GetOrganizationNumberResDto = { organizationNumber: number };

export type GetAllOrganizationsResDto = { organizations: OrganizationDetailDto[] };
export type GetOrganizationByIdResDto = { organization: OrganizationDetailDto };
export type UpdateOrganizationResDto = { result?: string };
export type DeleteOrganizationResDto = { result?: string };

export type MyOrganizationDto = {
  orgId: string;
  orgName: string;
  abbreviation: string;
  myRole: "Owner" | "Member" | string;
  joinedAt?: string;
  logoUrl?: string | null;
};
export type GetMyOrganizationsResDto = { organizations: MyOrganizationDto[] };

export type InvitationDto = {
  invitationId: string;
  orgId: string;
  orgName: string;
  email: string;
  inviterEmail: string;
memberType: "Member" | string;
  invitedAt: string;
  isAccepted: boolean;
  acceptedAt?: string | null;
};
export type GetInvitationsResDto = { invitations: InvitationDto[] };

export type MemberDto = {
  memberId: string;
  userId?: string;
  email: string;
  fullName: string;
  role: "Owner" | "Member" | string;
  joinedAt: string;
  isActive: boolean;
};
export type GetOrganizationMembersResDto = { members: MemberDto[] };

export type InviteMemberOrganizationReqDto = {
  orgId: string;
  memberEmail: string;
memberType: "Member" | string;
};
export type InviteMemberOrganizationResDto = { result?: string };

export type AcceptInviteOrganizationReqDto = { invitationId: string };
export type AcceptInviteOrganizationResDto = { result?: string };

export type RejectInviteOrganizationReqDto = { invitationId: string };
export type RejectInviteOrganizationResDto = { result?: string };

export type CancelInviteOrganizationReqDto = { invitationId: string };
export type CancelInviteOrganizationResDto = { result?: string };

export type UpdateMemberRoleReqDto = {
  orgId: string;
  memberId: string;
  newRole: "Owner" | "Member" | string;
};
export type UpdateMemberRoleResDto = { result?: string };

export type RemoveMemberReqDto = { orgId: string; memberId: string };
export type RemoveMemberResDto = { result?: string };

export type TransferOwnershipReqDto = { newOwnerId: string };
export type TransferOwnershipResDto = { result?: string };

// ===== CRUD Organization =====
export function createOrganization(body: OrganizationReqDto) {
  return postJson<OrganizationReqDto, OrganizationResDto>("/organizations", body);
}

export function getOrganizations() {
  return getJson<GetAllOrganizationsResDto>("/organizations");
}

export function getOrganizationNumber() {
  return getJson<GetOrganizationNumberResDto>("/organizations/organization-number");
}

export function getOrganizationById(orgId: string) {
  return getJson<GetOrganizationByIdResDto>(`/organizations/${orgId}`);
}

export function updateOrganization(orgId: string, body: OrganizationReqDto) {
  return putJson<OrganizationReqDto, UpdateOrganizationResDto>(`/organizations/${orgId}`, body);
}

export function deleteOrganization(orgId: string) {
  return delJson<DeleteOrganizationResDto>(`/organizations/${orgId}`);
}

// ===== My Organizations & Invitations =====
export function getMyOrganizations() {
  return getJson<GetMyOrganizationsResDto>("/organizations/my-organizations");
}

export function getMyInvitations() {
  return getJson<GetInvitationsResDto>("/organizations/my-invitations");
}

// ===== Members =====
export function getOrganizationMembers(orgId: string) {
  return getJson<GetOrganizationMembersResDto>(`/organizations/${orgId}/members`);
}

export function updateMemberRole(body: UpdateMemberRoleReqDto) {
  return apiFetch<UpdateMemberRoleResDto>("/organizations/members/role", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export function removeMember(body: RemoveMemberReqDto) {
  return delJson<RemoveMemberResDto>("/organizations/members/remove", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as RequestInit);
}

// ===== Invitations Operations =====
export function inviteMember(body: InviteMemberOrganizationReqDto) {
  return postJson<InviteMemberOrganizationReqDto, InviteMemberOrganizationResDto>(
    "/organizations/invite-member",
    body
  );
}

export function acceptInvite(body: AcceptInviteOrganizationReqDto) {
  return postJson<AcceptInviteOrganizationReqDto, AcceptInviteOrganizationResDto>(
    "/organizations/accept-invite",
    body
  );
}

export function rejectInvite(body: RejectInviteOrganizationReqDto) {
  return postJson<RejectInviteOrganizationReqDto, RejectInviteOrganizationResDto>(
    "/organizations/invites/reject",
    body
  );
}

export function cancelInvite(body: CancelInviteOrganizationReqDto) {
  return postJson<CancelInviteOrganizationReqDto, CancelInviteOrganizationResDto>(
    "/organizations/invites/cancel",
    body
  );
}

// ===== Transfer Ownership =====
export function transferOwnership(orgId: string, newOwnerId: string) {
  return postJson<TransferOwnershipReqDto, TransferOwnershipResDto>(
    `/organizations/${orgId}/ownership`,
    { newOwnerId }
  );
}
// ===== ORGANIZATION ADMIN =====
export type AggregatedQuota = {
  resourceType: string;
  currentUsage: number;
  limit: number;
  isExceeded: boolean;
  remaining: number;
  usagePercentage: number;
};

export type OrganizationUsageDto = {
  orgId: string;
  organizationName: string;
  aggregatedQuotas: AggregatedQuota[];
  userUsageSummaries?: Array<{
    userId: string;
    email: string;
    fullName: string;
    mapsCount: number;
    storageUsedMB: number;
  }>;
  lastResetDate?: string;
  nextResetDate?: string;
  totalActiveUsers: number;
  totalMapsCreated: number;
  totalExportsThisMonth: number;
};

export type MembershipDto = {
  membershipId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: number;
  planName: string;
  status: string;
  billingCycleStartDate: string;
  billingCycleEndDate: string;
  autoRenew: boolean;
  monthlyCost: number;
  createdAt: string;
};

export type OrganizationSubscriptionDto = {
  orgId: string;
  organizationName: string;
  activeMemberships: MembershipDto[];
  pendingMemberships: MembershipDto[];
  expiredMemberships: MembershipDto[];
  nextBillingDate?: string;
  totalMonthlyCost: number;
  primaryPlanName: string;
  hasActiveSubscription: boolean;
};

export type OrganizationBillingDto = {
  orgId: string;
  organizationName: string;
  recentTransactions: Array<{
    transactionId: string;
    amount: number;
    currency: string;
    transactionDate: string;
    description: string;
    status: string;
  }>;
  recentInvoices: Array<{
    invoiceId: string;
    amount: number;
    currency: string;
    issueDate: string;
    dueDate: string;
    status: string;
  }>;
  totalSpentThisMonth: number;
  totalSpentLastMonth: number;
  outstandingBalance: number;
  paymentMethod?: string;
  nextBillingDate?: string;
  hasPaymentMethodOnFile: boolean;
};

export type CheckQuotaRequest = {
  resourceType: string;
  requestedAmount: number;
};

export type CheckQuotaResponse = {
  isAllowed: boolean;
  currentUsage: number;
  limit: number;
  remainingQuota: number;
  message?: string;
};

export function getOrganizationUsage(orgId: string) {
  return getJson<OrganizationUsageDto>(`/api/organization-admin/usage/${orgId}`);
}

export function getOrganizationSubscription(orgId: string) {
  return getJson<OrganizationSubscriptionDto>(`/api/organization-admin/subscription/${orgId}`);
}

export function getOrganizationBilling(orgId: string) {
  return getJson<OrganizationBillingDto>(`/api/organization-admin/billing/${orgId}`);
}

export function checkOrganizationQuota(orgId: string, body: CheckQuotaRequest) {
  return postJson<CheckQuotaRequest, CheckQuotaResponse>(
    `/api/organization-admin/usage/${orgId}/check-quota`,
    body
  );
}

export type BulkCreateStudentsRes = {
  totalCreated: number;
  totalSkipped: number;
  createdAccounts: Array<{
    userId: string;
    email: string;
    fullName: string;
    password: string;
    class: string;
  }>;
  skippedAccounts: Array<{
    name: string;
    class: string;
    reason: string;
  }>;
};


export async function bulkCreateStudents(
  organizationId: string,
  excelFile: File,
  domain: string
): Promise<BulkCreateStudentsRes> {
  const form = new FormData();
  form.append("organizationId", organizationId);
  form.append("excelFile", excelFile);
  form.append("domain", domain);

  return apiFetch<BulkCreateStudentsRes>("/organizations/bulk-create-students", {
    method: "POST",
    body: form,
  });
}
