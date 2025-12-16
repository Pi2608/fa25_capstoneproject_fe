"use client";

import React, { useEffect } from "react";
import { useTheme } from "next-themes";
import { X, AlertTriangle, CreditCard, ArrowUpCircle, XCircle } from "lucide-react";
import type { PendingTransactionDto, Plan } from "@/lib/api-membership";

interface PendingPaymentWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingTransaction: PendingTransactionDto;
  newPlan: Plan;
  organizationName: string;
  onAction: (action: 'upgrade' | 'continue' | 'cancel') => void;
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

export function PendingPaymentWarningModal({
  isOpen,
  onClose,
  pendingTransaction,
  newPlan,
  organizationName,
  onAction,
}: PendingPaymentWarningModalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Check if payment URL is expired
  const isExpired = pendingTransaction.expiresAt
    ? new Date(pendingTransaction.expiresAt) < new Date()
    : pendingTransaction.expiresInMinutes <= 0;

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

  if (!isOpen) return null;

  const isUpgrade = newPlan.priceMonthly! > pendingTransaction.amount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={cn(
        "relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border backdrop-blur-sm",
        isDark ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-amber-200/60"
      )}>

        {/* Header */}
        <div className={cn(
          "sticky top-0 px-6 py-4 border-b flex items-start gap-3 z-10",
          isDark ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-amber-200/60"
        )}>
          <div className={cn(
            "p-2 rounded-lg",
            isDark ? "bg-amber-500/10" : "bg-amber-50"
          )}>
            <AlertTriangle className={cn(
              "w-6 h-6",
              isDark ? "text-amber-400" : "text-amber-600"
            )} />
          </div>
          <div className="flex-1">
            <h2 className={cn(
              "text-xl font-semibold",
              isDark ? "text-zinc-50" : "text-zinc-900"
            )}>
              Pending Payment Detected
            </h2>
            <div className={cn(
              "text-sm mt-1",
              isDark ? "text-zinc-400" : "text-zinc-600"
            )}>
              Organization: {organizationName}
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
          {/* Warning Message */}
          <div className={cn(
            "p-4 rounded-lg border",
            isDark
              ? "bg-amber-500/10 border-amber-400/30"
              : "bg-amber-50 border-amber-300"
          )}>
            <div className={cn(
              "font-medium mb-2",
              isDark ? "text-amber-300" : "text-amber-700"
            )}>
              You have a pending payment for this organization
            </div>
            <div className={cn(
              "text-sm",
              isDark ? "text-amber-400" : "text-amber-600"
            )}>
              {isExpired ? (
                <>This payment link has expired. You can proceed with a new plan or cancel the old pending payment.</>
              ) : (
                <>Please choose what you'd like to do with your pending payment before proceeding with a new upgrade.</>
              )}
            </div>
          </div>

          {/* Transaction Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pending Transaction */}
            <div className={cn(
              "p-4 rounded-lg border",
              isDark ? "bg-zinc-900/60 border-zinc-700" : "bg-zinc-50 border-zinc-200"
            )}>
              <div className={cn(
                "text-xs font-medium mb-2 uppercase tracking-wide",
                isDark ? "text-zinc-400" : "text-zinc-600"
              )}>
                Current Pending Payment {isExpired && "(Expired)"}
              </div>
              <div className={cn(
                "text-lg font-semibold mb-1",
                isDark ? "text-zinc-200" : "text-zinc-900"
              )}>
                {pendingTransaction.planName}
              </div>
              <div className={cn(
                "text-2xl font-bold mb-3",
                isDark ? "text-amber-400" : "text-amber-600"
              )}>
                {formatCurrency(pendingTransaction.amount)}
              </div>
              <div className="space-y-1 text-sm">
                <div className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                  Created: {formatDate(pendingTransaction.createdAt)}
                </div>
                {!isExpired && pendingTransaction.expiresAt && (
                  <div className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                    Expires: {formatDate(pendingTransaction.expiresAt)}
                  </div>
                )}
                {!isExpired && (
                  <div className={cn(
                    "font-medium",
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  )}>
                    {pendingTransaction.expiresInMinutes} minutes remaining
                  </div>
                )}
              </div>
            </div>

            {/* New Plan */}
            <div className={cn(
              "p-4 rounded-lg border",
              isDark ? "bg-emerald-900/20 border-emerald-700/50" : "bg-emerald-50 border-emerald-200"
            )}>
              <div className={cn(
                "text-xs font-medium mb-2 uppercase tracking-wide",
                isDark ? "text-emerald-400" : "text-emerald-700"
              )}>
                New Plan You're Selecting
              </div>
              <div className={cn(
                "text-lg font-semibold mb-1",
                isDark ? "text-zinc-200" : "text-zinc-900"
              )}>
                {newPlan.planName}
              </div>
              <div className={cn(
                "text-2xl font-bold mb-3",
                isDark ? "text-emerald-400" : "text-emerald-600"
              )}>
                {formatCurrency(newPlan.priceMonthly || 0)}
              </div>
              <div className="space-y-1 text-sm">
                <div className={isDark ? "text-zinc-400" : "text-zinc-600"}>
                  Duration: {newPlan.durationMonths} month{newPlan.durationMonths !== 1 ? 's' : ''}
                </div>
                {isUpgrade && (
                  <div className={cn(
                    "font-medium flex items-center gap-1",
                    isDark ? "text-emerald-400" : "text-emerald-600"
                  )}>
                    <ArrowUpCircle size={14} />
                    Higher tier upgrade
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Description */}
          <div className={cn(
            "text-sm",
            isDark ? "text-zinc-400" : "text-zinc-600"
          )}>
            <strong>What happens next?</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {isExpired ? (
                <>
                  <li><strong>Proceed with {newPlan.planName}:</strong> Cancel expired pending payment and start new payment flow</li>
                  <li><strong>Cancel & Go Back:</strong> Cancel the expired pending payment and return to plans page</li>
                </>
              ) : (
                <>
                  <li><strong>Upgrade to {newPlan.planName}:</strong> Cancel pending {pendingTransaction.planName} and create new payment for {newPlan.planName}</li>
                  <li><strong>Continue {pendingTransaction.planName} Payment:</strong> Complete your existing pending payment (recommended if link hasn't expired)</li>
                  <li><strong>Cancel & Go Back:</strong> Cancel pending payment and return to plans page</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={cn(
          "sticky bottom-0 px-6 py-4 border-t flex flex-wrap gap-3 justify-end",
          isDark ? "bg-zinc-950/90 border-white/10" : "bg-white/90 border-amber-200/60"
        )}>
          {!isExpired && (
            <button
              onClick={() => onAction('continue')}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium",
                isDark
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              <CreditCard size={16} />
              Continue {pendingTransaction.planName} ({formatCurrency(pendingTransaction.amount)})
            </button>
          )}

          <button
            onClick={() => onAction('upgrade')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium",
              isDark
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            <ArrowUpCircle size={16} />
            {isExpired ? `Proceed with ${newPlan.planName}` : `Upgrade to ${newPlan.planName}`}
          </button>

          <button
            onClick={() => onAction('cancel')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors font-medium",
              isDark
                ? "bg-rose-900/20 hover:bg-rose-900/30 text-rose-300 border-rose-700"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300"
            )}
          >
            <XCircle size={16} />
            Cancel Pending & Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
