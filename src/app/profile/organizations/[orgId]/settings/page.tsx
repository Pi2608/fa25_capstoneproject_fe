"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
      <div
        className="h-full bg-emerald-600 dark:bg-emerald-300"
        style={{ width: `${pct}%` }}
        aria-valuenow={value}
        aria-valuemax={max}
        role="progressbar"
      />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white ring-1 ring-zinc-200 shadow-md p-6 dark:bg-zinc-900/60 dark:ring-white/10">
      {children}
    </section>
  );
}

function InlineAlert({
  kind,
  text,
}: {
  kind: "error" | "warning" | "success";
  text: string;
}) {
  const map =
    kind === "error"
      ? "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/30"
      : kind === "warning"
      ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30"
      : "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/30";
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ring-1 ${map}`}>{text}</div>
  );
}

export default function OrgSettingsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { t } = useI18n();

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
    if (sub?.activeMembership?.planName) return sub.activeMembership.planName;
    if (sub?.pendingMembership?.planName) return sub.pendingMembership.planName;
    const ex = sub?.expiredMemberships?.[0]?.planName;
    return ex ?? "—";
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

  const mapsUsed = usage?.currentUsage?.mapsCount ?? 0;
  const mapsLimit = usage?.quotas?.mapsMax ?? 0;
  const membersUsed = usage?.currentUsage?.membersCount ?? 0;
  const membersLimit = usage?.quotas?.membersMax ?? 0;
  const storageUsed = usage?.currentUsage?.storageUsedMB ?? 0;
  const storageLimit = usage?.quotas?.storageMaxMB ?? 0;

  return (
    <div className="px-4 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between isolate">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {t("orgSettings.page_title")}
            </h1>

            {!isOwner && (
              <div className="mt-3 inline-block rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-xs px-3 py-1">
                {t("orgSettings.owner_only_badge")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/organizations/${orgId}`}
              className="px-3 py-2 rounded-lg ring-1 ring-zinc-200 bg-white text-sm text-zinc-800 shadow-sm hover:bg-zinc-50 dark:bg-transparent dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-white/5"
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

        {pageError && <InlineAlert kind="error" text={pageError} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <div className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-400">
              {t("orgSettings.subscription_section_title")}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {planName}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                  {t("orgSettings.subscription_active")}{" "}
                  <span className="text-zinc-900 dark:text-zinc-300">
                    {sub?.activeMembership?.isActive
                      ? t("orgSettings.yes")
                      : t("orgSettings.no")}
                  </span>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.subscription_period")}{" "}
                  <span className="text-zinc-900 dark:text-zinc-300">
                    {sub?.activeMembership?.startDate
                      ? new Date(
                          sub.activeMembership.startDate
                        ).toLocaleDateString()
                      : "—"}
                  </span>{" "}
                  –{" "}
                  <span className="text-zinc-900 dark:text-zinc-300">
                    {sub?.activeMembership?.endDate
                      ? new Date(
                          sub.activeMembership.endDate
                        ).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="rounded-full bg-emerald-100 text-emerald-800 text-xs px-3 py-1 dark:bg-emerald-500/15 dark:text-emerald-300">
                {sub?.orgName ?? ""}
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-400">
              {t("orgSettings.usage_section_title")}
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>{t("orgSettings.usage_maps_label")}</span>
                  <span className="text-zinc-900 dark:text-zinc-300">
                    {mapsUsed}/{mapsLimit}
                  </span>
                </div>
                <Meter value={mapsUsed} max={mapsLimit} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>{t("orgSettings.usage_members_label")}</span>
                  <span className="text-zinc-900 dark:text-zinc-300">
                    {membersUsed}/{membersLimit}
                  </span>
                </div>
                <Meter value={membersUsed} max={membersLimit} />
              </div>
              <div>
                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>{t("orgSettings.usage_storage_label")}</span>
                  <span className="text-zinc-900 dark:text-zinc-300">
                    {storageUsed}/{storageLimit}
                  </span>
                </div>
                <Meter value={storageUsed} max={storageLimit} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-400">
              {t("orgSettings.billing_section_title")}
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.billing_invoices_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-200">
                  {billing?.invoices?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.billing_transactions_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-200">
                  {billing?.recentTransactions?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.billing_total_spent_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-200">
                  {billing?.spendingSummary?.totalSpent ?? 0}{" "}
                  {billing?.spendingSummary?.currency ?? ""}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.billing_period_label")}
                </span>
                <span className="text-zinc-900 dark:text-zinc-200">
                  {billing?.spendingSummary?.periodStart
                    ? new Date(
                        billing.spendingSummary.periodStart
                      ).toLocaleDateString()
                    : "—"}{" "}
                  –{" "}
                  {billing?.spendingSummary?.periodEnd
                    ? new Date(
                        billing.spendingSummary.periodEnd
                      ).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <div className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-400">
              {t("orgSettings.quota_section_title")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.quota_resource_label")}
                </label>
                <select
                  className="rounded-lg bg-white ring-1 ring-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm dark:bg-zinc-800 dark:ring-white/10 dark:text-zinc-100"
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
                <label className="text-xs text-zinc-600 dark:text-zinc-400">
                  {t("orgSettings.quota_requested_amount_label")}
                </label>
                <input
                  type="number"
                  min={0}
                  className="rounded-lg bg-white ring-1 ring-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm dark:bg-zinc-800 dark:ring-white/10 dark:text-zinc-100"
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
              {quotaError && (
                <InlineAlert kind="warning" text={quotaError} />
              )}
              {quotaResult && (
                <div
                  className={`rounded-lg ring-1 px-3 py-2 text-sm ${
                    quotaResult.isAllowed
                      ? "ring-emerald-200 bg-emerald-50 text-emerald-800 dark:ring-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "ring-amber-200 bg-amber-50 text-amber-800 dark:ring-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200"
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
                    {quotaResult.remaining}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-4 text-sm font-medium text-zinc-700 dark:text-zinc-400">
              {t("orgSettings.notes_section_title")}
            </div>
            <ul className="text-sm text-zinc-800 dark:text-zinc-300 list-disc pl-5 space-y-2">
              <li>{t("orgSettings.notes_item_1")}</li>
              <li>{t("orgSettings.notes_item_2")}</li>
              <li>{t("orgSettings.notes_item_3")}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
