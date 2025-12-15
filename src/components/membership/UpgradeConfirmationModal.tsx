"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, DollarSign } from "lucide-react";
import { calculateUpgradeProration } from "@/lib/billing/proration";

interface UpgradeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: {
    id: number;
    name: string;
    price: number;
  };
  newPlan: {
    id: number;
    name: string;
    price: number;
  };
  billingCycleStartDate: Date;
  billingCycleEndDate: Date;
  onConfirmUpgrade: () => Promise<void>;
}

export function UpgradeConfirmationModal({
  open,
  onOpenChange,
  currentPlan,
  newPlan,
  billingCycleStartDate,
  billingCycleEndDate,
  onConfirmUpgrade,
}: UpgradeConfirmationModalProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [proration, setProration] = useState<ReturnType<typeof calculateUpgradeProration> | null>(null);

  useEffect(() => {
    if (open) {
      const result = calculateUpgradeProration({
        currentPlanPrice: currentPlan.price,
        newPlanPrice: newPlan.price,
        billingCycleStartDate,
        billingCycleEndDate,
        upgradeDate: new Date(),
      });
      setProration(result);
    }
  }, [open, currentPlan, newPlan, billingCycleStartDate, billingCycleEndDate]);

  const handleUpgrade = async () => {
    setIsUpgrading(true);
    try {
      await onConfirmUpgrade();
      onOpenChange(false);
    } catch (error) {
      // Error handling should be done in parent component
      console.error("Upgrade failed:", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  if (!open || !proration) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800/80">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold leading-snug text-zinc-100">
              Upgrade Plan Confirmation
            </h3>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
            disabled={isUpgrading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* Plan Change Visual */}
          <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
            <div className="text-center">
              <div className="text-sm text-zinc-400">Current Plan</div>
              <div className="text-lg font-semibold text-zinc-100">{currentPlan.name}</div>
              <div className="text-sm text-zinc-500">${currentPlan.price}/mo</div>
            </div>
            <ArrowRight className="h-6 w-6 text-emerald-500" />
            <div className="text-center">
              <div className="text-sm text-zinc-400">New Plan</div>
              <div className="text-lg font-semibold text-emerald-500">{newPlan.name}</div>
              <div className="text-sm text-zinc-500">${newPlan.price}/mo</div>
            </div>
          </div>

          {/* Proration Breakdown */}
          <div className="space-y-3 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
            <h4 className="text-sm font-medium text-zinc-300">Payment Breakdown</h4>
            <div className="space-y-2 text-sm">
              {/* Unused credit */}
              <div className="flex justify-between">
                <span className="text-zinc-400">
                  Unused credit ({proration.daysRemaining} days remaining)
                </span>
                <span className="text-emerald-500">-${proration.unusedCredit.toFixed(2)}</span>
              </div>
              {/* Prorated new plan cost */}
              <div className="flex justify-between">
                <span className="text-zinc-400">
                  {newPlan.name} (prorated for {proration.daysRemaining} days)
                </span>
                <span className="text-zinc-100">+${proration.proratedNewPlanCost.toFixed(2)}</span>
              </div>
              {/* Divider */}
              <div className="border-t border-zinc-700 my-2" />
              {/* Total */}
              <div className="flex justify-between text-base font-semibold">
                <span className="text-zinc-100">Amount Due Today</span>
                <span className="text-emerald-500">${proration.amountDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Message if free upgrade */}
          {proration.message && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-400">{proration.message}</p>
            </div>
          )}

          {/* Next billing info */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400">
              ℹ️ Your next billing on {billingCycleEndDate.toLocaleDateString()} will be ${newPlan.price}/month for {newPlan.name} plan.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-zinc-900/70 border-t border-zinc-800/80">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpgrading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isUpgrading ? (
              "Processing..."
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                {proration.amountDue === 0 
                  ? "Upgrade for Free" 
                  : `Pay $${proration.amountDue.toFixed(2)} & Upgrade`}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

