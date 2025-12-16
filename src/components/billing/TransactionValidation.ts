import { PaymentHistoryItem, Plan } from "@/lib/api-membership";

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export function validateTransaction(
  transaction: PaymentHistoryItem,
  currentOrgPlan: Plan
): ValidationResult {
  // Only validate pending transactions
  if (transaction.status?.toLowerCase() !== "pending") {
    return { isValid: true };
  }

  // Get target plan details
  const targetPlanPrice = transaction.plannedPlan?.priceMonthly || 0;
  const targetPlanName = transaction.plannedPlan?.planName || "Unknown";

  // Get current plan details
  const currentPlanPrice = currentOrgPlan.priceMonthly || 0;
  const currentPlanName = currentOrgPlan.planName;

  // Validation: Target plan must be higher tier than current plan
  if (targetPlanPrice <= currentPlanPrice) {
    return {
      isValid: false,
      reason: `Organization already has ${currentPlanName}. This upgrade to ${targetPlanName} is no longer needed.`
    };
  }

  return { isValid: true };
}
