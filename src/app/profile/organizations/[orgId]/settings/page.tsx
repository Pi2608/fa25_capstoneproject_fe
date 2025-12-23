"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

import { useI18n } from "@/i18n/I18nProvider";
import { getMe, type Me } from "@/lib/api-auth";
import {
  getOrganizationMembers,
  type GetOrganizationMembersResDto,
  type MemberDto,
  getOrganizationSubscription,
  type OrganizationSubscriptionDto,
  getOrganizationUsage,
  type OrganizationUsageDto,
  getOrganizationBilling,
  type OrganizationBillingDto,
  checkOrganizationQuota,
  type CheckQuotaRequest,
  type CheckQuotaResponse,
} from "@/lib/api-organizations";

/**
 * Calculate total spent from recent transactions
 * Only counts transactions with status "success" or "paid"
 *
 * @param transactions - Array of recent transaction items
 * @returns Total amount in the transaction's currency
 */
function calculateSuccessfulTransactionsTotal(
  transactions: OrganizationBillingDto["recentTransactions"] | undefined
): number {
  if (!transactions || transactions.length === 0) {
    return 0;
  }

  return transactions
    .filter(t => {
      const status = (t.status ?? "").toLowerCase();
      return status === "success" || status === "paid";
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
}

export default function OrgSettingsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const isDark = (resolvedTheme ?? theme ?? "light") === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] =
    useState<GetOrganizationMembersResDto | null>(null);
  const [sub, setSub] = useState<OrganizationSubscriptionDto | null>(null);
  const [usage, setUsage] = useState<OrganizationUsageDto | null>(null);
  const [billing, setBilling] = useState<OrganizationBillingDto | null>(null);
  const [loading, setLoading] = useState(false);

  const [resourceType, setResourceType] = useState<string>("maps");
  const [requestedAmount, setRequestedAmount] = useState<number>(1);
  const [quotaResult, setQuotaResult] = useState<CheckQuotaResponse | null>(
    null
  );
  const [checkingQuota, setCheckingQuota] = useState(false);

  const [pageError, setPageError] = useState<string>("");
  const [quotaError, setQuotaError] = useState<string>("");

  const isOwner = useMemo(() => {
    if (!me || !members) return false;
    const myEmail = (me.email ?? "").toLowerCase();
    const row = members.members.find(
      (m: MemberDto) => m.email.toLowerCase() === myEmail
    );
    return (row?.role ?? "").toLowerCase() === "owner";
  }, [me, members]);

  const planName = useMemo(() => {
    if (sub?.primaryPlanName) return sub.primaryPlanName;
    if (sub?.activeMemberships?.[0]?.planName) return sub.activeMemberships[0].planName;
    return "—";
  }, [sub]);

  const loadAll = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setPageError("");
    try {
      const [meData, memData, subData, usageData, billingData] =
        await Promise.all([
          getMe(),
          getOrganizationMembers(orgId),
          getOrganizationSubscription(orgId),
          getOrganizationUsage(orgId),
          getOrganizationBilling(orgId),
        ]);
      setMe(meData);
      setMembers(memData);
      setSub(subData);
      setUsage(usageData);
      setBilling(billingData);
    } catch {
      setPageError(t("orgSettings.errors_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [orgId, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onCheckQuota = useCallback(async () => {
    if (!orgId || !isOwner) return;
    setCheckingQuota(true);
    setQuotaResult(null);
    setQuotaError("");
    try {
      const body: CheckQuotaRequest = {
        resourceType,
        requestedAmount: Number(requestedAmount) || 0,
      };
      const result = await checkOrganizationQuota(orgId, body);
      setQuotaResult(result);
      if (!result.isAllowed && result.message) {
        setQuotaError(result.message);
      }
    } catch {
      setQuotaError(t("orgSettings.errors_check_quota_failed"));
    } finally {
      setCheckingQuota(false);
    }
  }, [orgId, isOwner, resourceType, requestedAmount, t]);

  // Helper to get quota by resource type
  const getQuota = (type: string) => {
    return usage?.aggregatedQuotas?.find(q => q.resourceType === type);
  };

  const mapsQuota = getQuota("maps");
  const usersQuota = getQuota("users");
  const exportsQuota = getQuota("exports");
  const tokensQuota = getQuota("tokens");

  return (
    <div className="mx-auto max-w-7xl px-6 pt-3 pb-8 md:pt-5">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("orgSettings.page_title")}</h1>
      </div>

      <div className="p-6 -mt-1">
        <div className="flex items-start justify-between isolate mb-4">
          <div>

            {!isOwner && (
              <div className="mt-3 inline-block rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 tracking-tight text-xs px-3 py-1">
                {t("orgSettings.owner_only_badge")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/organizations/${orgId}`}
              className={`px-3 py-2 rounded-lg text-sm shadow-sm ${themeClasses.buttonOutline}`}
            >
              {t("orgSettings.back_button")}
            </Link>
            <button
              onClick={() => void loadAll()}
              disabled={loading || !isOwner}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm shadow hover:bg-emerald-500 disabled:opacity-60"
              title={
                isOwner
                  ? t("orgSettings.refresh_tooltip_owner")
                  : t("orgSettings.refresh_tooltip_non_owner")
              }
            >
              {loading
                ? t("orgSettings.refreshing")
                : t("orgSettings.refresh")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 tracking-tight mt-6">
          <div className={`lg:col-span-2 h-full hover:shadow-md transition-shadow rounded-2xl border p-6 ${themeClasses.kpiCard}`}>
            <div className="pb-3">
              <div className="text-lg font-semibold tracking-tight">
                {t("orgSettings.subscription_section_title")}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-emerald-700 tracking-tight">
                  {planName}
                </div>
                <div className="text-xs text-zinc-600 tracking-tight mt-1">
                  {t("orgSettings.subscription_active")}{" "}
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {sub?.hasActiveSubscription
                      ? t("orgSettings.yes")
                      : t("orgSettings.no")}
                  </span>
                </div>
                <div className="text-xs text-zinc-600 tracking-tight">
                  {t("orgSettings.subscription_period")}{" "}
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {sub?.activeMemberships?.[0]?.billingCycleStartDate
                      ? new Date(
                        sub.activeMemberships[0].billingCycleStartDate
                      ).toLocaleDateString()
                      : "—"}
                  </span>{" "}
                  –{" "}
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {sub?.activeMemberships?.[0]?.billingCycleEndDate
                      ? new Date(
                        sub.activeMemberships[0].billingCycleEndDate
                      ).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                 {t("orgSettings.monthly_cost_label")}:{" "}
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {sub?.totalMonthlyCost?.toLocaleString() ?? 0} {billing?.recentTransactions?.[0]?.currency || "VND"}
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-emerald-100 text-emerald-800 text-xs px-3 py-1 tracking-tight/15 tracking-tight">
                {sub?.organizationName ?? ""}
              </div>
            </div>
          </div>

          <div className={`h-full hover:shadow-md transition-shadow rounded-2xl border p-6 ${themeClasses.kpiCard}`}>
            <div className="pb-3">
              <div className="text-lg font-semibold tracking-tight">
                {t("orgSettings.usage_section_title")}
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs text-zinc-600 tracking-tight mb-1">
                  <span>{t("orgSettings.usage_maps_label")}</span>
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {mapsQuota?.currentUsage ?? 0}/{mapsQuota?.limit ?? 0}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 tracking-tight rounded-full h-2">
                  <div
                    className="bg-emerald-600 tracking-tight h-2 rounded-full transition-all"
                    style={{ width: `${((mapsQuota?.currentUsage ?? 0) / (mapsQuota?.limit ?? 1)) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-zinc-600 tracking-tight mb-1">
                  <span>{t("orgSettings.usage_members_label")}</span>
                  <span className={`${usersQuota?.isExceeded ? "text-red-500" : "text-zinc-900 dark:text-zinc-400 tracking-tight"}`}>
                    {usersQuota?.currentUsage ?? 0}/{usersQuota?.limit ?? 0}
                    {usersQuota?.isExceeded && " ⚠️"}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 tracking-tight rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${usersQuota?.isExceeded ? "bg-red-500" : "bg-emerald-600 tracking-tight"}`}
                    style={{ width: `${((usersQuota?.currentUsage ?? 0) / (usersQuota?.limit ?? 1)) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-zinc-600 tracking-tight mb-1">
                  <span>Exports</span>
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {exportsQuota?.currentUsage ?? 0}/{exportsQuota?.limit ?? 0}
                  </span>
                </div>
                <div className="w-full bg-zinc-200 tracking-tight rounded-full h-2">
                  <div
                    className="bg-emerald-600 tracking-tight h-2 rounded-full transition-all"
                    style={{ width: `${((exportsQuota?.currentUsage ?? 0) / (exportsQuota?.limit ?? 1)) * 100}%` }}
                  />
                </div>
              </div>
              {/* <div>
                <div className="flex justify-between text-xs text-zinc-600 tracking-tight mb-1">
                  <span>Tokens</span>
                  <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                    {tokensQuota?.currentUsage ?? 0}/{tokensQuota?.limit ?? 0}
                  </span>
                </div>
                <div value={tokensQuota?.currentUsage ?? 0} max={tokensQuota?.limit ?? 0} />
              </div> */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          <div className={`h-full hover:shadow-md transition-shadow rounded-2xl border p-6 ${themeClasses.kpiCard}`}>
            <div className="pb-3">
              <div className="text-lg font-semibold tracking-tight">
                {t("orgSettings.billing_section_title")}
              </div>
            </div>
            <div className="space-y-3 text-sm">
              {/* HIDDEN: Invoices count - Not relevant for users
              <div className="flex items-center justify-between">
                <span className="text-zinc-600  tracking-tight">
                  {t("orgSettings.billing_invoices_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                  {billing?.recentInvoices?.length ?? 0}
                </span>
              </div>
              */}
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 tracking-tight">
                  {t("orgSettings.billing_transactions_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                  {billing?.recentTransactions?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 tracking-tight">
                  {t("orgSettings.billing_total_spent_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                  {billing?.recentTransactions
                    ? calculateSuccessfulTransactionsTotal(billing.recentTransactions).toLocaleString()
                    : 0}{" "}
                  {billing?.recentTransactions?.[0]?.currency || "VND"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 tracking-tight">
                  {t("orgSettings.billing_payment_method_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                  {billing?.paymentMethod ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 tracking-tight">
                  {t("orgSettings.billing_next_billing_date_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-400 tracking-tight">
                  {billing?.nextBillingDate
                    ? new Date(billing.nextBillingDate).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className={`h-full hover:shadow-md transition-shadow rounded-2xl border p-6 ${themeClasses.kpiCard}`}>
            <div className="pb-3">
              <div className="text-lg font-semibold tracking-tight">
                {t("orgSettings.notes_section_title")}
              </div>
            </div>
            <ul className="text-sm text-zinc-800 tracking-tight dark:text-zinc-400 list-disc pl-5 space-y-2">
              <li>{t("orgSettings.notes_item_1")}</li>
              <li>{t("orgSettings.notes_item_2")}</li>
              <li>{t("orgSettings.notes_item_3")}</li>
            </ul>
          </div>
        </div>

        {/* HIDDEN: Quota Checker Section - Not needed for regular users
        <div className={`mt-6 hover:shadow-md transition-shadow rounded-2xl border p-6 ${themeClasses.kpiCard}`}>
          <div className="pb-3">
            <div className="text-lg font-semibold tracking-tight">
              {t("orgSettings.quota_section_title")}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600 tracking-tight">
                  {t("orgSettings.quota_resource_label")}
                </label>
                <select
                  className="rounded-lg bg-white ring-1 ring-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm tracking-tight"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  disabled={!isOwner}
                >
                  <option value="maps">
                    {t("orgSettings.quota_resources_maps")}
                  </option>
                  <option value="members">
                    {t("orgSettings.quota_resources_members")}
                  </option>
                  <option value="storageMB">
                    {t("orgSettings.quota_resources_storage_mb")}
                  </option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600 tracking-tight">
                  {t("orgSettings.quota_requested_amount_label")}
                </label>
                <input
                  type="number"
                  min={0}
                  className="rounded-lg bg-white ring-1 ring-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm  tracking-tight"
                  value={requestedAmount}
                  onChange={(e) =>
                    setRequestedAmount(Number(e.target.value))
                  }
                  disabled={!isOwner}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => void onCheckQuota()}
                  disabled={!isOwner || checkingQuota}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-sm shadow hover:bg-emerald-500 disabled:opacity-60"
                >
                  {checkingQuota
                    ? t("orgSettings.quota_checking")
                    : t("orgSettings.quota_check_button")}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {quotaResult && (
                <div
                  className={`rounded-lg ring-1 px-3 py-2 text-sm ${quotaResult.isAllowed
                    ? "ring-emerald-200 bg-emerald-50 text-emerald-800 dark:ring-emerald-400/30 tracking-tight/10 tracking-tight"
                    : "ring-amber-200 bg-amber-50 text-amber-800  tracking-tight"
                    }`}
                >
                  <div className="font-semibold">
                    {quotaResult.isAllowed
                      ? t("orgSettings.quota_ok_title")
                      : t("orgSettings.quota_exceeded_title")}
                  </div>
                  {!quotaResult.isAllowed && quotaResult.message && (
                    <div>{quotaResult.message}</div>
                  )}
                  <div>
                    {t("orgSettings.quota_remaining_label")}{" "}
                    {quotaResult.remainingQuota}
                  </div>
                </div>
              )}
            </div>
        </div>
        */}

        {/* Members Section */}
        <div className="mt-6">
          <div className="pb-3">
            <div className="text-2xl font-semibold tracking-tight">
                {t("orgSettings.org_members_section_title")}
            </div>
            <div className="text-sm text-gray-900 tracking-tight">Tổng số: {members?.members?.length ?? 0} thành viên</div>
          </div>

          {members?.members && members.members.length > 0 ? (
            <div className={`overflow-hidden rounded-2xl border ${themeClasses.tableBorder}`}>
              <table className={`w-full text-sm ${isDark ? "bg-zinc-950" : "bg-white"}`}>
                <thead className={themeClasses.tableHeader}>
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Thành viên</th>
                    <th className="px-5 py-3 text-left font-semibold">Email</th>
                    <th className="px-5 py-3 text-left font-semibold">Vai trò</th>
                    <th className="px-5 py-3 text-left font-semibold">Ngày tham gia</th>
                    <th className="px-5 py-3 text-left font-semibold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${themeClasses.tableBorder}`}>
                  {members.members.map((member) => (
                    <tr
                      key={member.memberId}
                      className={`border-b ${themeClasses.tableCell} ${isDark ? "hover:bg-zinc-900" : "hover:bg-gray-50"}`}
                    >
                      <td className={`px-5 py-3 font-medium ${themeClasses.text}`}>
                        {member.fullName || "—"}
                      </td>
                      <td className={`px-5 py-3 ${themeClasses.textMuted}`}>{member.email}</td>
                      <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${member.role === "Owner"
                          ? "bg-purple-100 text-purple-800 "
                          : member.role === "Admin"
                            ? "bg-blue-100 text-blue-800 "
                            : member.role === "Viewer"
                              ? "bg-gray-100 text-gray-800 "
                              : "bg-emerald-100 text-emerald-800 tracking-tight"
                        }`}>
                        {member.role === "Owner" ? "Chủ sở hữu"
                          : member.role === "Admin" ? "Quản trị viên"
                            : member.role === "Viewer" ? "Người xem"
                              : "Thành viên"}
                      </span>
                      </td>
                      <td className={`px-5 py-3 ${themeClasses.textMuted}`}>
                        {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${member.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300"
                          : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                        }`}>
                        {member.isActive ? "Hoạt động" : "Không hoạt động"}
                      </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`text-sm ${themeClasses.textMuted}`}>Chưa có thành viên nào</div>
          )}
        </div>
      </div>
    </div>
  );
}
