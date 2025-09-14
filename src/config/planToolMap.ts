export const PLAN_TOOL_MAP: Record<number, number[]> = {
  // Free
  1: [1,2,3,4,5,6,7,8,9,10,11],
  // Pro
  2: Array.from({ length: 28 }, (_, i) => i + 1),
  // Enterprise
  3: Array.from({ length: 31 }, (_, i) => i + 1),
};
