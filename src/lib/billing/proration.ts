export interface ProrationResult {
  unusedCredit: number;           // Credit from old plan
  proratedNewPlanCost: number;    // Cost for remaining days in new plan
  amountDue: number;              // What user pays today
  daysRemaining: number;           // Days left in billing cycle
  message?: string;                // Optional message
}

/**
 * Calculate proration for plan upgrade using Option C (Instant Upgrade with Proration).
 * 
 * Formula:
 * 1. Calculate unused credit from current plan: (currentPrice / totalDays) × daysRemaining
 * 2. Calculate prorated new plan cost: (newPrice / totalDays) × daysRemaining
 * 3. Amount due = proratedNewPlanCost - unusedCredit
 * 
 * @example
 * ```ts
 * const result = calculateUpgradeProration({
 *   currentPlanPrice: 10,
 *   newPlanPrice: 25,
 *   billingCycleStartDate: new Date('2025-12-01'),
 *   billingCycleEndDate: new Date('2025-12-31'),
 *   upgradeDate: new Date('2025-12-15'),
 * });
 * 
 * // result.amountDue = 7.50
 * // result.unusedCredit = 5.00
 * // result.proratedNewPlanCost = 12.50
 * ```
 */
export function calculateUpgradeProration(params: {
  currentPlanPrice: number;
  newPlanPrice: number;
  billingCycleStartDate: Date;
  billingCycleEndDate: Date;
  upgradeDate: Date;
}): ProrationResult {
  const {
    currentPlanPrice,
    newPlanPrice,
    billingCycleStartDate,
    billingCycleEndDate,
    upgradeDate,
  } = params;

  // Calculate total days in billing cycle (usually 30)
  const totalDaysInCycle = Math.ceil(
    (billingCycleEndDate.getTime() - billingCycleStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate days remaining from upgrade date to end of cycle
  const daysRemaining = Math.ceil(
    (billingCycleEndDate.getTime() - upgradeDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Edge case: upgrading on last day
  if (daysRemaining <= 0) {
    return {
      unusedCredit: 0,
      proratedNewPlanCost: newPlanPrice, // Full month for new plan
      amountDue: newPlanPrice,
      daysRemaining: 0,
      message: "Billing cycle ended. Charging full price for new plan.",
    };
  }

  // Step 1: Calculate unused credit from current plan
  const dailyRateCurrentPlan = currentPlanPrice / totalDaysInCycle;
  const unusedCredit = dailyRateCurrentPlan * daysRemaining;

  // Step 2: Calculate prorated cost for new plan (remaining days)
  const dailyRateNewPlan = newPlanPrice / totalDaysInCycle;
  const proratedNewPlanCost = dailyRateNewPlan * daysRemaining;

  // Step 3: Amount due = prorated new plan - unused credit
  let amountDue = Math.max(0, proratedNewPlanCost - unusedCredit);

  // Handle extremely small amounts (make it free if below $0.50)
  // PayOS minimum is 3k VND (~$0.50), so we make upgrades free if below this threshold
  const MINIMUM_CHARGE = 0.50;
  if (amountDue > 0 && amountDue < MINIMUM_CHARGE) {
    return {
      unusedCredit: parseFloat(unusedCredit.toFixed(2)),
      proratedNewPlanCost: parseFloat(proratedNewPlanCost.toFixed(2)),
      amountDue: 0,
      daysRemaining,
      message: "Upgrade is free due to remaining credit!",
    };
  }

  return {
    unusedCredit: parseFloat(unusedCredit.toFixed(2)),
    proratedNewPlanCost: parseFloat(proratedNewPlanCost.toFixed(2)),
    amountDue: parseFloat(amountDue.toFixed(2)),
    daysRemaining,
  };
}

