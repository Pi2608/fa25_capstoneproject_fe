"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, formatDateTime, formatNumber } from "@/utils/formatUtils";
import { getMyOrganizations, type GetMyOrganizationsResDto } from "@/lib/api-organizations";
import { getMyOrgMembership } from "@/lib/api-membership";
import { getOrganizationUsage, getOrganizationMapsUsage, getPlanLimits, checkUserQuota, type OrganizationUsageResponse, type OrganizationMapsUsageResponse, type PlanLimitsResponse, type CheckQuotaRequest } from "@/lib/api-user";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

type UsageLimits = {
  viewsMonthly?: number | null;
  membersMax?: number | null;
  editorsMax?: number | null;
  mapsMax?: number | null;
  storageMax?: number | null;
  organizationMax?: number | null;
  locationMax?: number | null;
  mapQuota?: number | null;
  exportQuota?: number | null;
  maxLayer?: number | null;
  tokenMonthly?: number | null;
  mediaFileMax?: number | null;
  videoFileMax?: number | null;
  audioFileMax?: number | null;
};

type DatasetRow = {
  dataset: string;
  source: string;
  type: string;
  lastUpdated?: string | null;
  maps: number;
  avgSizeMb?: number | null;
  runs?: number | null;
  processing?: boolean | null;
};

type FakeUsage = {
  processingUsedMb: number;
  processingCapMb: number | null;
  hostingUsedMb: number;
  hostingCapMb: number | null;
  processingRows: DatasetRow[];
  hostingRows: DatasetRow[];
};

type MapRow = {
  id: string;
  name: string;
  createdBy?: string | null;
  views: number;
};


const EMPTY_FAKE: FakeUsage = {
  processingUsedMb: 0,
  processingCapMb: 0,
  hostingUsedMb: 0,
  hostingCapMb: 0,
  processingRows: [],
  hostingRows: [],
};

function normalize(s?: string | null) {
  return (s ?? "").trim().toLowerCase();
}
function capText(v?: number | null, unit?: string) {
  if (v == null) return "∞";
  const t = formatNumber(v);
  return unit ? `${t} ${unit}` : t;
}
function percent(used: number, max: number | null | undefined) {
  if (max == null || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}
function firstOfNextMonth(d?: Date) {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = date.getMonth();
  return new Date(y, m + 1, 1);
}
function fmtDate(d: Date) {
  return formatDate(d);
}
function bytesToMB(b: number) {
  return Math.round((b / (1024 * 1024)) * 100) / 100;
}

export default function UsagePage() {
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<GetMyOrganizationsResDto["organizations"]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState<UsageLimits>({});
  const [planLimits, setPlanLimits] = useState<PlanLimitsResponse | null>(null);
  const [orgUsage, setOrgUsage] = useState<OrganizationUsageResponse | null>(null);
  const [mapsUsage, setMapsUsage] = useState<OrganizationMapsUsageResponse | null>(null);
  const [usageBars, setUsageBars] = useState<FakeUsage>(EMPTY_FAKE);

  useEffect(() => {
    let preferred: string | null = null;
    try {
      const url = new URL(window.location.href);
      preferred = url.searchParams.get("orgId");
    } catch {}
    if (!preferred) {
      const saved = localStorage.getItem("cmosm:selectedOrgId");
      if (saved) preferred = saved;
    }
    getMyOrganizations()
      .then((res) => {
        const list = res.organizations ?? [];
        setOrgs(list);
        if (preferred && list.some((o) => o.orgId === preferred)) {
          setOrgId(preferred);
        } else if (list.length) {
          setOrgId(list[0].orgId);
          localStorage.setItem("cmosm:selectedOrgId", list[0].orgId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.allSettled([getMyOrgMembership(orgId), getOrganizationMapsUsage(orgId), getOrganizationUsage(orgId)])
      .then(async ([membershipRes, mapsUsageRes, orgUsageRes]) => {
        let planName = "free";
        let planId: number | null = null;
        let planLimits: UsageLimits = {
          viewsMonthly: undefined,
          mapsMax: undefined,
          membersMax: undefined,
          storageMax: undefined
        };

        if (membershipRes.status === "fulfilled") {
          const nm = normalize(membershipRes.value?.membership?.planName);
          if (nm) planName = nm;
          planId = membershipRes.value?.membership?.planId ?? null;
        }

        let fetchedPlanLimits: PlanLimitsResponse | null = null;
        if (planId !== null) {
          try {
            const planLimitsRes = await getPlanLimits(planId);
            fetchedPlanLimits = planLimitsRes;
            planLimits = {
              viewsMonthly: planLimitsRes.viewsMonthly ?? undefined,
              mapsMax: planLimitsRes.mapsMax ?? undefined,
              membersMax: planLimitsRes.membersMax ?? undefined,
              organizationMax: planLimitsRes.organizationMax ?? undefined,
              locationMax: planLimitsRes.locationMax ?? undefined,
              mapQuota: planLimitsRes.mapQuota ?? undefined,
              exportQuota: planLimitsRes.exportQuota ?? undefined,
              maxLayer: planLimitsRes.maxLayer ?? undefined,
              tokenMonthly: planLimitsRes.tokenMonthly ?? undefined,
              mediaFileMax: planLimitsRes.mediaFileMax ?? undefined,
              videoFileMax: planLimitsRes.videoFileMax ?? undefined,
              audioFileMax: planLimitsRes.audioFileMax ?? undefined,
            };
          } catch (error) {
            console.warn("Failed to fetch plan limits, using defaults:", error);
          }
        }
        setPlanLimits(fetchedPlanLimits);

        if (orgUsageRes.status === "fulfilled" && orgUsageRes.value) {
          const orgUsage = orgUsageRes.value;
          const mapsQuota = orgUsage.quotas.find(q => q.resourceType.toLowerCase().includes('maps'));
          const usersQuota = orgUsage.quotas.find(q => 
            q.resourceType.toLowerCase().includes('users') || 
            q.resourceType.toLowerCase().includes('members')
          );
          const MAX_INT = 2147483647;
          planLimits = {
            ...planLimits,
            mapsMax: planLimits.mapsMax ?? (mapsQuota?.isUnlimited ? null : (mapsQuota?.limit && mapsQuota.limit >= MAX_INT ? null : mapsQuota?.limit) ?? undefined),
            membersMax: planLimits.membersMax ?? (usersQuota?.isUnlimited ? null : (usersQuota?.limit && usersQuota.limit >= MAX_INT ? null : usersQuota?.limit) ?? undefined),
          };
        }

        setLimits(planLimits);

        if (mapsUsageRes.status === "fulfilled") {
          setMapsUsage(mapsUsageRes.value);
        }

        const mapsData: MapRow[] = mapsUsageRes.status === "fulfilled" && mapsUsageRes.value?.maps
          ? mapsUsageRes.value.maps.map(m => ({
              id: m.id,
              name: m.name,
              createdBy: m.ownerName,
              views: m.views
            }))
          : [];
        mapsData.sort((a, b) => b.views - a.views);
        setMaps(mapsData);

        if (orgUsageRes.status === "fulfilled") {
          setOrgUsage(orgUsageRes.value);
          const storageQuota = orgUsageRes.value.quotas.find(q =>
            q.resourceType.toLowerCase().includes('storage') ||
            q.resourceType.toLowerCase().includes('bytes')
          );
          const storageUsedBytes = storageQuota ? storageQuota.currentUsage : 0;

          const hostingUsedMb = bytesToMB(storageUsedBytes);
          const hostingCapMb = planLimits.storageMax;
          setUsageBars({
            processingUsedMb: 0,
            processingCapMb: 0,
            hostingUsedMb,
            hostingCapMb: hostingCapMb || null,
            processingRows: [],
            hostingRows: [],
          });
        } else {
          setOrgUsage(null);
          setMapsUsage(null);
          setUsageBars(EMPTY_FAKE);
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const totalViews = useMemo(() => {
    if (mapsUsage?.totalViews !== undefined) {
      return mapsUsage.totalViews;
    }
    return maps.reduce((s, m) => s + (m.views || 0), 0);
  }, [maps, mapsUsage]);
  const resetDateText = useMemo(() => `${t("usage.resetOn")} ${fmtDate(firstOfNextMonth())}`, [t]);
  const viewsMax = limits.viewsMonthly;

  const getQuotaValue = (resourceType: string, isLimit: boolean = true) => {
    if (!orgUsage) return isLimit ? null : 0;
    const quota = orgUsage.quotas.find(q => q.resourceType.toLowerCase().includes(resourceType.toLowerCase()));
    if (!quota) return isLimit ? null : 0;
    if (isLimit) {
      const MAX_INT = 2147483647;
      if (quota.isUnlimited || (quota.limit && quota.limit >= MAX_INT)) {
        return null;
      }
      return quota.limit;
    } else {
      return quota.currentUsage;
    }
  };

  const mapsLimitFromUsage = limits.mapsMax ?? getQuotaValue('maps', true);
  const mapsUsedFromUsage = getQuotaValue('maps', false) || maps.length;

  const layersLimitFromUsage = limits.maxLayer ?? getQuotaValue('custom_layers', true) ?? getQuotaValue('layers', true);
  const layersUsedFromUsage = getQuotaValue('custom_layers', false) ?? getQuotaValue('layers', false) ?? 0;

  const membersLimitFromUsage = limits.membersMax ?? getQuotaValue('users', true);
  // Prioritize totalMembers as it represents the actual total members in the organization
  const membersUsedFromUsage = orgUsage?.totalMembers ?? getQuotaValue('users', false) ?? 0;

  async function onCheckQuotaClick() {
    if (!orgId) return;
    const payload: CheckQuotaRequest = { resourceType: "Maps", requestedAmount: 1 };
    try {
      const res = await checkUserQuota(orgId, payload);
      if (res.isAllowed) {
        window.alert(t("usage.quota_ok"));
      } else {
        window.alert(res.message ?? t("usage.quota_notEnough"));
      }
    } catch (e) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : t("usage.quota_failed");
      window.alert(msg);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">{t("usage.title")}</h1>

      <div className="mb-1 flex items-center gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">{t("usage.organization")}</label>
        <select
          className={`rounded-md border px-2 py-1 text-sm shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.select} ${isDark ? "dark:hover:bg-zinc-800" : ""}`}
          value={orgId ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setOrgId(v);
            if (v) localStorage.setItem("cmosm:selectedOrgId", v);
            window.dispatchEvent(new CustomEvent("organizationChanged"));
          }}
        >
          {orgs.map((o) => (
            <option key={o.orgId} value={o.orgId}>
              {o.orgName}
            </option>
          ))}
        </select>
      </div>

      {!orgId && (
        <div className={`rounded-lg border p-4 ${themeClasses.panel} ${themeClasses.textMuted}`}>{t("usage.noOrgSelected")}</div>
      )}

      {orgId && (
        <>
          {orgUsage && (
            <section className={`rounded-xl border p-4 ${themeClasses.panel}`}>
              <h2 className={`text-base font-medium mb-3 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("usage.organization_info")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.organization_name")}</div>
                  <div className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-gray-900"}`}>{orgUsage.organizationName}</div>
                </div>
                <div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.current_plan")}</div>
                  <div className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-gray-900"}`}>{orgUsage.planName}</div>
                </div>
                <div>
                  <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.total_members")}</div>
                  <div className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-gray-900"}`}>{orgUsage.totalMembers}</div>
                </div>
              </div>
            </section>
          )}

          <section className={`rounded-xl border p-4 ${themeClasses.panel}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-base font-medium ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("usage.limits_overview")}</h2>
              <button
                onClick={onCheckQuotaClick}
                className={`rounded-md px-3 py-1.5 text-xs ${isDark ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700" : "bg-gray-800 text-gray-200 hover:bg-gray-700"}`}
              >
                {t("usage.limits_checkQuotaPlusOne")}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className={`rounded-lg border p-3 ${themeClasses.tableBorder}`}>
                <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.metrics_maps")}</div>
                <div className={`mt-1 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                  <div className={`h-full ${isDark ? "bg-zinc-500" : "bg-gray-500"}`} style={{ width: `${percent(mapsUsedFromUsage, limits.mapsMax)}%` }} />
                </div>
                <div className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {formatNumber(mapsUsedFromUsage)} / {capText(limits.mapsMax)}
                </div>
              </div>

              <div className={`rounded-lg border p-3 ${themeClasses.tableBorder}`}>
                <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.metrics_layers")}</div>
                <div className={`mt-1 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                  <div className={`h-full ${isDark ? "bg-zinc-500" : "bg-gray-500"}`} style={{ width: `${percent(layersUsedFromUsage, layersLimitFromUsage ?? 0)}%` }} />
                </div>
                <div className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {formatNumber(layersUsedFromUsage)} / {capText(layersLimitFromUsage ?? 0)}
                </div>
              </div>

              <div className={`rounded-lg border p-3 ${themeClasses.tableBorder}`}>
                <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.metrics_members")}</div>
                <div className={`mt-1 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                  <div className={`h-full ${isDark ? "bg-zinc-500" : "bg-gray-500"}`} style={{ width: `${percent(membersUsedFromUsage, limits.membersMax)}%` }} />
                </div>
                <div className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {formatNumber(membersUsedFromUsage)} / {capText(limits.membersMax)}
                </div>
              </div>

              <div className={`rounded-lg border p-3 ${themeClasses.tableBorder}`}>
                <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.metrics_storage")}</div>
                <div className={`mt-1 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                  <div
                    className={`h-full ${isDark ? "bg-zinc-500" : "bg-gray-500"}`}
                    style={{ width: `${percent(usageBars.hostingUsedMb, limits.storageMax)}%` }}
                  />
                </div>
                <div className={`mt-1 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                  {capText(usageBars.hostingUsedMb, "MB")} / {capText(limits.storageMax, "MB")}
                </div>
                {orgUsage?.lastResetDate && (
                  <div className={`mt-1 text-xs ${themeClasses.textMuted}`}>{t("usage.lastReset")}: {formatDateTime(orgUsage.lastResetDate)}</div>
                )}
                {orgUsage?.nextResetDate && (
                  <div className={`text-xs ${themeClasses.textMuted}`}>{t("usage.nextReset")}: {formatDateTime(orgUsage.nextResetDate)}</div>
                )}
              </div>
            </div>
          </section>

          <section className={`rounded-xl border ${themeClasses.panel}`}>
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className={`text-base font-medium ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("usage.processing_title")}</h2>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                {t("usage.actions_upgrade")}
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className={`mt-2 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                <div className={`h-full ${isDark ? "bg-zinc-500" : "bg-gray-500"}`} style={{ width: `${percent(usageBars.processingUsedMb, usageBars.processingCapMb)}%` }} />
              </div>
              <div className={`mt-2 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                {capText(usageBars.processingUsedMb, "MB")} {t("usage.in")} {capText(usageBars.processingCapMb ?? 0, "MB")}
              </div>
            </div>
            <div className={`px-4 pb-4 text-sm ${themeClasses.textMuted}`}>{t("usage.processing_emptyHint")}</div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className={themeClasses.tableHeader}>
                    <th className="py-2 pl-4 pr-4 font-normal">{t("usage.table_dataset")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_source")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_type")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_updated")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_maps")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_avgSize")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_runs")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_processing")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`py-3 pl-4 pr-4 ${themeClasses.textMuted}`} colSpan={8}>
                      {t("usage.table_empty")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={`rounded-xl border ${themeClasses.panel}`}>
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className={`text-base font-medium ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("usage.hosting_title")}</h2>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                {t("usage.actions_upgrade")}
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className={`mt-2 h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                <div className={`h-full ${isDark ? "bg-zinc-500" : "bg-gray-500"}`} style={{ width: `${percent(usageBars.hostingUsedMb, usageBars.hostingCapMb)}%` }} />
              </div>
              <div className={`mt-2 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                {capText(usageBars.hostingUsedMb, "MB")} {t("usage.in")} {capText(usageBars.hostingCapMb ?? 0, "MB")}
              </div>
            </div>
            <div className={`px-4 pb-4 text-sm ${themeClasses.textMuted}`}>{t("usage.hosting_emptyHint")}</div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className={themeClasses.tableHeader}>
                    <th className="py-2 pl-4 pr-4 font-normal">{t("usage.table_dataset")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_source")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_type")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_updated")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_maps")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_uploader")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_storage")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={`py-3 pl-4 pr-4 ${themeClasses.textMuted}`} colSpan={7}>
                      {t("usage.table_empty")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={`rounded-xl border ${themeClasses.panel}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className={`text-base font-medium ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("usage.views_title")}</h2>
              <span className={`text-xs ${themeClasses.textMuted}`}>{resetDateText}</span>
            </div>
            <div className="px-4 pb-2">
              <div className={`h-1 w-full overflow-hidden rounded-full ${isDark ? "bg-zinc-800" : "bg-gray-200"}`}>
                <div className="h-full bg-pink-400" style={{ width: `${percent(totalViews, viewsMax)}%` }} />
              </div>
              <div className={`mt-2 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                <span className={`${isDark ? "text-pink-300" : "text-pink-600"} font-medium`}>{formatNumber(totalViews)}</span> {t("usage.of")}{" "}
                <span className="font-medium">{capText(viewsMax)}</span> {t("usage.perMonth")}
              </div>
              <p className={`mt-1 text-xs ${themeClasses.textMuted}`}>{t("usage.views_hint")}</p>
            </div>
            <div className="mt-2 overflow-x-auto pb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className={themeClasses.tableHeader}>
                    <th className="py-2 pl-4 pr-4 font-normal text-left">{t("usage.table_map")}</th>
                    <th className="py-2 pr-4 font-normal text-left">{t("usage.table_createdBy")}</th>
                    <th className="py-2 pr-4 font-normal text-right">{t("usage.table_views")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td className={`py-3 pl-4 pr-4 ${themeClasses.textMuted}`} colSpan={3}>
                        {t("usage.loading")}
                      </td>
                    </tr>
                  )}
                  {!loading && maps.length === 0 && (
                    <tr>
                      <td className={`py-3 pl-4 pr-4 ${themeClasses.textMuted}`} colSpan={3}>
                        {t("usage.table_empty")}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    maps.map((m) => (
                      <tr key={m.id} className={`border-t ${themeClasses.tableCell}`}>
                        <td className="py-2 pl-4 pr-4">
                          <a className={`${isDark ? "text-blue-300" : "text-blue-600"} hover:underline`} href={`/maps/${m.id}`}>
                            {m.name || t("usage.untitledMap")}
                          </a>
                        </td>
                        <td className={`py-2 pr-4 ${themeClasses.textMuted}`}>{m.createdBy ?? "—"}</td>
                        <td className={`py-2 pr-4 text-right ${isDark ? "text-zinc-200" : "text-gray-900"}`}>{formatNumber(m.views ?? 0)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
