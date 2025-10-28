"use client";

import { useEffect, useState } from "react";
import { adminGetAnalytics, type AdminAnalytics } from "@/lib/admin-api";
import s from "../admin.module.css";

export default function AnalyticsPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const result = await adminGetAnalytics();
        if (mounted) {
          setData(result);
        }
      } catch (_err) {
        if (mounted) {
          setError("Không tải được dữ liệu phân tích.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const safeFixed2 = (n: number): string => {
    if (typeof n === "number" && Number.isFinite(n)) {
      return n.toFixed(2);
    }
    return "0.00";
  };

  const renderBody = () => {
    if (loading) {
      return <div>Đang tải…</div>;
    }

    if (error) {
      return <div className={s.errorBox}>{error}</div>;
    }

    if (!data) {
      return <div>Không có dữ liệu.</div>;
    }

    return (
      <>
        <section className={s.kpis}>
          <div className={s.kpi}>
            <div className={s.kpiTop}>
              <span>Tổng tài khoản</span>
            </div>
            <div className={s.kpiNum}>{data.total_users}</div>
            <div className={s.kpiTrend}>
              Active: {data.active_users}
            </div>
          </div>

          <div className={s.kpi}>
            <div className={s.kpiTop}>
              <span>Tổ chức</span>
            </div>
            <div className={s.kpiNum}>{data.total_organizations}</div>
            <div className={s.kpiTrend}>
              Active: {data.active_organizations}
            </div>
          </div>

          <div className={s.kpi}>
            <div className={s.kpiTop}>
              <span>Doanh thu (USD)</span>
            </div>
            <div className={s.kpiNum}>
              {safeFixed2(data.total_revenue)}
            </div>
            <div className={s.kpiTrend}>
              Giao dịch: {data.total_transactions}
            </div>
          </div>

          <div className={s.kpi}>
            <div className={s.kpiTop}>
              <span>Giao dịch / Tài khoản</span>
            </div>
            <div className={s.kpiNum}>
              {data.total_users > 0
                ? safeFixed2(
                    data.total_transactions / data.total_users
                  )
                : "0.00"}
            </div>
            <div className={s.kpiTrend}>Trung bình 7 ngày</div>
          </div>
        </section>

        <section className={s.panel}>
          <div className={s.panelHead}>
            <h3>Chi tiết</h3>
          </div>

          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Chỉ số</th>
                  <th>Giá trị</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tổng tài khoản</td>
                  <td>{data.total_users}</td>
                </tr>
                <tr>
                  <td>Tài khoản hoạt động</td>
                  <td>{data.active_users}</td>
                </tr>
                <tr>
                  <td>Tổng tổ chức</td>
                  <td>{data.total_organizations}</td>
                </tr>
                <tr>
                  <td>Tổ chức hoạt động</td>
                  <td>{data.active_organizations}</td>
                </tr>
                <tr>
                  <td>Tổng doanh thu (USD)</td>
                  <td>{safeFixed2(data.total_revenue)}</td>
                </tr>
                <tr>
                  <td>Tổng giao dịch</td>
                  <td>{data.total_transactions}</td>
                </tr>
                <tr>
                  <td>Giao dịch / tài khoản</td>
                  <td>
                    {data.total_users > 0
                      ? safeFixed2(
                          data.total_transactions /
                            data.total_users
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
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Phân tích hệ thống</h3>
        </div>
        {renderBody()}
      </section>
    </div>
  );
}
