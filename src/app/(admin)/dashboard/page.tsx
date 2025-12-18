"use client";

import { JSX, useEffect, useMemo, useState } from "react";
import {
  adminGetSystemDashboard,
  adminGetTopUsers,
  adminGetTopOrganizations,
  adminGetRevenueAnalytics,
  adminGetSystemUsage,
  adminGetSystemAnalytics,
} from "@/lib/admin-api";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  id: string;
  userName: string;
  email: string;
  totalMaps: number;
  totalExports: number;
  totalSpent: number;
  lastActive: string;
};

type TopOrgRow = {
  id: string;
  name: string;
  owner: string;
  members: number;
  created: string;
};

type RevenuePoint = { date: string; value: number };

type UsageItem = { label: string; value: string };

type MonthlyData = {
  month: string;
  users: number;
  revenue: number;
  maps: number;
  exports: number;
};

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

function getLast12MonthsRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setMonth(end.getMonth() - 11);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function normalizeMonthlyData(data: Raw): MonthlyData[] {
  const monthly: MonthlyData[] = [];
  if (!data || typeof data !== "object") return monthly;

  // Try to extract monthly data from various possible structures
  const monthlyRevenue = (data as any).monthlyRevenue || (data as any).MonthlyRevenue || [];
  const monthlyUsers = (data as any).monthlyUsers || (data as any).MonthlyUsers || [];
  const monthlyMaps = (data as any).monthlyMaps || (data as any).MonthlyMaps || [];
  const monthlyExports = (data as any).monthlyExports || (data as any).MonthlyExports || [];

  // Create a map of months
  const monthMap = new Map<string, MonthlyData>();

  // Process revenue data
  if (Array.isArray(monthlyRevenue)) {
    monthlyRevenue.forEach((item: Raw) => {
      const month = pickString(item, ["month", "Month", "date", "Date", "period"]);
      const value = pickNumber(item, ["value", "Value", "revenue", "Revenue", "amount", "total"]);
      if (month) {
        if (!monthMap.has(month)) {
          monthMap.set(month, { month, users: 0, revenue: 0, maps: 0, exports: 0 });
        }
        monthMap.get(month)!.revenue = value;
      }
    });
  }

  // Process users data
  if (Array.isArray(monthlyUsers)) {
    monthlyUsers.forEach((item: Raw) => {
      const month = pickString(item, ["month", "Month", "date", "Date", "period"]);
      const value = pickNumber(item, ["value", "Value", "users", "Users", "count", "total"]);
      if (month) {
        if (!monthMap.has(month)) {
          monthMap.set(month, { month, users: 0, revenue: 0, maps: 0, exports: 0 });
        }
        monthMap.get(month)!.users = value;
      }
    });
  }

  // Process maps data
  if (Array.isArray(monthlyMaps)) {
    monthlyMaps.forEach((item: Raw) => {
      const month = pickString(item, ["month", "Month", "date", "Date", "period"]);
      const value = pickNumber(item, ["value", "Value", "maps", "Maps", "count", "total"]);
      if (month) {
        if (!monthMap.has(month)) {
          monthMap.set(month, { month, users: 0, revenue: 0, maps: 0, exports: 0 });
        }
        monthMap.get(month)!.maps = value;
      }
    });
  }

  // Process exports data
  if (Array.isArray(monthlyExports)) {
    monthlyExports.forEach((item: Raw) => {
      const month = pickString(item, ["month", "Month", "date", "Date", "period"]);
      const value = pickNumber(item, ["value", "Value", "exports", "Exports", "count", "total"]);
      if (month) {
        if (!monthMap.has(month)) {
          monthMap.set(month, { month, users: 0, revenue: 0, maps: 0, exports: 0 });
        }
        monthMap.get(month)!.exports = value;
      }
    });
  }

  // Convert to array and sort by month
  const result = Array.from(monthMap.values());

  // If no data, generate empty data for last 12 months
  if (result.length === 0) {
    const { start } = getLast12MonthsRange();
    for (let i = 0; i < 12; i++) {
      const date = new Date(start);
      date.setMonth(start.getMonth() + i);
      const monthStr = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      result.push({ month: monthStr, users: 0, revenue: 0, maps: 0, exports: 0 });
    }
  } else {
    // Sort by month
    result.sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });
  }

  return result;
}

function aggregateDailyRevenueToMonthly(points: RevenuePoint[]): MonthlyData[] {
  if (!points || points.length === 0) return [];

  const monthMap = new Map<string, MonthlyData>();

  points.forEach((p) => {
    if (!p.date) return;
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime())) return;
    const month = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const existing = monthMap.get(month) || { month, users: 0, revenue: 0, maps: 0, exports: 0 };
    existing.revenue += Number(p.value ?? 0);
    monthMap.set(month, existing);
  });

  // Sort by date
  const monthly = Array.from(monthMap.values()).sort((a, b) => {
    const da = new Date(a.month);
    const db = new Date(b.month);
    return da.getTime() - db.getTime();
  });

  return monthly;
}

function dateInputValue(d: Date) {
  const z = new Date(d);
  z.setHours(0, 0, 0, 0);
  return z.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthLabel(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function normalizeRevenue(list: unknown): RevenuePoint[] {
  if (!list) return [];
  const arr = Array.isArray(list) ? (list as Raw[]) : [];
  return arr
    .map((x) => {
      const date = pickString(x, ["date", "Date", "day", "timestamp", "createdAt", "created_at"]);
      const value = pickNumber(x, ["value", "Value", "revenue", "amount", "total", "sum"], 0);
      return { date, value: Number(value) };
    })
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
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

function normalizeUsage(obj: Raw, t: (ns: string, key: string) => string): UsageItem[] {
  const items: UsageItem[] = [];
  if (!obj) return items;

  const userStats = (obj as any).userStats || (obj as any).UserStats;
  const orgStats = (obj as any).organizationStats || (obj as any).OrganizationStats;
  const subscriptionStats = (obj as any).subscriptionStats || (obj as any).SubscriptionStats;

  const totalUsers = pickNumber(userStats || obj, ["totalUsers", "TotalUsers", "userCount", "UserCount"]);
  const totalOrgs = pickNumber(orgStats || obj, ["totalOrganizations", "TotalOrganizations", "orgCount", "organizations"]);
  const totalSubscriptions = pickNumber(subscriptionStats || obj, ["totalActiveSubscriptions", "TotalActiveSubscriptions", "activeSubscriptions"]);

  const maps = pickNumber(obj, ["totalMaps", "TotalMaps", "total_maps", "maps", "mapCount"]);
  const exportsN = pickNumber(obj, ["totalExports", "TotalExports", "total_exports", "exports", "exportCount"]);

  if (Number.isFinite(totalUsers) && totalUsers >= 0) items.push({ label: t("admin", "total_users"), value: totalUsers.toLocaleString() });
  if (Number.isFinite(totalOrgs) && totalOrgs >= 0) items.push({ label: t("admin", "organizations"), value: totalOrgs.toLocaleString() });
  if (Number.isFinite(maps) && maps >= 0) items.push({ label: t("admin", "maps"), value: maps.toLocaleString() });
  if (Number.isFinite(exportsN) && exportsN >= 0) items.push({ label: t("admin", "exports"), value: exportsN.toLocaleString() });
  if (Number.isFinite(totalSubscriptions) && totalSubscriptions >= 0) items.push({ label: t("admin", "active_subscriptions"), value: totalSubscriptions.toLocaleString() });

  return items;
}

export default function AdminDashboard(): JSX.Element {
  const router = useRouter();
  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUserRow[]>([]);
  const [topOrgs, setTopOrgs] = useState<TopOrgRow[]>([]);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [revStart, setRevStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return dateInputValue(d);
  });
  const [revEnd, setRevEnd] = useState<string>(() => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    return dateInputValue(tomorrow);
  });
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const now = new Date();
  const defaultMonthlyEnd = dateInputValue(now);
  const tmpStart = new Date(now);
  tmpStart.setMonth(now.getMonth() - 11);
  tmpStart.setDate(1);
  const defaultMonthlyStart = dateInputValue(tmpStart);
  const [monthlyStart, setMonthlyStart] = useState<string>(defaultMonthlyStart);
  const [monthlyEnd, setMonthlyEnd] = useState<string>(defaultMonthlyEnd);
  const [revenueStats, setRevenueStats] = useState<{
    totalRevenue: number;
    totalTransactions: number;
    avgTransaction: number;
  } | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState<boolean>(true);

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
          totalUsersChangePct: pickNumber(dashRes, ["totalUsersChangePct", "TotalUsersChangePct", "totalUsersChange", "TotalUsersChange", "total_users_change_pct"], 0),
          activeToday: pickNumber(dashRes, ["activeToday", "ActiveToday", "activeUsersToday", "active_today"], 0),
          activeTodayChangePct: pickNumber(dashRes, ["activeTodayChangePct", "ActiveTodayChangePct", "activeTodayChange", "ActiveTodayChange", "active_today_change_pct"], 0),
          newSignups: pickNumber(dashRes, ["newSignups", "NewSignups", "newUsers", "new_signups"], 0),
          newSignupsChangePct: pickNumber(dashRes, ["newSignupsChangePct", "NewSignupsChangePct", "newSignupsChange", "NewSignupsChange", "new_signups_change_pct"], 0),
          errors24h: pickNumber(dashRes, ["errors24h", "Errors24h", "errorCount24h", "errors_24h"], 0),
          errors24hChangePct: pickNumber(dashRes, ["errors24hChangePct", "Errors24hChangePct", "errors24hChange", "Errors24hChange", "errors_24h_change_pct"], 0),
        };
        setStats(d);

        const normUsers: TopUserRow[] = (Array.isArray(users) ? users : []).map((u: Raw) => {
          const id = pickString(u, ["id", "Id", "userId", "UserId"]);  // ✅ lấy userId

          const userName = pickString(u, [
            "userName",
            "UserName",
            "username",
            "fullName",
            "FullName",
            "full_name",
            "name",
            "displayName",
          ]);
          const email = pickString(u, ["email", "Email", "userEmail", "user_email"]);
          const totalMaps = pickNumber(u, ["totalMaps", "TotalMaps", "maps", "mapCount"], 0);
          const totalExports = pickNumber(u, ["totalExports", "TotalExports", "exports", "exportCount"], 0);
          const totalSpent = pickNumber(u, ["totalSpent", "TotalSpent", "spent", "total_spent"], 0);
          let lastActive = pickString(u, ["lastActive", "LastActive", "last_login", "lastSeen", "last_seen"]);
          if (!lastActive && u.lastActive) {
            const dt = u.lastActive;
            if (dt instanceof Date) lastActive = dt.toISOString();
            else if (typeof dt === "string") lastActive = dt;
          }

          return { id, userName, email, totalMaps, totalExports, totalSpent, lastActive };
        });

        setTopUsers(normUsers);

        const normOrgs: TopOrgRow[] = (Array.isArray(orgs) ? orgs : []).map((o: Raw) => {
          const id = pickString(o, ["id", "Id", "orgId", "OrgId"]);  // ✅ lấy orgId

          const name = pickString(o, ["name", "Name", "orgName", "OrgName", "organizationName"]);
          const owner = pickString(o, ["ownerName", "OwnerName", "owner", "ownerEmail", "owner_name"]);
          const members = pickNumber(o, ["totalMembers", "TotalMembers", "members", "memberCount", "users"], 0);
          let created = pickString(o, ["createdAt", "CreatedAt", "created", "createdDate", "created_at"]);
          if (!created && o.createdAt) {
            const dt = o.createdAt;
            if (dt instanceof Date) created = dt.toISOString();
            else if (typeof dt === "string") created = dt;
          }
          return {
            id,
            name: name || "(unnamed)",
            owner: owner && owner !== "Unknown" ? owner : "",
            members,
            created: created ? created.slice(0, 10) : "",
          };
        });

        setTopOrgs(normOrgs);

        setUsage(normalizeUsage(usageRes, t));
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
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
    const startDate = new Date(revStart);
    let endDate = new Date(revEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return () => { };
    }

    // Enforce endDate >= startDate and endDate >= today
    const today = dateInputValue(new Date());
    if (endDate < startDate) {
      endDate = addDays(startDate, 1);
      setRevEnd(dateInputValue(endDate));
    }
    const minEnd = new Date(today);
    if (endDate < minEnd) {
      endDate = minEnd;
      setRevEnd(dateInputValue(endDate));
    }
    adminGetRevenueAnalytics<unknown>(startDate, endDate)
      .then((res) => {
        if (!mounted) return;
        const resObj = res as any;
        const dailyRevenue = resObj?.dailyRevenue || resObj?.DailyRevenue || (Array.isArray(resObj) ? resObj : []);
        const normalized = normalizeRevenue(dailyRevenue);
        setRevenue(normalized);

        // Extract summary stats
        if (resObj && typeof resObj === "object") {
          setRevenueStats({
            totalRevenue: pickNumber(resObj, ["totalRevenue", "TotalRevenue"], 0),
            totalTransactions: pickNumber(resObj, ["totalTransactions", "TotalTransactions"], 0),
            avgTransaction: pickNumber(resObj, ["averageTransactionValue", "AverageTransactionValue"], 0),
          });
        } else {
          setRevenueStats(null);
        }
      })
      .catch((err) => {
        console.error("Failed to load revenue analytics:", err);
        if (mounted) {
          setRevenue([]);
          setRevenueStats(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [revStart, revEnd]);

  // Load monthly data (users/maps/exports + revenue) with selectable range
  useEffect(() => {
    let mounted = true;
    setMonthlyLoading(true);

    const start = new Date(monthlyStart);
    const end = new Date(monthlyEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setMonthlyLoading(false);
      return () => { };
    }

    Promise.allSettled([
      adminGetSystemAnalytics<Raw>(start, end),
      adminGetRevenueAnalytics<Raw>(start, end),
    ])
      .then((results) => {
        if (!mounted) return;

        const analyticsRes = results[0].status === "fulfilled" ? results[0].value : null;
        const revenueRes = results[1].status === "fulfilled" ? results[1].value : null;

        // 1) Parse monthly data if backend provides it
        const normalizedFromAnalytics = analyticsRes ? normalizeMonthlyData(analyticsRes as Raw) : [];

        // 2) Aggregate daily revenue -> monthly revenue if available
        let monthlyFromRevenue: MonthlyData[] = [];
        if (revenueRes) {
          const resObj = revenueRes as any;
          const dailyRevenue = resObj?.dailyRevenue || resObj?.DailyRevenue || (Array.isArray(resObj) ? resObj : []);
          const normalizedDaily = normalizeRevenue(dailyRevenue);
          monthlyFromRevenue = aggregateDailyRevenueToMonthly(normalizedDaily);
        }

        // 3) Merge: prefer analytics for users/maps/exports; fill revenue from either source
        const mergedMap = new Map<string, MonthlyData>();

        normalizedFromAnalytics.forEach((m) => {
          mergedMap.set(m.month, { ...m });
        });

        monthlyFromRevenue.forEach((m) => {
          const existing = mergedMap.get(m.month) || { ...m, users: 0, maps: 0, exports: 0 };
          mergedMap.set(m.month, { ...existing, revenue: m.revenue });
        });

        const merged = Array.from(mergedMap.values()).sort((a, b) => {
          const da = new Date(a.month);
          const db = new Date(b.month);
          return da.getTime() - db.getTime();
        });

        setMonthlyData(merged.length > 0 ? merged : normalizedFromAnalytics);
      })
      .catch((err) => {
        console.error("Failed to load monthly analytics:", err);
        if (mounted) {
          setMonthlyData([]);
        }
      })
      .finally(() => {
        if (mounted) setMonthlyLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [monthlyStart, monthlyEnd]);

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
  const monthlyDisplay = useMemo(
    () =>
      monthlyData.map((m) => ({
        ...m,
        monthLabel: formatMonthLabel(m.month),
      })),
    [monthlyData]
  );

  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
          <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
            <span>{t("admin", "total_users")}</span>
          </div>
          <div className="text-2xl font-extrabold tracking-wide">
            {loading ? "…" : (stats?.totalUsers ?? 0).toLocaleString()}
          </div>
          <div className="text-green-500 font-bold text-xs">
            {loading ? "" : toPct(stats ? stats.totalUsersChangePct : 0)}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
          <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
            <span>{t("admin", "active_today")}</span>
          </div>
          <div className="text-2xl font-extrabold tracking-wide">
            {loading ? "…" : (stats?.activeToday ?? 0).toLocaleString()}
          </div>
          <div className="text-green-500 font-bold text-xs">
            {loading ? "" : toPct(stats ? stats.activeTodayChangePct : 0)}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
          <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
            <span>{t("admin", "new_signups")}</span>
          </div>
          <div className="text-2xl font-extrabold tracking-wide">
            {loading ? "…" : (stats?.newSignups ?? 0).toLocaleString()}
          </div>
          <div className="text-green-500 font-bold text-xs">
            {loading ? "" : toPct(stats ? stats.newSignupsChangePct : 0)}
          </div>
        </div>
        <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
          <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
            <span>{t("admin", "errors_24h")}</span>
          </div>
          <div className="text-2xl font-extrabold tracking-wide">
            {loading ? "…" : (stats?.errors24h ?? 0).toLocaleString()}
          </div>
          <div className="text-green-500 font-bold text-xs">
            {loading ? "" : toPct(stats ? stats.errors24hChangePct : 0)}
          </div>
        </div>
      </section>

      {/* Monthly Analytics Chart */}
      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">{t("admin", "monthly_stats_title")}</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">{t("common", "from")}</label>
            <input
              type="month"
              value={monthlyStart.slice(0, 7)}
              onChange={(e) => {
                const v = e.target.value ? `${e.target.value}-01` : monthlyStart;
                setMonthlyStart(v);
              }}
              className="px-2 py-1 rounded border border-zinc-600 bg-zinc-800 text-white text-sm"
              max={monthlyEnd.slice(0, 7)}
            />
            <label className="text-sm text-zinc-400">{t("common", "to")}</label>
            <input
              type="month"
              value={monthlyEnd.slice(0, 7)}
              onChange={(e) => {
                const v = e.target.value ? `${e.target.value}-01` : monthlyEnd;
                setMonthlyEnd(v);
              }}
              className="px-2 py-1 rounded border border-zinc-600 bg-zinc-800 text-white text-sm"
              min={monthlyStart.slice(0, 7)}
            />
          </div>
        </div>
        {monthlyLoading ? (
          <div className={`h-[400px] flex items-center justify-center ${theme.textMuted}`}>
            {t("common", "loading_data")}
          </div>
        ) : monthlyData.length === 0 ? (
          <div className={`h-[400px] flex items-center justify-center ${theme.textMuted}`}>
            {t("common", "no_data")}
          </div>
        ) : (
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDisplay} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e4e4e7"} />
                <XAxis
                  dataKey="monthLabel"
                  stroke={isDark ? "#a1a1aa" : "#71717a"}
                  style={{ fontSize: "12px" }}
                  tickFormatter={(v: string) => v}
                />
                <YAxis
                  stroke={isDark ? "#a1a1aa" : "#71717a"}
                  style={{ fontSize: "12px" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#27272a" : "#ffffff",
                    border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f4f4f5" : "#18181b",
                  }}
                  labelFormatter={(_, payload) => {
                    const raw = payload?.[0]?.payload?.month ?? payload?.[0]?.payload?.monthLabel ?? "";
                    return formatMonthLabel(raw);
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  iconType="circle"
                />
                <Bar
                  dataKey="users"
                  name="Người dùng"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="maps"
                  name="Maps"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="exports"
                  name="Exports"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Daily Revenue Chart */}
      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Doanh thu theo ngày</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">Từ</label>
            <input
              type="date"
              value={revStart}
              onChange={(e) => setRevStart(e.target.value)}
              className="px-2 py-1 rounded border border-zinc-600 bg-zinc-800 text-white text-sm"
              max={revEnd}
            />
            <label className="text-sm text-zinc-400">Đến</label>
            <input
              type="date"
              value={revEnd}
              onChange={(e) => setRevEnd(e.target.value)}
              className="px-2 py-1 rounded border border-zinc-600 bg-zinc-800 text-white text-sm"
              min={dateInputValue(new Date())}
            />
          </div>
        </div>
        {monthlyLoading ? (
          <div className={`h-[400px] flex items-center justify-center ${theme.textMuted}`}>
            Đang tải dữ liệu...
          </div>
        ) : revenue.length === 0 ? (
          <div className={`h-[400px] flex items-center justify-center ${theme.textMuted}`}>
            Không có dữ liệu
          </div>
        ) : (
          <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#3f3f46" : "#e4e4e7"} />
                <XAxis
                  dataKey="date"
                  stroke={isDark ? "#a1a1aa" : "#71717a"}
                  style={{ fontSize: "12px" }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return Number.isNaN(d.getTime())
                      ? v
                      : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
                  }}
                />
                <YAxis
                  stroke={isDark ? "#a1a1aa" : "#71717a"}
                  style={{ fontSize: "12px" }}
                  tickFormatter={(value) => formatMoney(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? "#27272a" : "#ffffff",
                    border: `1px solid ${isDark ? "#3f3f46" : "#e4e4e7"}`,
                    borderRadius: "8px",
                    color: isDark ? "#f4f4f5" : "#18181b",
                  }}
                  formatter={(value: number) => formatMoney(value)}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Doanh thu"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: "#8b5cf6", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Tài khoản nổi bật</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 min-w-[160px] ${theme.input}`}
              placeholder="Tìm kiếm tài khoản…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className={`overflow-auto border ${theme.tableBorder} rounded-lg mt-2`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>User</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Email</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Total maps</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Total exports</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Total spent</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Last active</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}></th>
              </tr>
            </thead>
            <tbody>
              {(filteredTopUsers.length ? filteredTopUsers : Array.from({ length: 8 }).map(() => null)).map((row, i) => (
                <tr key={i}>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.userName : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.email : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.totalMaps.toLocaleString() : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.totalExports.toLocaleString() : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? formatMoney(row.totalSpent) : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? formatDateTime(row.lastActive) : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    <button
                      className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${isDark ? "text-[#3f5f36]" : "text-blue-600"
                        }`}
                      disabled={!row || !row.id}
                      onClick={() => {
                        if (!row?.id) return;
                        router.push(`/dashboard/users/${encodeURIComponent(row.id)}`);
                      }}
                    >
                      View
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Tổ chức nổi bật</h3>
        </div>
        <div className={`overflow-auto border ${theme.tableBorder} rounded-lg mt-2`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Name</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Owner</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Members</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Created</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}></th>
              </tr>
            </thead>
            <tbody>
              {(topOrgs.length ? topOrgs : Array.from({ length: 8 }).map(() => null)).map((row, i) => (
                <tr key={i}>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.name : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? (row.owner || "-") : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.members : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{row ? row.created : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    <button
                      className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50 ${isDark ? "text-[#3f5f36]" : "text-blue-600"
                        }`}
                      disabled={!row || !row.id}
                      onClick={() => {
                        if (!row?.id) return;
                        router.push(`/dashboard/organizations/${encodeURIComponent(row.id)}`);
                      }}
                    >
                      View
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Thống kê hệ thống</h3>
        </div>
        <div className={`overflow-auto border ${theme.tableBorder} rounded-lg mt-2`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Metric</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>Value</th>
              </tr>
            </thead>
            <tbody>
              {(usage.length ? usage : Array.from({ length: 4 }).map(() => null)).map((u, i) => (
                <tr key={i}>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{u ? u.label : "…"}</td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>{u ? u.value : "…"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>


    </div>
  );
}
