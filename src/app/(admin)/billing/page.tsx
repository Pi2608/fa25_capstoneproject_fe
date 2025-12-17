"use client";

import { useMemo, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getAdminTransactions, AdminTransactionDto } from "@/lib/api-membership";
import { useTheme } from "../layout";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/api-core";

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "Paid" | "Refunded" | "Failed" | "Pending" | "Success" | "Cancelled";
  originalStatus: string; // Keep original status from API for filtering
  method: string;
};

export default function BillingPage() {
  const { isDark } = useTheme();
  const { t } = useI18n();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"All" | Tx["status"]>("All");

  // Fetch transactions from API
  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await getAdminTransactions({
        page: 1,
        pageSize: 100, // Get all recent transactions
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      // Map API response to local Tx type
      const mappedTxs: Tx[] = response.transactions.map((tx: AdminTransactionDto) => ({
        id: tx.transactionId,
        date: new Date(tx.createdAt).toLocaleString("vi-VN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        description: `${tx.plan.planName} — ${tx.description}`,
        amount: tx.amount,
        status: normalizeStatus(tx.status),
        originalStatus: tx.status.toLowerCase(), // Keep original for filtering
        method: tx.paymentGateway.name,
      }));

      setTxs(mappedTxs);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      toast.error(t("admin.billing_loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Normalize status to match expected types
  const normalizeStatus = (status: string): Tx["status"] => {
    const normalized = status.toLowerCase();
    if (normalized === "paid") return "Paid";
    if (normalized === "success") return "Success"; // Keep Success separate
    if (normalized === "pending") return "Pending";
    if (normalized === "failed") return "Failed";
    if (normalized === "refunded") return "Refunded";
    if (normalized === "cancelled") return "Cancelled";
    return "Pending";
  };

  const filtered = useMemo(() => {
    return txs.filter((tx) => {
      const okQ = q
        ? tx.id.toLowerCase().includes(q.toLowerCase()) ||
          tx.status.toLowerCase().includes(q.toLowerCase()) ||
          tx.originalStatus.includes(q.toLowerCase())
        : true;
      
      // Filter by status
      let okS = true;
      if (status !== "All") {
        if (status === "Paid") {
          // "Paid" filter should match both "Paid" and "Success" normalized statuses
          okS = tx.status === "Paid" || tx.status === "Success";
        } else {
          // For other statuses, match normalized status exactly
          okS = tx.status === status;
        }
      }
      
      return okQ && okS;
    });
  }, [txs, q, status]);

  // Calculate total paid from ALL transactions (not filtered) with completed status
  // Include both "Paid" and "Success" statuses
  const totalPaid = useMemo(() => {
    return txs
      .filter((tx) => tx.status === "Paid" || tx.status === "Success")
      .reduce((s, tx) => s + tx.amount, 0);
  }, [txs]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as Tx["status"] | "All";
    setStatus(value);
  };

  // Client-side CSV export
  const handleExportCSV = () => {
    try {
      const headers = [
        t("admin.billing_tableHeader_date"),
        t("admin.billing_tableHeader_amount"),
        t("admin.billing_tableHeader_status")
      ];

      const rows = filtered.map(tx => [
        tx.date,
        tx.amount.toFixed(2),
        tx.status
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t("admin.billing_exportSuccess"));
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(t("admin.billing_exportFailed"));
    }
  };

  // Download invoice PDF using admin bulk download endpoint (with single ID)
  const handleViewInvoice = async (transactionId: string) => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
      if (!base) {
        throw new Error("Missing API base URL");
      }

      const token = getToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      // Use admin bulk download endpoint with single transaction ID
      const response = await fetch(`${base}/admin/billing/transactions/receipts/bulk-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactionIds: [transactionId] }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      // Download ZIP file (contains single PDF)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${transactionId}-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t("admin.billing_invoiceDownloaded"));
    } catch (error) {
      console.error("Failed to view invoice:", error);
      toast.error(t("admin.billing_invoiceFailed"));
    }
  };

  const getStatusLabel = (status: Tx["status"]) => {
    switch (status) {
      case "Paid":
        return t("admin.billing_status_paid");
      case "Success":
        return t("admin.billing_status_paid"); // Success is also considered paid/completed
      case "Refunded":
        return t("admin.billing_status_refunded");
      case "Failed":
        return t("admin.billing_status_failed");
      case "Pending":
        return t("admin.billing_status_pending");
      case "Cancelled":
        return t("admin.billing_status_cancelled");
      default:
        return status;
    }
  };

  // Format amount for display
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M₫`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k₫`;
    }
    return `${amount.toLocaleString()}₫`;
  };

  return (
    <main className="grid gap-5">
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn(
          "border rounded-xl p-3.5 shadow-sm grid gap-2",
          isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "flex items-center justify-between text-xs",
            isDark ? "text-zinc-400" : "text-gray-600"
          )}>
            <span>{t("admin.billing_paid")}</span>
          </div>
          <div className={cn(
            "text-2xl font-extrabold tracking-wide",
            isDark ? "text-zinc-100" : "text-gray-900"
          )}>{formatAmount(totalPaid)}</div>
          <div className="text-green-500 font-bold text-xs">Via cards & wallets</div>
        </div>
        <div className={cn(
          "border rounded-xl p-3.5 shadow-sm grid gap-2",
          isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "flex items-center justify-between text-xs",
            isDark ? "text-zinc-400" : "text-gray-600"
          )}>
            <span>{t("admin.billing_invoices")}</span>
          </div>
          <div className={cn(
            "text-2xl font-extrabold tracking-wide",
            isDark ? "text-zinc-100" : "text-gray-900"
          )}>{filtered.length}</div>
          <div className="text-green-500 font-bold text-xs">{t("admin.billing_allStatuses")}</div>
        </div>
      </section>

      <section className={cn(
        "border rounded-xl p-4 shadow-sm grid gap-3",
        isDark ? "bg-zinc-900/98 border-zinc-800" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className={cn(
            "m-0 text-base font-extrabold",
            isDark ? "text-zinc-100" : "text-gray-900"
          )}>{t("admin.billing_title")}</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              className={cn(
                "h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 min-w-[160px]",
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              )}
              placeholder={t("admin.billing_searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className={cn(
                "h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1",
                isDark
                  ? "border-zinc-800 bg-zinc-800/96 text-zinc-100 focus:border-zinc-700 focus:ring-zinc-700"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400"
              )}
              value={status}
              onChange={handleStatusChange}
            >
              <option value="All">{t("admin.billing_allStatuses")}</option>
              <option value="Paid">{t("admin.billing_status_paid")}</option>
              <option value="Pending">{t("admin.billing_status_pending")}</option>
              <option value="Refunded">{t("admin.billing_status_refunded")}</option>
              <option value="Failed">{t("admin.billing_status_failed")}</option>
              <option value="Cancelled">{t("admin.billing_status_cancelled")}</option>
            </select>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer hover:from-[#3a7a45] hover:to-[#2d5a35] transition-colors"
            >
              {t("admin.billing_exportCSV")}
            </button>
          </div>
        </div>

        <div className={cn(
          "overflow-auto border rounded-lg mt-2",
          isDark ? "border-zinc-800" : "border-gray-200"
        )}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={isDark ? "bg-zinc-800/95" : "bg-gray-50"}>
                <th className={cn(
                  "p-3 border-b text-left font-extrabold text-xs",
                  isDark
                    ? "border-zinc-800 text-zinc-200"
                    : "border-gray-200 text-gray-700"
                )}>{t("admin.billing_tableHeader_date")}</th>
                <th className={cn(
                  "p-3 border-b text-right font-extrabold text-xs",
                  isDark
                    ? "border-zinc-800 text-zinc-200"
                    : "border-gray-200 text-gray-700"
                )}>{t("admin.billing_tableHeader_amount")}</th>
                <th className={cn(
                  "p-3 border-b text-left font-extrabold text-xs",
                  isDark
                    ? "border-zinc-800 text-zinc-200"
                    : "border-gray-200 text-gray-700"
                )}>{t("admin.billing_tableHeader_status")}</th>
                <th className={cn(
                  "p-3 border-b text-left font-extrabold text-xs",
                  isDark
                    ? "border-zinc-800 text-zinc-200"
                    : "border-gray-200 text-gray-700"
                )}>{t("admin.billing_tableHeader_action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={cn(
                    "py-8 text-center",
                    isDark ? "text-zinc-400" : "text-gray-600"
                  )}>
                    {t("admin.billing_loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className={cn(
                    "py-8 text-center",
                    isDark ? "text-zinc-400" : "text-gray-600"
                  )}>
                    {t("admin.billing_noTransactions")}
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                <tr
                  key={tx.id}
                  className={cn(
                    isDark
                      ? "hover:bg-zinc-800/50 border-zinc-800"
                      : "hover:bg-gray-50 border-gray-200"
                  )}
                >
                  <td className={cn(
                    "p-3 border-b text-left",
                    isDark ? "text-zinc-300" : "text-gray-700"
                  )}>{tx.date}</td>
                  <td className={cn(
                    "p-3 border-b text-right",
                    isDark ? "text-zinc-200" : "text-gray-900"
                  )}>{tx.amount.toLocaleString()}₫</td>
                  <td className={cn(
                    "p-3 border-b text-left",
                    isDark ? "border-zinc-800" : "border-gray-200"
                  )}>
                    {tx.status === "Paid" && (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-extrabold",
                        isDark
                          ? "text-emerald-400 bg-emerald-500/20"
                          : "text-emerald-700 bg-emerald-50"
                      )}>
                        {getStatusLabel(tx.status)}
                      </span>
                    )}
                    {tx.status === "Refunded" && (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-extrabold",
                        isDark
                          ? "text-amber-400 bg-amber-500/20"
                          : "text-amber-700 bg-amber-50"
                      )}>
                        {getStatusLabel(tx.status)}
                      </span>
                    )}
                    {tx.status === "Failed" && (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-extrabold",
                        isDark
                          ? "text-red-400 bg-red-500/20"
                          : "text-red-700 bg-red-50"
                      )}>
                        {getStatusLabel(tx.status)}
                      </span>
                    )}
                    {tx.status === "Pending" && (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-extrabold",
                        isDark
                          ? "text-blue-400 bg-blue-500/20"
                          : "text-blue-700 bg-blue-50"
                      )}>
                        {getStatusLabel(tx.status)}
                      </span>
                    )}
                    {tx.status === "Success" && (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-extrabold",
                        isDark
                          ? "text-emerald-400 bg-emerald-500/20"
                          : "text-emerald-700 bg-emerald-50"
                      )}>
                        {getStatusLabel(tx.status)}
                      </span>
                    )}
                    {tx.status === "Cancelled" && (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-extrabold",
                        isDark
                          ? "text-zinc-400 bg-zinc-700/50"
                          : "text-gray-700 bg-gray-100"
                      )}>
                        {getStatusLabel(tx.status)}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    "p-3 border-b text-left",
                    isDark ? "border-zinc-800" : "border-gray-200"
                  )}>
                    <button
                      onClick={() => handleViewInvoice(tx.id)}
                      className={cn(
                        "text-sm font-medium transition-colors hover:underline",
                        isDark
                          ? "text-emerald-400 hover:text-emerald-300"
                          : "text-emerald-600 hover:text-emerald-700"
                      )}
                    >
                      {t("admin.billing_action_viewInvoice")}
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
