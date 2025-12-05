"use client";

import { useMemo, useState } from "react";

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
    <main className="grid gap-5">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Current plan</span>
          </div>
          <div className="text-2xl font-extrabold tracking-wide">IMOS Pro</div>
          <div className="text-green-500 font-bold text-xs">Next invoice: 2025-10-20</div>
        </div>
        <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Paid (filtered)</span>
          </div>
          <div className="text-2xl font-extrabold tracking-wide">{(totalPaid / 1000).toFixed(0)}k₫</div>
          <div className="text-green-500 font-bold text-xs">Via cards & wallets</div>
        </div>
        <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Invoices</span>
        </div>
          <div className="text-2xl font-extrabold tracking-wide">{filtered.length}</div>
          <div className="text-green-500 font-bold text-xs">All statuses</div>
        </div>
        <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Balance</span>
        </div>
          <div className="text-2xl font-extrabold tracking-wide">0₫</div>
          <div className="text-green-500 font-bold text-xs">No outstanding</div>
        </div>
      </section>

      <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Billing history</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              className="h-[34px] px-2.5 text-sm rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 min-w-[160px]"
              placeholder="Search desc or method…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="h-[34px] px-2.5 text-sm rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
              value={status}
              onChange={handleStatusChange}
            >
              <option>All</option>
              <option>Paid</option>
              <option>Refunded</option>
              <option>Failed</option>
              <option>Pending</option>
            </select>
            <a
              className="px-3 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer"
              href="#"
            >
              Export CSV
            </a>
          </div>
        </div>

        <div className="overflow-auto border border-zinc-800 rounded-lg mt-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">Date</th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">Description</th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">Method</th>
                <th className="p-3 border-b border-zinc-800 text-right bg-zinc-800/95 font-extrabold text-xs text-zinc-400">Amount</th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">Status</th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 border-b border-zinc-800 text-left">{t.date}</td>
                  <td className="p-3 border-b border-zinc-800 text-left font-medium">{t.description}</td>
                  <td className="p-3 border-b border-zinc-800 text-left">{t.method}</td>
                  <td className="p-3 border-b border-zinc-800 text-right">{t.amount.toLocaleString()}₫</td>
                  <td className="p-3 border-b border-zinc-800 text-left">
                    {t.status === "Paid" && (
                      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">
                        Paid
                      </span>
                    )}
                    {t.status === "Refunded" && (
                      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">
                        Refunded
                      </span>
                    )}
                    {t.status === "Failed" && (
                      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-red-500 bg-red-500/14">
                        Failed
                      </span>
                    )}
                    {t.status === "Pending" && (
                      <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-3 border-b border-zinc-800 text-left">
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-sm font-medium">
                      <a className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0" href="#">
                        View
                      </a>
                      <a className="text-[#166534] hover:underline cursor-pointer bg-transparent border-0 p-0" href="#">
                        Invoice PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
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
