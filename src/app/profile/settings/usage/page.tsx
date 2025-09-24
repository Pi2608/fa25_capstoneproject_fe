"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getOrganizationMaps,
  getMyOrgMembership,
  getPlans,
  getMapById,
  getMyOrganizations,
  type MapDto,
  type Plan,
  type GetMyOrganizationsResDto,
} from "@/lib/api";

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

const FAKE: FakeUsage = {
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
  if (v == null) return "unlimited";
  const t = v.toLocaleString();
  return unit ? `${t} ${unit}` : t;
}
function percent(used: number, max?: number | null) {
  if (max == null || max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}
function firstOfNextMonth(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return new Date(y, m + 1, 1);
}
function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
async function tryGetMapViews(mapId: string): Promise<number> {
  const mod = await import("@/lib/api");
  const apiFetch = (mod as unknown as { apiFetch<T>(p: string, o?: RequestInit & { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" }): Promise<T> }).apiFetch;
  const paths = [
    `/maps/${mapId}/views`,
    `/maps/${mapId}/stats`,
    `/analytics/maps/${mapId}/views`,
    `/analytics/map-views?mapId=${encodeURIComponent(mapId)}`,
  ];
  for (const p of paths) {
    try {
      const res = await apiFetch<unknown>(p, { method: "GET" });
      if (typeof res === "number") return res;
      if (res && typeof res === "object") {
        const obj = res as Record<string, unknown>;
        if (typeof obj.views === "number") return obj.views as number;
        if (typeof obj.viewsMonthly === "number") return obj.viewsMonthly as number;
        if (typeof obj.total === "number") return obj.total as number;
        if (typeof obj.month === "number") return obj.month as number;
      }
    } catch {}
  }
  return 0;
}

export default function Page() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<GetMyOrganizationsResDto["organizations"]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState<string>("free");
  const [limits, setLimits] = useState<UsageLimits>(PLAN_LIMITS.free);
  const [fake, setFake] = useState<FakeUsage>(FAKE);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qid = url.searchParams.get("orgId");
      if (qid) {
        setOrgId(qid);
        localStorage.setItem("cmosm:selectedOrgId", qid);
        return;
      }
    } catch {}
    const saved = localStorage.getItem("cmosm:selectedOrgId");
    if (saved) {
      setOrgId(saved);
      return;
    }
    getMyOrganizations().then((res) => {
      const list = res.organizations ?? [];
      setOrgs(list);
      if (list.length > 0) {
        setOrgId(list[0].orgId);
        localStorage.setItem("cmosm:selectedOrgId", list[0].orgId);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.allSettled([getMyOrgMembership(orgId), getPlans(), getOrganizationMaps(orgId)]).then(async ([membershipRes, plansRes, mapsRes]) => {
      let pName = "free";
      if (membershipRes.status === "fulfilled") {
        const nm = normalize(membershipRes.value?.membership?.planName);
        if (nm) pName = nm;
      }
      setPlanName(pName);
      const base = PLAN_LIMITS[pName] ?? Object.entries(PLAN_LIMITS).find(([k]) => pName.includes(k))?.[1] ?? PLAN_LIMITS.free;
      setLimits(base);
      const list: MapDto[] = mapsRes.status === "fulfilled" ? (mapsRes.value ?? []) : [];
      const rows: MapRow[] = await Promise.all(list.map(async (m) => {
        const [views, detail] = await Promise.allSettled([tryGetMapViews(m.id), getMapById(m.id)]);
        const v = views.status === "fulfilled" ? views.value : 0;
        const d = detail.status === "fulfilled" ? detail.value as unknown : null;
        let createdBy: string | null = null;
        if (d && typeof d === "object") {
          const obj = d as Record<string, unknown>;
          const ownerName = typeof obj.ownerName === "string" ? obj.ownerName : null;
          const ownerEmail = typeof obj.ownerEmail === "string" ? obj.ownerEmail : null;
          const ownerId = typeof obj.ownerId === "string" ? obj.ownerId : null;
          createdBy = ownerName ?? ownerEmail ?? ownerId ?? null;
        } else if (m.ownerId) {
          createdBy = m.ownerId;
        }
        return { id: m.id, name: m.name, createdBy, views: v };
      }));
      rows.sort((a, b) => b.views - a.views);
      setMaps(rows);
      setFake(FAKE);
    }).finally(() => setLoading(false));
  }, [orgId]);

  const totalViews = useMemo(() => maps.reduce((s, m) => s + (m.views || 0), 0), [maps]);
  const resetDateText = useMemo(() => `Resets on ${fmtDate(firstOfNextMonth())}`, []);
  const viewsMax = limits.viewsMonthly;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usage</h1>
        {orgId && (
          <select
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-200"
            value={orgId}
            onChange={(e) => {
              const v = e.target.value;
              setOrgId(v);
              localStorage.setItem("cmosm:selectedOrgId", v);
            }}
          >
            {orgs.map((o) => (
              <option key={o.orgId} value={o.orgId}>{o.orgName}</option>
            ))}
          </select>
        )}
      </div>

      {!orgId && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-neutral-300">
          No organization selected.
        </div>
      )}

      {orgId && (
        <>
          <section className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-base font-medium text-neutral-100">Data processing</h2>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">Upgrade</button>
            </div>
            <div className="px-4 pb-3">
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-neutral-500" style={{ width: `${percent(fake.processingUsedMb, fake.processingCapMb)}%` }} />
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                {capText(fake.processingUsedMb, "MB")} out of {capText(fake.processingCapMb ?? 0, "MB")}
              </div>
            </div>
            <div className="px-4 pb-4 text-sm text-neutral-400">None available. Upgrade to raise your monthly limit.</div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-neutral-800 bg-neutral-900/40 text-left text-neutral-400">
                    <th className="py-2 pl-4 pr-4 font-normal">Dataset</th>
                    <th className="py-2 pr-4 font-normal">Source</th>
                    <th className="py-2 pr-4 font-normal">Type</th>
                    <th className="py-2 pr-4 font-normal">Last updated</th>
                    <th className="py-2 pr-4 font-normal">Maps</th>
                    <th className="py-2 pr-4 font-normal">Avg. Size</th>
                    <th className="py-2 pr-4 font-normal">Runs</th>
                    <th className="py-2 pr-4 font-normal">Processing</th>
                  </tr>
                </thead>
                <tbody>
                  {fake.processingRows.length === 0 ? (
                    <tr>
                      <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={8}>No data</td>
                    </tr>
                  ) : (
                    fake.processingRows.map((r, i) => (
                      <tr key={`${r.dataset}-${i}`} className="border-t border-neutral-800 text-neutral-200">
                        <td className="py-2 pl-4 pr-4">{r.dataset}</td>
                        <td className="py-2 pr-4">{r.source}</td>
                        <td className="py-2 pr-4">{r.type}</td>
                        <td className="py-2 pr-4">{r.lastUpdated ? new Date(r.lastUpdated).toLocaleString() : "—"}</td>
                        <td className="py-2 pr-4">{r.maps}</td>
                        <td className="py-2 pr-4">{r.avgSizeMb != null ? `${r.avgSizeMb} MB` : "—"}</td>
                        <td className="py-2 pr-4">{r.runs ?? "—"}</td>
                        <td className="py-2 pr-4">{r.processing ? "Yes" : "No"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 className="text-base font-medium text-neutral-100">Data hosting</h2>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500">Upgrade</button>
            </div>
            <div className="px-4 pb-3">
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-neutral-500" style={{ width: `${percent(fake.hostingUsedMb, fake.hostingCapMb)}%` }} />
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                {capText(fake.hostingUsedMb, "MB")} out of {capText(fake.hostingCapMb ?? 0, "MB")}
              </div>
            </div>
            <div className="px-4 pb-4 text-sm text-neutral-400">None available. Upgrade to raise your monthly limit.</div>
            <div className="overflow-x-auto pb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-neutral-800 bg-neutral-900/40 text-left text-neutral-400">
                    <th className="py-2 pl-4 pr-4 font-normal">Dataset</th>
                    <th className="py-2 pr-4 font-normal">Source</th>
                    <th className="py-2 pr-4 font-normal">Type</th>
                    <th className="py-2 pr-4 font-normal">Last updated</th>
                    <th className="py-2 pr-4 font-normal">Maps</th>
                    <th className="py-2 pr-4 font-normal">Uploaded by</th>
                    <th className="py-2 pr-4 font-normal">Hosting</th>
                  </tr>
                </thead>
                <tbody>
                  {fake.hostingRows.length === 0 ? (
                    <tr>
                      <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={7}>No data</td>
                    </tr>
                  ) : (
                    fake.hostingRows.map((r, i) => (
                      <tr key={`${r.dataset}-${i}`} className="border-t border-neutral-800 text-neutral-200">
                        <td className="py-2 pl-4 pr-4">{r.dataset}</td>
                        <td className="py-2 pr-4">{r.source}</td>
                        <td className="py-2 pr-4">{r.type}</td>
                        <td className="py-2 pr-4">{r.lastUpdated ? new Date(r.lastUpdated).toLocaleString() : "—"}</td>
                        <td className="py-2 pr-4">{r.maps}</td>
                        <td className="py-2 pr-4">—</td>
                        <td className="py-2 pr-4">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-800 bg-neutral-900">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-base font-medium text-neutral-100">Map views</h2>
              <span className="text-xs text-neutral-400">{resetDateText}</span>
            </div>
            <div className="px-4 pb-2">
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                <div className="h-full bg-pink-400" style={{ width: `${percent(totalViews, viewsMax)}%` }} />
              </div>
              <div className="mt-2 text-sm text-neutral-300">
                <span className="text-pink-300 font-medium">{totalViews.toLocaleString()}</span> out of <span className="font-medium">{capText(viewsMax)}</span> / month
              </div>
              <p className="mt-1 text-xs text-neutral-400">Each time someone loads a map in the browser or an embed it counts as a view.</p>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-neutral-800 bg-neutral-900/40 text-left text-neutral-400">
                    <th className="py-2 pl-4 pr-4 font-normal">Map</th>
                    <th className="py-2 pr-4 font-normal">Created by</th>
                    <th className="py-2 pr-4 font-normal">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={3}>Loading…</td>
                    </tr>
                  )}
                  {!loading && maps.length === 0 && (
                    <tr>
                      <td className="py-3 pl-4 pr-4 text-neutral-300" colSpan={3}>No data</td>
                    </tr>
                  )}
                  {!loading && maps.map((m) => (
                    <tr key={m.id} className="border-t border-neutral-800 text-neutral-200">
                      <td className="py-2 pl-4 pr-4">
                        <a className="text-blue-300 hover:underline" href={`/maps/${m.id}`}>{m.name || "Untitled Map"}</a>
                      </td>
                      <td className="py-2 pr-4">{m.createdBy ?? "—"}</td>
                      <td className="py-2 pr-4">{(m.views ?? 0).toLocaleString()}</td>
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
