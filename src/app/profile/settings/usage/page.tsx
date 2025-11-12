"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, formatDateTime, formatNumber } from "@/utils/formatUtils";
import { getMyOrganizations, type GetMyOrganizationsResDto } from "@/lib/api-organizations";
import { getMyOrgMembership } from "@/lib/api-membership";
import { getOrganizationMaps, getMapViews, getMapById, type MapDto } from "@/lib/api-maps";
import { getUserUsage, checkUserQuota, type UserUsageResponse, type CheckQuotaRequest } from "@/lib/api-user";
import { useI18n } from "@/i18n/I18nProvider";

type UsageLimits = {
  viewsMonthly?: number | null;
  membersMax?: number | null;
  editorsMax?: number | null;
  mapsMax?: number | null;
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

const PLAN_LIMITS: Record<string, UsageLimits> = {
  free: { viewsMonthly: 5000, membersMax: 25, editorsMax: 3, mapsMax: 10 },
  pro: { viewsMonthly: 50000, membersMax: 100, editorsMax: 20, mapsMax: 100 },
  business: { viewsMonthly: 250000, membersMax: 250, editorsMax: 50, mapsMax: 500 },
  enterprise: { viewsMonthly: null, membersMax: null, editorsMax: null, mapsMax: null },
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
function percent(used: number, max?: number | null) {
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
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<GetMyOrganizationsResDto["organizations"]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState<UsageLimits>(PLAN_LIMITS.free);
  const [userUsage, setUserUsage] = useState<UserUsageResponse | null>(null);
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
    Promise.allSettled([getMyOrgMembership(orgId), getOrganizationMaps(orgId), getUserUsage(orgId)])
      .then(async ([membershipRes, mapsRes, usageRes]) => {
        let planName = "free";
        if (membershipRes.status === "fulfilled") {
          const nm = normalize(membershipRes.value?.membership?.planName);
          if (nm) planName = nm;
        }
        const base =
          PLAN_LIMITS[planName] ??
          Object.entries(PLAN_LIMITS).find(([k]) => planName.includes(k))?.[1] ??
          PLAN_LIMITS.free;
        setLimits(base);

        const list: MapDto[] = mapsRes.status === "fulfilled" ? (mapsRes.value ?? []) : [];
        const rows: MapRow[] = await Promise.all(
          list.map(async (m) => {
            const [views, detail] = await Promise.allSettled([getMapViews(m.id), getMapById(m.id)]);
            const v = views.status === "fulfilled" ? views.value : 0;
            let createdBy: string | null = null;
            if (detail.status === "fulfilled" && detail.value && typeof detail.value === "object") {
              const obj = detail.value as Record<string, unknown>;
              const ownerName = typeof obj.ownerName === "string" ? obj.ownerName : null;
              const ownerEmail = typeof obj.ownerEmail === "string" ? obj.ownerEmail : null;
              const ownerId = typeof obj.ownerId === "string" ? obj.ownerId : null;
              createdBy = ownerName ?? ownerEmail ?? ownerId ?? null;
            } else if ("ownerId" in m && typeof m.ownerId === "string") {
              createdBy = m.ownerId;
            }
            return { id: m.id, name: m.name, createdBy, views: v };
          })
        );
        rows.sort((a, b) => b.views - a.views);
        setMaps(rows);

        if (usageRes.status === "fulfilled") {
          setUserUsage(usageRes.value);
          const storageUsedBytes = Number(usageRes.value.storageUsedBytes ?? 0);
          const rawLimit = usageRes.value.storageLimitBytes;
          const storageLimitBytes =
            typeof rawLimit === "number" ? rawLimit : rawLimit == null ? null : Number(rawLimit);
          const hostingUsedMb = bytesToMB(storageUsedBytes);
          const hostingCapMb = storageLimitBytes == null ? null : bytesToMB(storageLimitBytes);
          setUsageBars({
            processingUsedMb: 0,
            processingCapMb: 0,
            hostingUsedMb,
            hostingCapMb,
            processingRows: [],
            hostingRows: [],
          });
        } else {
          setUserUsage(null);
          setUsageBars(EMPTY_FAKE);
        }
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const totalViews = useMemo(() => maps.reduce((s, m) => s + (m.views || 0), 0), [maps]);
  const resetDateText = useMemo(() => `${t("usage.resetOn")} ${fmtDate(firstOfNextMonth())}`, [t]);
  const viewsMax = limits.viewsMonthly;

  const mapsLimitFromUsage =
    userUsage?.mapsLimit == null ? null : typeof userUsage.mapsLimit === "number" ? userUsage.mapsLimit : Number(userUsage.mapsLimit);
  const mapsUsedFromUsage = typeof userUsage?.mapsUsed === "number" ? userUsage.mapsUsed : maps.length;

  const layersLimitFromUsage =
    userUsage?.layersLimit == null ? null : typeof userUsage.layersLimit === "number" ? userUsage.layersLimit : Number(userUsage.layersLimit);
  const layersUsedFromUsage = typeof userUsage?.layersUsed === "number" ? userUsage.layersUsed : 0;

  const membersLimitFromUsage =
    userUsage?.membersLimit == null ? null : typeof userUsage.membersLimit === "number" ? userUsage.membersLimit : Number(userUsage.membersLimit);
  const membersUsedFromUsage = typeof userUsage?.membersUsed === "number" ? userUsage.membersUsed : 0;

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
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-700 shadow-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          value={orgId ?? ""}
          onChange={(e) => {
            const v = e.target.value || null;
            setOrgId(v);
            if (v) localStorage.setItem("cmosm:selectedOrgId", v);
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
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-neutral-300">{t("usage.noOrgSelected")}</div>
      )}

      {orgId && (
        <>
          <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-neutral-100">{t("usage.limits_overview")}</h2>
              <button
                onClick={onCheckQuotaClick}
                className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
              >
                {t("usage.limits_checkQuotaPlusOne")}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-neutral-800 p-3">
                <div className="text-xs text-neutral-400">{t("usage.metrics_maps")}</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full bg-neutral-500" style={{ width: `${percent(mapsUsedFromUsage, mapsLimitFromUsage)}%` }} />
                </div>
                <div className="mt-1 text-sm text-neutral-300">
                  {formatNumber(mapsUsedFromUsage)} / {capText(mapsLimitFromUsage)}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-800 p-3">
                <div className="text-xs text-neutral-400">{t("usage.metrics_layers")}</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full bg-neutral-500" style={{ width: `${percent(layersUsedFromUsage, layersLimitFromUsage)}%` }} />
                </div>
                <div className="mt-1 text-sm text-neutral-300">
                  {formatNumber(layersUsedFromUsage)} / {capText(layersLimitFromUsage)}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-800 p-3">
                <div className="text-xs text-neutral-400">{t("usage.metrics_members")}</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div className="h-full bg-neutral-500" style={{ width: `${percent(membersUsedFromUsage, membersLimitFromUsage)}%` }} />
                </div>
                <div className="mt-1 text-sm text-neutral-300">
                  {formatNumber(membersUsedFromUsage)} / {capText(membersLimitFromUsage)}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-800 p-3">
                <div className="text-xs text-neutral-400">{t("usage.metrics_storage")}</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className="h-full bg-neutral-500"
                    style={{ width: `${percent(usageBars.hostingUsedMb, usageBars.hostingCapMb == null ? 0 : usageBars.hostingCapMb)}%` }}
                  />
                </div>
                <div className="mt-1 text-sm text-neutral-300">
                  {capText(usageBars.hostingUsedMb, "MB")} / {capText(usageBars.hostingCapMb, "MB")}
                </div>
                {userUsage?.period && <div className="mt-1 text-xs text-neutral-500">{t("usage.period")}: {userUsage.period}</div>}
                {userUsage?.lastReset && (
                  <div className="text-xs text-neutral-500">{t("usage.lastReset")}: {formatDateTime(userUsage.lastReset)}</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-base font-medium text-neutral-100">{t("usage.processing_title")}</h2>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                {t("usage.actions_upgrade")}
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-neutral-500" style={{ width: `${percent(usageBars.processingUsedMb, usageBars.processingCapMb)}%` }} />
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                {capText(usageBars.processingUsedMb, "MB")} {t("usage.in")} {capText(usageBars.processingCapMb ?? 0, "MB")}
              </div>
            </div>
            <div className="px-4 pb-4 text-sm text-neutral-400">{t("usage.processing_emptyHint")}</div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-neutral-800 bg-neutral-900/40 text-left text-neutral-400">
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
                    <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={8}>
                      {t("usage.table_empty")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-base font-medium text-neutral-100">{t("usage.hosting_title")}</h2>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">
                {t("usage.actions_upgrade")}
              </button>
            </div>
            <div className="px-4 pb-3">
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-neutral-500" style={{ width: `${percent(usageBars.hostingUsedMb, usageBars.hostingCapMb)}%` }} />
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                {capText(usageBars.hostingUsedMb, "MB")} {t("usage.in")} {capText(usageBars.hostingCapMb ?? 0, "MB")}
              </div>
            </div>
            <div className="px-4 pb-4 text-sm text-neutral-400">{t("usage.hosting_emptyHint")}</div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-neutral-800 bg-neutral-900/40 text-left text-neutral-400">
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
                    <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={7}>
                      {t("usage.table_empty")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-base font-medium text-neutral-100">{t("usage.views_title")}</h2>
              <span className="text-xs text-neutral-400">{resetDateText}</span>
            </div>
            <div className="px-4 pb-2">
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-pink-400" style={{ width: `${percent(totalViews, viewsMax)}%` }} />
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                <span className="text-pink-300 font-medium">{formatNumber(totalViews)}</span> {t("usage.of")}{" "}
                <span className="font-medium">{capText(viewsMax)}</span> {t("usage.perMonth")}
              </div>
              <p className="mt-1 text-xs text-neutral-400">{t("usage.views_hint")}</p>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-neutral-800 bg-neutral-900/40 text-left text-neutral-400">
                    <th className="py-2 pl-4 pr-4 font-normal">{t("usage.table_map")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_createdBy")}</th>
                    <th className="py-2 pr-4 font-normal">{t("usage.table_views")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={3}>
                        {t("usage.loading")}
                      </td>
                    </tr>
                  )}
                  {!loading && maps.length === 0 && (
                    <tr>
                      <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={3}>
                        {t("usage.table_empty")}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    maps.map((m) => (
                      <tr key={m.id} className="border-t border-neutral-800 text-neutral-200">
                        <td className="py-2 pl-4 pr-4">
                          <a className="text-blue-300 hover:underline" href={`/maps/${m.id}`}>
                            {m.name || t("usage.untitledMap")}
                          </a>
                        </td>
                        <td className="py-2 pr-4">{m.createdBy ?? "—"}</td>
                        <td className="py-2 pr-4">{formatNumber(m.views ?? 0)}</td>
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
