"use client";

import { useEffect, useState } from "react";
import { adminGetAnalytics, type AdminAnalytics } from "@/lib/admin-api";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { useLoading } from "@/contexts/LoadingContext";

export default function AnalyticsPage() {
  const { isDark } = useTheme();
  const loading = useLoading();
  const theme = getThemeClasses(isDark);
  const [data, setData] = useState<AdminAnalytics | null>(null);

  // Date range state
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6); // Last 7 days by default
    d.setHours(0, 0, 0, 0);
    return dateInputValue(d);
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateInputValue(today);
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      loading.showLoading();

      try {
        // Parse dates as UTC to avoid timezone issues
        const start = parseYmdToUtc(startDate);
        const end = parseYmdToUtc(endDate);
        
        // Set end time to end of day (inclusive)
        const endInclusive = new Date(end);
        endInclusive.setUTCHours(23, 59, 59, 999);

        const result = await adminGetAnalytics(start, endInclusive);
        if (mounted) {
          setData(result);
        }
      } catch (_err) {
        if (mounted) {
          loading.setLoadingMessage("Không tải được dữ liệu phân tích.");
        }
      } finally {
        if (mounted) {
          loading.hideLoading();
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [startDate, endDate]);

  const safeFixed2 = (n: number): string => {
    if (typeof n === "number" && Number.isFinite(n)) {
      return n.toFixed(2);
    }
    return "0.00";
  };

  function parseYmdToUtc(ymd: string) {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }

  function dateInputValue(d: Date) {
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
  }

  const renderBody = () => {
    if (!data) {
      return <div>Không có dữ liệu.</div>;
    }

    return (
      <>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
            <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
              <span>Tổng tài khoản</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide">
              {data.total_users}
            </div>
            <div className="text-green-500 font-bold text-xs">
              Active: {data.active_users}
            </div>
          </div>

          <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
            <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
              <span>Tổ chức</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide">
              {data.total_organizations}
            </div>
            <div className="text-green-500 font-bold text-xs">
              Active: {data.active_organizations}
            </div>
          </div>

          <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
            <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
              <span>Doanh thu (USD)</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide">
              {safeFixed2(data.total_revenue)}
            </div>
            <div className="text-green-500 font-bold text-xs">
              Giao dịch: {data.total_transactions}
            </div>
          </div>

          <div className={`${theme.kpiCard} border rounded-xl p-3.5 shadow-sm grid gap-2`}>
            <div className={`flex items-center justify-between ${theme.textMuted} text-xs`}>
              <span>Giao dịch / Tài khoản</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide">
              {data.total_users > 0
                ? safeFixed2(
                    data.total_transactions / data.total_users
                  )
                : "0.00"}
            </div>
            <div className="text-green-500 font-bold text-xs">
              Trung bình 7 ngày
            </div>
          </div>
        </section>

        <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="m-0 text-base font-extrabold">Chi tiết</h3>
          </div>

          <div className={`overflow-auto border ${theme.tableBorder} rounded-lg`}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>
                    Chỉ số
                  </th>
                  <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`}>
                    Giá trị
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Tổng tài khoản
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {data.total_users}
                  </td>
                </tr>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Tài khoản hoạt động
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {data.active_users}
                  </td>
                </tr>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Tổng tổ chức
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {data.total_organizations}
                  </td>
                </tr>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Tổ chức hoạt động
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {data.active_organizations}
                  </td>
                </tr>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Tổng doanh thu (USD)
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {safeFixed2(data.total_revenue)}
                  </td>
                </tr>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Tổng giao dịch
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {data.total_transactions}
                  </td>
                </tr>
                <tr>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    Giao dịch / tài khoản
                  </td>
                  <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                    {data.total_users > 0
                      ? safeFixed2(
                          data.total_transactions / data.total_users
                        )
                      : "0.00"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  };

  return (
    <div className="grid gap-5">
      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3 pt-2 mt-0`}>
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Phân tích hệ thống</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-400">Từ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 rounded border border-zinc-600 bg-zinc-800 text-white text-sm"
              max={endDate}
            />
            <label className="text-sm text-zinc-400">Đến</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 rounded border border-zinc-600 bg-zinc-800 text-white text-sm"
              min={startDate}
            />
          </div>
        </div>
        {renderBody()}
      </section>
    </div>
  );
}
