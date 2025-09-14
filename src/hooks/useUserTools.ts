"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getMyMembership,
  getPlans,
  getUserAccessTools,
  type UserAccessTool,
  type Plan,
} from "@/lib/api";
import { PLAN_TOOL_MAP } from "@/config/planToolMap";

type UseUserToolsReturn = {
  loading: boolean;
  error: string | null;
  tools: UserAccessTool[];
  allowedToolIds: number[];
  plan: { planId: number; planName: string | null } | null;
  isAllowed: (arg: number | string) => boolean;
};

export function useUserTools(orgId: string): UseUserToolsReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [planId, setPlanId] = useState<number | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  const [allTools, setAllTools] = useState<UserAccessTool[]>([]);
  const [allowedToolIds, setAllowedToolIds] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const membership = await getMyMembership(orgId);
        if (!alive) return;
        const pid = membership?.planId ?? null;
        const pname = membership?.planName ?? null;
        setPlanId(pid);
        setPlanName(pname);

        const userTools = await getUserAccessTools();
        if (!alive) return;
        setAllTools(userTools);

        let allowed: number[] | null = null;
        try {
          const plans: Plan[] = await getPlans();
          if (!alive) return;
          const hit = Array.isArray(plans)
            ? plans.find((p) => Number(p.planId) === Number(pid))
            : undefined;
          const rawIds = (hit as Plan & { access_tool_ids?: (string | number)[] })?.access_tool_ids;
          if (rawIds && Array.isArray(rawIds)) {
            allowed = rawIds
              .map((n) => Number(n))
              .filter((n) => Number.isFinite(n));
          }
        } catch {
        }

        if (!allowed) {
          allowed = pid != null ? PLAN_TOOL_MAP[pid] ?? [] : [];
        }

        setAllowedToolIds(allowed ?? []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load tools/membership");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (orgId) void run();
    return () => {
      alive = false;
    };
  }, [orgId]);

  const tools = useMemo(() => {
    if (!allowedToolIds?.length) return [] as UserAccessTool[];
    return allTools.filter((t) =>
      allowedToolIds.includes(Number(t.accessToolId))
    );
  }, [allTools, allowedToolIds]);

  function isAllowed(arg: number | string): boolean {
    if (typeof arg === "number") return allowedToolIds.includes(arg);
    const hit = tools.find(
      (t) => t.name?.toLowerCase() === String(arg).toLowerCase()
    );
    return Boolean(hit);
  }

  return {
    loading,
    error,
    tools,
    allowedToolIds,
    plan: planId != null ? { planId, planName } : null,
    isAllowed,
  };
}
