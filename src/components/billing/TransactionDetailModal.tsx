"use client";

import React, { useEffect } from "react";
import { PaymentHistoryItem, Plan, retryPayment } from "@/lib/api-membership";
import { useTheme } from "next-themes";
import { useI18n } from "@/i18n/I18nProvider";
import { Download, Copy, CreditCard, X } from "lucide-react";
import { validateTransaction } from "./TransactionValidation";
import { getToken } from "@/lib/api-core";
import { useToast } from "@/contexts/ToastContext";
interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: PaymentHistoryItem;
  currentOrgPlan: Plan;
}

function cn(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "N/A";
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  currentOrgPlan
}: TransactionDetailModalProps) {
  const { resolvedTheme } = useTheme();
  const { t } = useI18n();
  const isDark = resolvedTheme === "dark";
  const { showToast } = useToast();

  // Validation
  const validation = validateTransaction(transaction, currentOrgPlan);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Handlers
  const handleDownloadReceipt = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!base) {
        throw new Error("Missing env: NEXT_PUBLIC_API_BASE_URL");
      }

      const token = getToken();
      const headers: Record<string, string> = {
        'Accept': 'application/pdf',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${base}/payment/receipt/${transaction.transactionId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${transaction.transactionId}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast("success", t("billing.toast_receipt_downloaded"));
    } catch (error) {
      console.error("Failed to download receipt:", error);
      showToast("error", t("billing.toast_receipt_failed"));
    }
  };

  const handleCopyTransactionId = async () => {
    try {
      await navigator.clipboard.writeText(transaction.transactionId);
      showToast("success", t("billing.toast_id_copied"));
    } catch (error) {
      console.error("Failed to copy:", error);
      showToast("error", t("billing.toast_copy_failed"));
      // Fallback: select the text
      const elem = document.getElementById("transaction-id-text");
      if (elem) {
        const range = document.createRange();
        range.selectNodeContents(elem);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  const handleContinuePayment = async () => {
    try {
      const response = await retryPayment({ transactionId: transaction.transactionId });
      if (!response.paymentUrl || response.paymentUrl.trim() === "") {
        throw new Error("No payment URL returned");
      }

      localStorage.setItem("pendingPaymentTransactionId", transaction.transactionId);
      window.location.href = response.paymentUrl;
    } catch (error) {
      console.error("Failed to continue payment:", error);
      showToast("error", t("billing.toast_payment_failed"));
    }
  };

  if (!isOpen) return null;

  const isPending = transaction.status?.toLowerCase() === "pending";
  const isCompleted = transaction.status?.toLowerCase() === "success" || transaction.status?.toLowerCase() === "paid";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        "relative max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border backdrop-blur-sm",
        isDark ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-emerald-200/60"
      )}>

        {/* Header */}
        <div className={cn(
          "sticky top-0 px-6 py-4 border-b flex justify-between items-start z-10",
          isDark ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-emerald-200/60"
        )}>
          <div>
            <h2 className={cn(
              "text-xl font-semibold",
              isDark ? "text-zinc-50" : "text-zinc-900"
            )}>
              {t("billing.modal_title")}
            </h2>
            <div className={cn(
              "text-sm mt-1",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              {t("billing.modal_org_label")} {transaction.membership?.organization?.orgName || "N/A"} |{" "}
              {t("billing.modal_current_label")} {currentOrgPlan.planName} → {t("billing.modal_target_label")} {transaction.plannedPlan?.planName || "N/A"}
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
            )}
          >
            <X size={20} className={isDark ? "text-zinc-400" : "text-zinc-600"} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Transaction Info Section */}
          <section>
            <h3 className={cn(
              "text-lg font-semibold mb-3",
              isDark ? "text-zinc-50" : "text-zinc-900"
            )}>
              {t("billing.modal_transaction_info")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className={cn(
                  "text-sm font-medium",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {t("billing.modal_transaction_id")}
                </div>
                <div
                  id="transaction-id-text"
                  className={cn(
                    "mt-1 font-mono text-sm",
                    isDark ? "text-zinc-200" : "text-zinc-900"
                  )}
                >
                  {transaction.transactionId}
                </div>
              </div>
              <div>
                <div className={cn(
                  "text-sm font-medium",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {t("billing.modal_date")}
                </div>
                <div className={cn(
                  "mt-1",
                  isDark ? "text-zinc-200" : "text-zinc-900"
                )}>
                  {formatDate(transaction.transactionDate || transaction.createdAt)}
                </div>
              </div>
              <div>
                <div className={cn(
                  "text-sm font-medium",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {t("billing.modal_status")}
                </div>
                <div className="mt-1">
                  <StatusBadge status={transaction.status} />
                </div>
              </div>
              <div>
                <div className={cn(
                  "text-sm font-medium",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {t("billing.modal_amount")}
                </div>
                <div className={cn(
                  "mt-1 text-lg font-semibold",
                  isDark ? "text-zinc-200" : "text-zinc-900"
                )}>
                  {formatCurrency(transaction.amount)}
                </div>
              </div>
              {transaction.paymentGateway && (
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  )}>
                    {t("billing.modal_payment_gateway")}
                  </div>
                  <div className={cn(
                    "mt-1",
                    isDark ? "text-zinc-200" : "text-zinc-900"
                  )}>
                    {transaction.paymentGateway.name}
                  </div>
                </div>
              )}
              {transaction.transactionReference && (
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    isDark ? "text-zinc-400" : "text-zinc-600"
                  )}>
                    {t("billing.modal_payment_reference")}
                  </div>
                  <div className={cn(
                    "mt-1 font-mono text-sm",
                    isDark ? "text-zinc-200" : "text-zinc-900"
                  )}>
                    {transaction.transactionReference}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Plan Details Section */}
          {transaction.plannedPlan && (
            <section>
              <h3 className={cn(
                "text-lg font-semibold mb-3",
                isDark ? "text-zinc-50" : "text-zinc-900"
              )}>
                {t("billing.modal_plan_details")}: {transaction.plannedPlan.planName}
              </h3>

              {transaction.plannedPlan.description && (
                <p className={cn(
                  "text-sm mb-4",
                  isDark ? "text-zinc-400" : "text-zinc-600"
                )}>
                  {transaction.plannedPlan.description}
                </p>
              )}

              {/* Pricing & Duration */}
              <div className="mb-4">
                <h4 className={cn(
                  "text-sm font-semibold mb-2",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  {t("billing.modal_pricing_duration")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>{t("billing.modal_monthly_price")}</span>
                    <span className={cn("ml-2 font-medium", isDark ? "text-zinc-200" : "text-zinc-900")}>
                      {formatCurrency(transaction.plannedPlan.priceMonthly || 0)}
                    </span>
                  </div>
                  <div>
                    <span className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>{t("billing.modal_duration")}</span>
                    <span className={cn("ml-2 font-medium", isDark ? "text-zinc-200" : "text-zinc-900")}>
                      {transaction.plannedPlan.durationMonths} {transaction.plannedPlan.durationMonths !== 1 ? t("billing.modal_months") : t("billing.modal_month")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quotas */}
              <div className="mb-4">
                <h4 className={cn(
                  "text-sm font-semibold mb-2",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  {t("billing.modal_quotas")}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <QuotaItem label={t("billing.modal_maps")} value={transaction.plannedPlan.mapQuota} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_exports")} value={transaction.plannedPlan.exportQuota} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_users")} value={transaction.plannedPlan.maxUsersPerOrg} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_locations")} value={transaction.plannedPlan.maxLocationsPerOrg} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_maps_per_month")} value={transaction.plannedPlan.maxMapsPerMonth} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_custom_layers")} value={transaction.plannedPlan.maxCustomLayers} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_monthly_tokens")} value={transaction.plannedPlan.monthlyTokens} isDark={isDark} />
                </div>
              </div>

              {/* Interactive Features */}
              <div className="mb-4">
                <h4 className={cn(
                  "text-sm font-semibold mb-2",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  {t("billing.modal_interactive_features")}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <QuotaItem label={t("billing.modal_interactions_per_map")} value={transaction.plannedPlan.maxInteractionsPerMap} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_connections_per_map")} value={transaction.plannedPlan.maxConnectionsPerMap} isDark={isDark} />
                  <QuotaItem label={t("billing.modal_media_size")} value={formatFileSize(transaction.plannedPlan.maxMediaFileSizeBytes)} isDark={isDark} isString />
                  <QuotaItem label={t("billing.modal_video_size")} value={formatFileSize(transaction.plannedPlan.maxVideoFileSizeBytes)} isDark={isDark} isString />
                  <QuotaItem label={t("billing.modal_audio_size")} value={formatFileSize(transaction.plannedPlan.maxAudioFileSizeBytes)} isDark={isDark} isString />
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className={cn(
                  "text-sm font-semibold mb-2",
                  isDark ? "text-zinc-300" : "text-zinc-700"
                )}>
                  {t("billing.modal_features")}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <FeatureItem label={t("billing.modal_video_content")} enabled={transaction.plannedPlan.allowVideoContent} isDark={isDark} yesText={t("billing.modal_yes")} noText={t("billing.modal_no")} />
                  <FeatureItem label={t("billing.modal_audio_content")} enabled={transaction.plannedPlan.allowAudioContent} isDark={isDark} yesText={t("billing.modal_yes")} noText={t("billing.modal_no")} />
                  <FeatureItem label={t("billing.modal_animated_connections")} enabled={transaction.plannedPlan.allowAnimatedConnections} isDark={isDark} yesText={t("billing.modal_yes")} noText={t("billing.modal_no")} />
                  <FeatureItem label={t("billing.modal_priority_support")} enabled={transaction.plannedPlan.prioritySupport} isDark={isDark} yesText={t("billing.modal_yes")} noText={t("billing.modal_no")} />
                </div>
              </div>
            </section>
          )}

          {/* Warning for invalid transactions */}
          {!validation.isValid && isPending && (
            <div className={cn(
              "p-4 rounded-lg border",
              isDark
                ? "bg-amber-500/10 border-amber-400/30"
                : "bg-amber-50 border-amber-300"
            )}>
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-lg">⚠️</span>
                <div>
                  <div className={cn(
                    "font-medium",
                    isDark ? "text-amber-300" : "text-amber-700"
                  )}>
                    {t("billing.modal_warning_invalid")}
                  </div>
                  <div className={cn(
                    "text-sm mt-1",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )}>
                    {validation.reason}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={cn(
          "sticky bottom-0 px-6 py-4 border-t flex flex-wrap gap-3 justify-end",
          isDark ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-emerald-200/60"
        )}>
          {isCompleted && (
            <button
              onClick={handleDownloadReceipt}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              <Download size={16} />
              {t("billing.modal_btn_download_receipt")}
            </button>
          )}

          <button
            onClick={handleCopyTransactionId}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              isDark
                ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                : "bg-zinc-200 hover:bg-zinc-300 text-zinc-700"
            )}
          >
            <Copy size={16} />
            {t("billing.modal_btn_copy_id")}
          </button>

          {isPending && (
            <button
              onClick={handleContinuePayment}
              disabled={!validation.isValid}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                validation.isValid
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-zinc-300 text-zinc-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-600"
              )}
            >
              <CreditCard size={16} />
              {t("billing.modal_btn_continue_payment")}
            </button>
          )}

          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg border transition-colors",
              isDark
                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-600"
                : "bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-300"
            )}
          >
            {t("billing.modal_btn_close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  let cls =
    "border-zinc-300 text-zinc-700 bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:bg-zinc-900/50";
  if (s === "success" || s === "paid")
    cls =
      "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-300 dark:bg-emerald-500/10";
  else if (s === "pending")
    cls =
      "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-400/30 tracking-tight dark:bg-amber-500/10";
  else if (s === "cancelled" || s === "failed")
    cls =
      "border-rose-300 text-rose-700 bg-rose-50 dark:border-rose-400/30 dark:text-rose-300 dark:bg-rose-500/10";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium", cls)}>
      {status}
    </span>
  );
}

function QuotaItem({ label, value, isDark, isString = false }: { label: string; value: any; isDark: boolean; isString?: boolean }) {
  return (
    <div>
      <span className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>{label}:</span>
      <span className={cn("ml-2 font-medium", isDark ? "text-zinc-200" : "text-zinc-900")}>
        {isString ? value : (value?.toLocaleString() || "N/A")}
      </span>
    </div>
  );
}

function FeatureItem({ label, enabled, isDark, yesText, noText }: { label: string; enabled?: boolean; isDark: boolean; yesText: string; noText: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm", isDark ? "text-zinc-400" : "text-zinc-600")}>{label}:</span>
      <span className={cn(
        "text-sm font-medium",
        enabled
          ? (isDark ? "text-emerald-400" : "text-emerald-600")
          : (isDark ? "text-rose-400" : "text-rose-600")
      )}>
        {enabled ? yesText : noText}
      </span>
    </div>
  );
}
