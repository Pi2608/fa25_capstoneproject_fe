"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import {
  getAdminTransactions,
  getTransactionStatistics,
  bulkDownloadReceipts,
  exportTransactions,
  AdminTransactionDto,
  AdminTransactionFilterParams,
  TransactionStatistics,
} from "@/lib/api-membership";

export default function AdminTransactionsPage() {
  // State management
  const [transactions, setTransactions] = useState<AdminTransactionDto[]>([]);
  const [statistics, setStatistics] = useState<TransactionStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  // Filter state
  const [filters, setFilters] = useState<AdminTransactionFilterParams>({
    page: 1,
    pageSize: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // Pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [transactionsRes, statsRes] = await Promise.all([
        getAdminTransactions(filters),
        getTransactionStatistics(filters),
      ]);

      setTransactions(transactionsRes.transactions);
      setTotalCount(transactionsRes.totalCount);
      setTotalPages(transactionsRes.totalPages);
      setStatistics(statsRes);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map((t) => t.transactionId)));
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
    const newSet = new Set(selectedTransactions);
    if (newSet.has(transactionId)) {
      newSet.delete(transactionId);
    } else {
      newSet.add(transactionId);
    }
    setSelectedTransactions(newSet);
  };

  const handleBulkDownload = async () => {
    try {
      const ids = Array.from(selectedTransactions);
      await bulkDownloadReceipts(ids);
      toast.success(`Downloaded ${ids.length} receipts`);
    } catch (error) {
      console.error("Failed to download receipts:", error);
      toast.error("Failed to download receipts");
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      await exportTransactions(format, filters);
      toast.success(`Exported to ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Failed to export:", error);
      toast.error("Failed to export transactions");
    }
  };

  return (
    <main className="grid gap-5">
      {/* Statistics Cards */}
      {statistics && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Total Transactions</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide">
              {statistics.totalCount.toLocaleString()}
            </div>
            <div className="text-green-500 font-bold text-xs">All system transactions</div>
          </div>

          <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Total Revenue</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide text-green-500">
              {(statistics.totalRevenue / 1000).toFixed(0)}k₫
            </div>
            <div className="text-green-500 font-bold text-xs">From successful payments</div>
          </div>

          <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Success Rate</span>
            </div>
            <div className={`text-2xl font-extrabold tracking-wide ${
              statistics.successRate >= 90 ? "text-green-500" :
              statistics.successRate >= 70 ? "text-amber-500" :
              "text-red-500"
            }`}>
              {statistics.successRate.toFixed(1)}%
            </div>
            <div className="text-green-500 font-bold text-xs">Payment success</div>
          </div>

          <div className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-3.5 shadow-sm grid gap-2">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Failed Transactions</span>
            </div>
            <div className="text-2xl font-extrabold tracking-wide text-red-500">
              {statistics.failedCount + statistics.cancelledCount}
            </div>
            <div className="text-red-500 font-bold text-xs">Requires attention</div>
          </div>
        </section>
      )}

      {/* Actions Bar & Table */}
      <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Transaction Management</h3>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search by Transaction ID or Organization"
              className="h-[34px] px-2.5 text-sm rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 min-w-[200px]"
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />

            <select
              className="h-[34px] px-2.5 text-sm rounded-lg border border-zinc-800 bg-zinc-800/96 text-zinc-100 outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
              value={filters.status || ""}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All Status</option>
              <option value="success,paid">Success/Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button
              onClick={() => handleExport("csv")}
              className="px-3 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer"
            >
              Export CSV
            </button>

            {selectedTransactions.size > 0 && (
              <button
                onClick={handleBulkDownload}
                className="px-3 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer"
              >
                Download {selectedTransactions.size} Receipts
              </button>
            )}
          </div>
        </div>

        <div className="overflow-auto border border-zinc-800 rounded-lg mt-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.size === transactions.length && transactions.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  Transaction ID
                </th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  Organization
                </th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  Plan
                </th>
                <th className="p-3 border-b border-zinc-800 text-right bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  Amount
                </th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  Status
                </th>
                <th className="p-3 border-b border-zinc-800 text-left bg-zinc-800/95 font-extrabold text-xs text-zinc-400">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.transactionId}>
                    <td className="p-3 border-b border-zinc-800 text-left">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.has(transaction.transactionId)}
                        onChange={() => handleSelectTransaction(transaction.transactionId)}
                        disabled={!transaction.canDownloadReceipt}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3 border-b border-zinc-800 text-left font-mono">
                      {transaction.transactionId.slice(0, 8)}...
                    </td>
                    <td className="p-3 border-b border-zinc-800 text-left font-medium">
                      {transaction.organization.orgName}
                    </td>
                    <td className="p-3 border-b border-zinc-800 text-left">
                      {transaction.plan.planName}
                    </td>
                    <td className="p-3 border-b border-zinc-800 text-right">
                      {transaction.amount.toLocaleString()}₫
                    </td>
                    <td className="p-3 border-b border-zinc-800 text-left">
                      {(transaction.status.toLowerCase() === "success" || transaction.status.toLowerCase() === "paid") && (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">
                          {transaction.status}
                        </span>
                      )}
                      {transaction.status.toLowerCase() === "pending" && (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">
                          {transaction.status}
                        </span>
                      )}
                      {(transaction.status.toLowerCase() === "failed" || transaction.status.toLowerCase() === "cancelled") && (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-red-500 bg-red-500/14">
                          {transaction.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-b border-zinc-800 text-left">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <div className="text-zinc-400">
              Showing {((filters.page || 1) - 1) * (filters.pageSize || 20) + 1} to{" "}
              {Math.min((filters.page || 1) * (filters.pageSize || 20), totalCount)} of {totalCount}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                disabled={(filters.page || 1) <= 1}
                className="px-3 py-1 border border-zinc-800 rounded-lg disabled:opacity-50 hover:bg-zinc-800/50 text-zinc-100"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-zinc-100">
                Page {filters.page || 1} of {totalPages}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                disabled={(filters.page || 1) >= totalPages}
                className="px-3 py-1 border border-zinc-800 rounded-lg disabled:opacity-50 hover:bg-zinc-800/50 text-zinc-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
