"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../admin.module.css";
import {
  adminGetSystemDashboard,
  adminGetTopUsers,
  adminGetTopOrganizations,
  adminGetRevenueAnalytics,
  adminGetSystemUsage,
} from "@/lib/admin-api";

type Raw = Record<string, unknown>;

type DashboardStats = {
  totalUsers: number;
  totalUsersChangePct: number;
  activeToday: number;
  activeTodayChangePct: number;
  newSignups: number;
  newSignupsChangePct: number;
  errors24h: number;
  errors24hChangePct: number;
};

type TopUserRow = {
  userName: string;
  email: string;
  totalMaps: number;
  totalExports: number;
  totalSpent: number;
  lastActive: string;
};

type TopOrgRow = {
  name: string;
  owner: string;
  members: number;
  created: string;
};

type RevenuePoint = { date: string; value: number };

type UsageItem = { label: string; value: string };

function pickNumber(obj: Raw, keys: string[], d = 0): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return d;
}

function pickString(obj: Raw, keys: string[], d = ""): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return d;
}

function toPct(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(iso: string): string {
  return iso ? iso.replace("T", " ").slice(0, 16) : "";
}

function rangeDates(kind: "7d" | "30d"): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (kind === "7d" ? 7 : 30));
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function normalizeRevenue(list: unknown): RevenuePoint[] {
  const arr = Array.isArray(list) ? (list as Raw[]) : [];
  return arr
    .map((x) => {
      const date = pickString(x, ["date", "day, timestamp", "createdAt", "created_at"]);
      const value = pickNumber(x, ["revenue", "amount", "value", "total", "sum"], 0);
      return { date, value };
    })
    .filter((p) => p.date);
}

function buildSparkPath(points: RevenuePoint[], w = 720, h = 220): { d: string; min: number; max: number } {
  if (!points.length) return { d: "", min: 0, max: 0 };
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const stepX = points.length > 1 ? w / (points.length - 1) : w;
  const toY = (v: number) => {
    const norm = (v - min) / span;
    return h - norm * h;
  };
  let d = "";
  points.forEach((p, i) => {
    const x = Math.round(i * stepX);
    const y = Math.round(toY(p.value));
    d += i === 0 ? `M ${x},${y}` : ` L ${x},${y}`;
  });
  return { d, min, max };
}

function normalizeUsage(obj: Raw): UsageItem[] {
  const items: UsageItem[] = [];
  const maps = pickNumber(obj, ["maps", "totalMaps", "mapCount", "total_maps"]);
  const orgs = pickNumber(obj, ["organizations", "totalOrganizations", "orgCount", "total_organizations"]);
  const exportsN = pickNumber(obj, ["exports", "totalExports", "exportCount", "total_exports"]);
  const storageMB = pickNumber(obj, ["storageMB", "storageUsedMb", "storage_used_mb", "storage"]);
  if (Number.isFinite(maps)) items.push({ label: "Maps", value: maps.toLocaleString() });
  if (Number.isFinite(orgs)) items.push({ label: "Organizations", value: orgs.toLocaleString() });
  if (Number.isFinite(exportsN)) items.push({ label: "Exports", value: exportsN.toLocaleString() });
  if (Number.isFinite(storageMB)) items.push({ label: "Storage (MB)", value: storageMB.toLocaleString() });
  return items;
}

export default function AdminDashboard(): JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUserRow[]>([]);
  const [topOrgs, setTopOrgs] = useState<TopOrgRow[]>([]);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [revRange, setRevRange] = useState<"7d" | "30d">("7d");
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [dashRes, users, orgs, usageRes] = await Promise.all([
          adminGetSystemDashboard<Raw>(),
          adminGetTopUsers<Raw>(8),
          adminGetTopOrganizations<Raw>(8),
          adminGetSystemUsage<Raw>(),
        ]);
        if (!mounted) return;
        const d: DashboardStats = {
          totalUsers: pickNumber(dashRes, ["totalUsers", "TotalUsers", "userCount", "UserCount", "users", "total_users"], 0),
          totalUsersChangePct: pickNumber(dashRes, ["totalUsersChange", "TotalUsersChange", "totalUsersChangePct", "total_users_change_pct"], 0),
          activeToday: pickNumber(dashRes, ["activeToday", "ActiveToday", "activeUsersToday", "active_today"], 0),
          activeTodayChangePct: pickNumber(dashRes, ["activeTodayChange", "ActiveTodayChange", "activeTodayChangePct", "active_today_change_pct"], 0),
          newSignups: pickNumber(dashRes, ["newSignups", "NewSignups", "newUsers", "new_signups"], 0),
          newSignupsChangePct: pickNumber(dashRes, ["newSignupsChange", "NewSignupsChange", "newSignupsChangePct", "new_signups_change_pct"], 0),
          errors24h: pickNumber(dashRes, ["errors24h", "Errors24h", "errorCount24h", "errors_24h"], 0),
          errors24hChangePct: pickNumber(dashRes, ["errors24hChange", "Errors24hChange", "errors24hChangePct", "errors_24h_change_pct"], 0),
        };
        setStats(d);
        const normUsers: TopUserRow[] = (Array.isArray(users) ? users : []).map((u: Raw) => {
          const userName = pickString(u, ["userName", "username", "fullName", "full_name", "name", "displayName"]);
          const email = pickString(u, ["email", "userEmail", "user_email"]);
          const totalMaps = pickNumber(u, ["totalMaps", "maps", "mapCount"], 0);
          const totalExports = pickNumber(u, ["totalExports", "exports", "exportCount"], 0);
          const totalSpent = pickNumber(u, ["totalSpent", "spent", "total_spent"], 0);
          const lastActive = pickString(u, ["lastActive", "last_login", "lastSeen", "last_seen"]);
          return { userName, email, totalMaps, totalExports, totalSpent, lastActive };
        });
        setTopUsers(normUsers);
        const normOrgs: TopOrgRow[] = (Array.isArray(orgs) ? orgs : []).map((o: Raw) => {
          const name = pickString(o, ["name", "orgName", "organizationName"]);
          const owner = pickString(o, ["owner", "ownerName", "ownerEmail"]);
          const members = pickNumber(o, ["members", "memberCount", "users"], 0);
          const created = pickString(o, ["createdAt", "created", "createdDate", "created_at"]);
          return { name: name || "(unnamed)", owner, members, created: created ? created.slice(0, 10) : "" };
        });
        setTopOrgs(normOrgs);
        setUsage(normalizeUsage(usageRes));
      } catch {
        setStats({
          totalUsers: 0,
          totalUsersChangePct: 0,
          activeToday: 0,
          activeTodayChangePct: 0,
          newSignups: 0,
          newSignupsChangePct: 0,
          errors24h: 0,
          errors24hChangePct: 0,
        });
        setTopUsers([]);
        setTopOrgs([]);
        setUsage([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const { start, end } = rangeDates(revRange);
    adminGetRevenueAnalytics<unknown>(start, end)
      .then((res) => {
        if (!mounted) return;
        setRevenue(normalizeRevenue(res));
      })
      .catch(() => {
        if (mounted) setRevenue([]);
      });
    return () => {
      mounted = false;
    };
  }, [revRange]);

  const filteredTopUsers = useMemo(() => {
    if (!search.trim()) return topUsers;
    const q = search.trim().toLowerCase();
    return topUsers.filter(
      (r) =>
        r.userName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
    );
  }, [topUsers, search]);

  const spark = useMemo(() => buildSparkPath(revenue), [revenue]);

  return (
    <div className={s.stack}>
      <section className={s.kpis}>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Total users</span></div>
          <div className={s.kpiNum}>{loading ? "…" : (stats?.totalUsers ?? 0).toLocaleString()}</div>
          <div className={s.kpiTrend}>{loading ? "" : toPct(stats ? stats.totalUsersChangePct : 0)}</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Active today</span></div>
          <div className={s.kpiNum}>{loading ? "…" : (stats?.activeToday ?? 0).toLocaleString()}</div>
          <div className={s.kpiTrend}>{loading ? "" : toPct(stats ? stats.activeTodayChangePct : 0)}</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>New signups</span></div>
          <div className={s.kpiNum}>{loading ? "…" : (stats?.newSignups ?? 0).toLocaleString()}</div>
          <div className={s.kpiTrend}>{loading ? "" : toPct(stats ? stats.newSignupsChangePct : 0)}</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Errors (24h)</span></div>
          <div className={s.kpiNum}>{loading ? "…" : (stats?.errors24h ?? 0).toLocaleString()}</div>
          <div className={s.kpiTrend}>{loading ? "" : toPct(stats ? stats.errors24hChangePct : 0)}</div>
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Revenue analytics</h3>
          <div className={s.filters}>
            <select
              className={s.select}
              value={revRange}
              onChange={(e) => setRevRange(e.target.value as "7d" | "30d")}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
        <div className={s.chartPlaceholder} style={{ height: 240 }}>
          {revenue.length === 0 ? (
            "No data"
          ) : (
            <svg width="100%" height="100%" viewBox="0 0 720 220" preserveAspectRatio="none">
              <path d={spark.d} fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Top accounts</h3>
          <div className={s.filters}>
            <input
              className={s.input}
              placeholder="Search account…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>User</th><th>Email</th><th>Total maps</th><th>Total exports</th><th>Total spent</th><th>Last active</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(filteredTopUsers.length ? filteredTopUsers : Array.from({ length: 8 }).map(() => null)).map((row, i) => (
                <tr key={i}>
                  <td>{row ? row.userName : "…"}</td>
                  <td>{row ? row.email : "…"}</td>
                  <td>{row ? row.totalMaps.toLocaleString() : "…"}</td>
                  <td>{row ? row.totalExports.toLocaleString() : "…"}</td>
                  <td>{row ? formatMoney(row.totalSpent) : "…"}</td>
                  <td>{row ? formatDateTime(row.lastActive) : "…"}</td>
                  <td><button className={s.linkBtn} disabled={!row}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Top organizations</h3>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th><th>Owner</th><th>Members</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(topOrgs.length ? topOrgs : Array.from({ length: 8 }).map(() => null)).map((row, i) => (
                <tr key={i}>
                  <td>{row ? row.name : "…"}</td>
                  <td>{row ? row.owner : "…"}</td>
                  <td>{row ? row.members : "…"}</td>
                  <td>{row ? row.created : "…"}</td>
                  <td><button className={s.linkBtn} disabled={!row}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>System usage</h3>
        </div>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Metric</th><th>Value</th></tr>
            </thead>
            <tbody>
              {(usage.length ? usage : Array.from({ length: 4 }).map(() => null)).map((u, i) => (
                <tr key={i}>
                  <td>{u ? u.label : "…"}</td>
                  <td>{u ? u.value : "…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
