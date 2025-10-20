"use client";

import { useMemo, useState } from "react";
import s from "../admin.module.css";

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "Paid" | "Refunded" | "Failed" | "Pending";
  method: "Visa" | "Mastercard" | "Momo" | "Bank";
};

const txs: Tx[] = [
  { id: "t1", date: "2025-09-20 08:10", description: "IMOS Pro — Monthly", amount: 129000, status: "Paid", method: "Visa" },
  { id: "t2", date: "2025-08-20 08:12", description: "IMOS Pro — Monthly", amount: 129000, status: "Paid", method: "Visa" },
  { id: "t3", date: "2025-07-20 08:09", description: "IMOS Pro — Monthly", amount: 129000, status: "Refunded", method: "Visa" },
  { id: "t4", date: "2025-07-05 14:22", description: "One-time credits", amount: 99000, status: "Failed", method: "Bank" },
  { id: "t5", date: "2025-06-20 08:01", description: "IMOS Pro — Monthly", amount: 129000, status: "Paid", method: "Mastercard" },
];

export default function BillingPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All" | Tx["status"]>("All");

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      const okQ = q
        ? t.description.toLowerCase().includes(q.toLowerCase()) ||
          t.method.toLowerCase().includes(q.toLowerCase())
        : true;
      const okS = status === "All" ? true : t.status === status;
      return okQ && okS;
    });
  }, [q, status]);

  const totalPaid = filtered
    .filter((t) => t.status === "Paid")
    .reduce((s, t) => s + t.amount, 0);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Tx["status"] | "All";
    setStatus(value);
  };

  return (
    <main className={s.stack}>
      <section className={s.kpis}>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Current plan</span></div>
          <div className={s.kpiNum}>IMOS Pro</div>
          <div className={s.kpiTrend}>Next invoice: 2025-10-20</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Paid (filtered)</span></div>
          <div className={s.kpiNum}>{(totalPaid / 1000).toFixed(0)}k₫</div>
          <div className={s.kpiTrend}>Via cards & wallets</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Invoices</span></div>
          <div className={s.kpiNum}>{filtered.length}</div>
          <div className={s.kpiTrend}>All statuses</div>
        </div>
        <div className={s.kpi}>
          <div className={s.kpiTop}><span>Balance</span></div>
          <div className={s.kpiNum}>0₫</div>
          <div className={s.kpiTrend}>No outstanding</div>
        </div>
      </section>

      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Billing history</h3>
          <div className={s.filters}>
            <input
              className={s.input}
              placeholder="Search desc or method…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className={s.select}
              value={status}
              onChange={handleStatusChange}
            >
              <option>All</option>
              <option>Paid</option>
              <option>Refunded</option>
              <option>Failed</option>
              <option>Pending</option>
            </select>
            <a className={s.primary} href="#">
              Export CSV
            </a>
          </div>
        </div>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td className="font-medium">{t.description}</td>
                  <td>{t.method}</td>
                  <td className="text-right">{t.amount.toLocaleString()}₫</td>
                  <td>
                    {t.status === "Paid" && <span className={s.badgeSuccess}>Paid</span>}
                    {t.status === "Refunded" && <span className={s.badgeWarn}>Refunded</span>}
                    {t.status === "Failed" && (
                      <span
                        className={s.badgeWarn}
                        style={{
                          color: "#ef4444",
                          background: "color-mix(in srgb,#ef4444 14%, transparent)",
                        }}
                      >
                        Failed
                      </span>
                    )}
                    {t.status === "Pending" && <span className={s.badgeWarn}>Pending</span>}
                  </td>
                  <td className={s.rowActions}>
                    <a className={s.linkBtn} href="#">View</a>
                    <a className={s.linkBtn} href="#">Invoice PDF</a>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[--muted]">
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
