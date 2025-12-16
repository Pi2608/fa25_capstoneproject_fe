"use client";

import React, { JSX, useEffect, useMemo, useState } from "react";
import {
  getMyOrganizations,
  type MyOrganizationDto,
  getOrganizationBilling,
  type OrganizationBillingDto,
} from "@/lib/api-organizations";
import {
  getPaymentHistory,
  type PaymentHistoryItem,
  type Plan,
  getPlanById,
  getMyMembership,
} from "@/lib/api-membership";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import { TransactionDetailModal } from "@/components/billing/TransactionDetailModal";
import { Toaster } from "react-hot-toast";

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}
function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function Panel(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border shadow-lg overflow-hidden",
        "bg-gradient-to-b from-emerald-200/35 via-emerald-100/20 to-white/60",
        "ring-1 ring-emerald-500/10 border-emerald-200/60",
        "dark:from-zinc-900/70 dark:via-zinc-900/50 dark:to-zinc-900/40",
        "dark:border-white/10 dark:ring-white/10",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function Surface(props: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        "bg-white/90 backdrop-blur-sm border-emerald-200/60",
        "dark:bg-zinc-950/60 dark:border-white/10",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const s = (status ?? "").toLowerCase();
  let cls =
    "border-zinc-300 text-zinc-700 bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:bg-zinc-900/50";
  if (s === "success" || s === "paid")
    cls =
      "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:bg-emerald-500/10";
  else if (s === "pending")
    cls =
      "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-400/30 dark:text-amber-300 dark:bg-amber-500/10";
  else if (s === "cancelled" || s === "failed")
    cls =
      "border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:bg-rose-500/10";

  const labelMap: Record<string, string> = {
    success: t("billing.status_success"),
    paid: t("billing.status_paid"),
    pending: t("billing.status_pending"),
    cancelled: t("billing.status_cancelled"),
    failed: t("billing.status_failed"),
  };
  const label = labelMap[s] ?? status;

  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium", cls)}>
      {label}
    </span>
  );
}

function StatCard(props: { title: string; value: string; icon?: JSX.Element }) {
  return (
    <Surface className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">{props.title}</div>
        <div className="rounded-xl px-2.5 py-2 text-emerald-600 bg-emerald-500/10 ring-1 ring-emerald-500/15">
          {props.icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {props.value}
      </div>
    </Surface>
  );
}

const LandmarkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
    <path d="M3 10h18v2H3v-2Zm2 4h2v6H5v-6Zm4 0h2v6H9v-6Zm4 0h2v6h-2v-6Zm4 0h2v6h-2v-6ZM5 8l7-4 7 4H5Z" />
  </svg>
);
const DocIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6" />
  </svg>
);
const ArrowsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
    <path d="M7 3v12H4l4 6 4-6H9V3H7Zm10 18V9h3l-4-6-4 6h3v12h2Z" />
  </svg>
);

export default function BillingPage() {
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

  const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [billing, setBilling] = useState<OrganizationBillingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPaymentHistory, setUserPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [paymentHistoryPage, setPaymentHistoryPage] = useState(1);
  const [paymentHistoryPageSize, setPaymentHistoryPageSize] = useState(20);
  const [paymentHistoryTotal, setPaymentHistoryTotal] = useState(0);
  const [loadingPaymentHistory, setLoadingPaymentHistory] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentHistoryItem | null>(null);
  const [currentOrgPlan, setCurrentOrgPlan] = useState<Plan | null>(null);

  const currency = useMemo(
    () =>
      billing?.recentInvoices?.[0]?.currency ||
      billing?.recentTransactions?.[0]?.currency ||
      "USD",
    [billing]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getMyOrganizations();
        if (!alive) return;
        const list = res.organizations ?? [];
        setOrgs(list);
        setSelectedOrgId((prev) => prev || list[0]?.orgId || "");
      } catch {
        if (!alive) return;
        setError(t("billing.errors_orgList"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedOrgId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getOrganizationBilling(selectedOrgId);
        if (!alive) return;
        setBilling(data);

        // Fetch current organization membership and plan for modal validation
        try {
          const membership = await getMyMembership(selectedOrgId);
          if (membership && membership.planId) {
            const plan = await getPlanById(membership.planId);
            if (!alive) return;
            setCurrentOrgPlan(plan);
          }
        } catch (err) {
          console.error("Failed to fetch current plan:", err);
          // Modal will handle missing plan gracefully
        }
      } catch {
        if (!alive) return;
        setError(t("billing.errors_billingLoad"));
        setBilling(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedOrgId, t]);

  // Load user payment history
  useEffect(() => {
    let alive = true;
    setLoadingPaymentHistory(true);
    (async () => {
      try {
        const data = await getPaymentHistory(paymentHistoryPage, paymentHistoryPageSize);
        if (!alive) return;
        setUserPaymentHistory(data.payments ?? []);
        setPaymentHistoryTotal(data.totalCount ?? 0);
      } catch (err) {
        console.error("Failed to load payment history:", err);
        if (!alive) return;
        setUserPaymentHistory([]);
      } finally {
        if (alive) setLoadingPaymentHistory(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [paymentHistoryPage, paymentHistoryPageSize]);

  const handleViewDetails = (transaction: PaymentHistoryItem) => {
    console.log("🔍 Transaction plannedPlan:", transaction.plannedPlan); // ⭐ Add this
  console.log("🔍 Full transaction:", transaction); // ⭐ Add this
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="mx-auto max-w-7xl px-6 pt-3 pb-8 md:pt-5">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">{t("billing.title")}</h1>
        </div>

        <Panel className="p-6 -mt-1">
          <div className="mb-4 flex items-center gap-3">
            <span className={`text-sm ${themeClasses.textMuted}`}>{t("billing.orgLabel")}</span>
            <select
              className={`w-52 rounded-2xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${themeClasses.select}`}
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              {orgs.map((o) => (
                <option key={o.orgId} value={o.orgId}>
                  {o.orgName}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="h-28 rounded-2xl bg-emerald-200/40 animate-pulse dark:bg-zinc-800/60" />
              <div className="h-28 rounded-2xl bg-emerald-200/40 animate-pulse dark:bg-zinc-800/60" />
              <div className="h-28 rounded-2xl bg-emerald-200/40 animate-pulse dark:bg-zinc-800/60" />
              <div className="h-64 rounded-2xl bg-emerald-200/40 animate-pulse dark:bg-zinc-800/60 md:col-span-3" />
            </div>
          ) : error ? (
            <Surface className="border-rose-300 bg-rose-50/80 dark:bg-rose-500/10 dark:border-rose-400/30">
              <div className="text-sm text-rose-700 dark:text-rose-300">{error}</div>
            </Surface>
          ) : !billing ? (
            <Surface>{t("billing.noData")}</Surface>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <StatCard title={t("billing.stats_org")} value={billing.organizationName} icon={<LandmarkIcon />} />
                <StatCard
                  title={t("billing.stats_periodTotal")}
                  value={
                    billing.totalSpentThisMonth !== undefined
                      ? formatCurrency(billing.totalSpentThisMonth, currency)
                      : "—"
                  }
                  icon={<DocIcon />}
                />
                <StatCard
                  title={t("billing.stats_recentCount")}
                  value={String(billing.recentTransactions?.length ?? 0)}
                  icon={<ArrowsIcon />}
                />
              </div>

              <Surface className="mt-6">
                <div className="pb-3">
                  <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("billing.recent_title")}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{t("billing.recent_desc")}</div>
                </div>

                {billing.recentTransactions && billing.recentTransactions.length > 0 ? (
                  <div className={`overflow-hidden rounded-2xl border ${themeClasses.tableBorder}`}>
                    <table className="w-full text-sm">
                      <thead className={themeClasses.tableHeader}>
                        <tr>
                          <th className="px-5 py-3 text-left font-semibold">{t("billing.recent_table_id")}</th>
                          <th className="px-5 py-3 text-left font-semibold">{t("billing.recent_table_date")}</th>
                          <th className="px-5 py-3 text-left font-semibold">
                            {t("billing.recent_table_description")}
                          </th>
                          <th className="px-5 py-3 text-right font-semibold">{t("billing.recent_table_amount")}</th>
                          <th className="px-5 py-3 text-left font-semibold">{t("billing.recent_table_status")}</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${themeClasses.tableBorder}`}>
                        {billing.recentTransactions.map((tRow, i) => (
                          <tr
                            key={tRow.transactionId}
                            className={cn(
                              `border-b ${themeClasses.tableCell}`,
                              i % 2 ? (isDark ? "bg-zinc-900/40" : "bg-gray-50/40") : "",
                              isDark ? "hover:bg-zinc-900" : "hover:bg-gray-50"
                            )}
                          >
                            <td className={`px-5 py-3 font-mono text-[13px] ${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                              {tRow.transactionId}
                            </td>
                            <td className={`px-5 py-3 ${themeClasses.textMuted}`}>
                              {formatDate(tRow.transactionDate)}
                            </td>
                            <td className={`px-5 py-3 ${themeClasses.textMuted}`}>{tRow.description}</td>
                            <td className={`px-5 py-3 text-right ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                              {formatCurrency(tRow.amount, tRow.currency)}
                            </td>
                            <td className="px-5 py-3">
                              <StatusBadge status={tRow.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`text-sm ${themeClasses.textMuted}`}>{t("billing.recent_empty")}</div>
                )}
              </Surface>

              <Surface className="mt-6">
                <div className="pb-3">
                  <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("billing.invoices_title")}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">{t("billing.invoices_desc")}</div>
                </div>

                {billing.recentInvoices && billing.recentInvoices.length > 0 ? (
                  <div className={`overflow-hidden rounded-2xl border ${themeClasses.tableBorder}`}>
                    <table className="w-full text-sm">
                      <thead className={themeClasses.tableHeader}>
                        <tr>
                          <th className="px-5 py-3 text-left font-semibold">{t("billing.invoices_table_id")}</th>
                          <th className="px-5 py-3 text-left font-semibold">
                            {t("billing.invoices_table_issueDate")}
                          </th>
                          <th className="px-5 py-3 text-left font-semibold">{t("billing.invoices_table_dueDate")}</th>
                          <th className="px-5 py-3 text-right font-semibold">{t("billing.invoices_table_amount")}</th>
                          <th className="px-5 py-3 text-left font-semibold">{t("billing.invoices_table_status")}</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${themeClasses.tableBorder}`}>
                        {billing.recentInvoices.map((inv: { invoiceId: string; issueDate: string; dueDate: string; amount: number; currency: string; status: string }, i: number) => (
                          <tr
                            key={inv.invoiceId}
                            className={cn(
                              `border-b ${themeClasses.tableCell}`,
                              i % 2 ? (isDark ? "bg-zinc-900/40" : "bg-gray-50/40") : "",
                              isDark ? "hover:bg-zinc-900" : "hover:bg-gray-50"
                            )}
                          >
                            <td className={`px-5 py-3 font-mono text-[13px] ${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                              {inv.invoiceId}
                            </td>
                            <td className={`px-5 py-3 ${themeClasses.textMuted}`}>{formatDate(inv.issueDate)}</td>
                            <td className={`px-5 py-3 ${themeClasses.textMuted}`}>{formatDate(inv.dueDate)}</td>
                            <td className={`px-5 py-3 text-right ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                              {formatCurrency(inv.amount, inv.currency)}
                            </td>
                            <td className="px-5 py-3">
                              <StatusBadge status={inv.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`text-sm ${themeClasses.textMuted}`}>{t("billing.invoices_empty")}</div>
                )}
              </Surface>
            </>
          )}

          {/* User Payment History Section */}
          <Surface className="mt-6">
            <div className="pb-3">
              <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Lịch sử thanh toán của bạn
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Tất cả các giao dịch thanh toán của bạn (bao gồm đang chờ xử lý)
              </div>
            </div>

            {loadingPaymentHistory ? (
              <div className={`text-sm ${themeClasses.textMuted}`}>Đang tải...</div>
            ) : userPaymentHistory.length === 0 ? (
              <div className={`text-sm ${themeClasses.textMuted}`}>Chưa có giao dịch.</div>
            ) : (
              <div className={`overflow-hidden rounded-2xl border ${themeClasses.tableBorder}`}>
                <table className="w-full text-sm">
                  <thead className={themeClasses.tableHeader}>
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">Mã giao dịch</th>
                      <th className="px-5 py-3 text-left font-semibold">Ngày</th>
                      <th className="px-5 py-3 text-left font-semibold">Mục đích</th>
                      <th className="px-5 py-3 text-left font-semibold">Gói</th>
                      <th className="px-5 py-3 text-right font-semibold">Số tiền</th>
                      <th className="px-5 py-3 text-left font-semibold">Trạng thái</th>
                      <th className="px-5 py-3 text-left font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${themeClasses.tableBorder}`}>
                    {userPaymentHistory.map((item, i) => (
                      <tr
                        key={item.transactionId}
                        className={cn(
                          `border-b ${themeClasses.tableCell}`,
                          i % 2 ? (isDark ? "bg-zinc-900/40" : "bg-gray-50/40") : "",
                          isDark ? "hover:bg-zinc-900" : "hover:bg-gray-50"
                        )}
                      >
                        <td className={`px-5 py-3 font-mono text-[13px] ${isDark ? "text-zinc-200" : "text-gray-900"}`}>
                          {item.transactionId}
                        </td>
                        <td className={`px-5 py-3 ${themeClasses.textMuted}`}>
                          {formatDate(item.transactionDate)}
                        </td>
                        <td className={`px-5 py-3 ${themeClasses.textMuted}`}>{item.description || item.purpose || "—"}</td>
                        <td className={`px-5 py-3 ${themeClasses.textMuted}`}>
                          {item.plannedPlan?.planName || item.membership?.plan?.planName || "—"}
                        </td>
                        <td className={`px-5 py-3 text-right ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                          {formatCurrency(item.amount, "USD")}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              isDark
                                ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                            }`}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {paymentHistoryTotal > paymentHistoryPageSize && (
              <div className="mt-4 flex items-center justify-between">
                <div className={`text-sm ${themeClasses.textMuted}`}>
                  Trang {paymentHistoryPage} / {Math.ceil(paymentHistoryTotal / paymentHistoryPageSize)} • {paymentHistoryTotal} giao dịch
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={paymentHistoryPage <= 1 || loadingPaymentHistory}
                    onClick={() => setPaymentHistoryPage((p) => Math.max(1, p - 1))}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      paymentHistoryPage <= 1 || loadingPaymentHistory
                        ? (isDark ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-gray-300 text-gray-500 cursor-not-allowed")
                        : themeClasses.button
                    )}
                  >
                    Trước
                  </button>
                  <button
                    disabled={paymentHistoryPage >= Math.ceil(paymentHistoryTotal / paymentHistoryPageSize) || loadingPaymentHistory}
                    onClick={() => setPaymentHistoryPage((p) => Math.min(Math.ceil(paymentHistoryTotal / paymentHistoryPageSize), p + 1))}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      paymentHistoryPage >= Math.ceil(paymentHistoryTotal / paymentHistoryPageSize) || loadingPaymentHistory
                        ? (isDark ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : "bg-gray-300 text-gray-500 cursor-not-allowed")
                        : themeClasses.button
                    )}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </Surface>
        </Panel>
      </div>

      {/* Transaction Detail Modal */}
      {isModalOpen && selectedTransaction && currentOrgPlan && (
        <TransactionDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          transaction={selectedTransaction}
          currentOrgPlan={currentOrgPlan}
        />
      )}
    </>
  );
}
