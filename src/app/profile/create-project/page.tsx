"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  createOrganization,
  type OrganizationReqDto,
  getPlans,
  type Plan,
  processPayment,
  type ProcessPaymentReq,
  type ProcessPaymentRes,
} from "@/lib/api"

type JwtPayload = Record<string, unknown>
function getMyIdentityFromToken(): { userId?: string | null } {
  if (typeof window === "undefined") return { userId: null }
  const token = localStorage.getItem("token")
  if (!token) return { userId: null }
  const parts = token.split(".")
  if (parts.length !== 3) return { userId: null }
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8")
    const p = JSON.parse(json) as JwtPayload

    const userId =
      (typeof p.userId === "string" && p.userId) ||
      (typeof p.uid === "string" && p.uid) ||
      (typeof p.sub === "string" && p.sub) ||
      (typeof p.nameid === "string" && p.nameid) ||
      (typeof p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] === "string" &&
        (p["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] as string)) ||
      null

    return { userId }
  } catch {
    return { userId: null }
  }
}

function toMessage(err: unknown, fallback = "Request failed."): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m
  }
  return fallback
}

function formatUSD(n?: number | null) {
  const v = typeof n === "number" ? n : 0
  return `$${v.toFixed(2)}`
}

export default function CreateOrganizationPage() {
  const router = useRouter()

  const [orgName, setOrgName] = useState("")
  const [abbreviation, setAbbreviation] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null)

  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [plansErr, setPlansErr] = useState<string | null>(null)

  const me = useMemo(getMyIdentityFromToken, [])
  const myUserId = me.userId ?? undefined

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    setError(null)

    if (!orgName.trim()) {
      setError("Organization name is required.")
      return
    }
    if (!abbreviation.trim()) {
      setError("Abbreviation is required.")
      return
    }

    setSubmitting(true)
    try {
      const payload: OrganizationReqDto = {
        orgName: orgName.trim(),
        abbreviation: abbreviation.trim().toUpperCase(),
      }
      const res = await createOrganization(payload)

      const oid =
        (res as { orgId?: string })?.orgId ??
        (res as { organizationId?: string })?.organizationId ??
        (res as { result?: string })?.result ??
        null

      if (!oid) {
        router.push("/profile")
        return
      }

      setCreatedOrgId(oid)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("orgs-changed"))
      }
    } catch (err) {
      setError(toMessage(err, "Failed to create organization."))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!createdOrgId) return
    let alive = true
    setLoadingPlans(true)
    setPlansErr(null)
    getPlans()
      .then((ps) => {
        if (!alive) return
        setPlans(ps)
      })
      .catch((e) => {
        if (!alive) return
        setPlansErr(toMessage(e, "Failed to load plans."))
      })
      .finally(() => {
        if (alive) setLoadingPlans(false)
      })
    return () => {
      alive = false
    }
  }, [createdOrgId])

  async function subscribe(plan: Plan) {
    try {
      if (!createdOrgId) return
      const req: ProcessPaymentReq = {
        paymentGateway: "payOS",
        purpose: "membership",
        total: plan.priceMonthly ?? 0,
        PlanId: plan.planId,
        OrgId: createdOrgId,
        UserId: myUserId,
        AutoRenew: true,
      }
      const res: ProcessPaymentRes = await processPayment(req)
      localStorage.setItem("planId", String(plan.planId))
      window.location.href = res.approvalUrl
    } catch (e) {
      alert(toMessage(e))
    }
  }

  if (!createdOrgId) {
    const disabled = submitting
    return (
      <main className="max-w-2xl mx-auto px-6 py-10 text-white">
        <h1 className="text-2xl font-bold mb-6">Create Organization</h1>

        <form onSubmit={onSubmit} className="space-y-6 bg-zinc-900/50 rounded-xl border border-white/10 p-6">
          {error && (
            <div role="alert" className="text-sm rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="org-name" className="block text-sm mb-2">Organization Name *</label>
            <input
              id="org-name"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Enter organization name…"
              required
              disabled={disabled}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="org-abb" className="block text-sm mb-2">Abbreviation *</label>
            <input
              id="org-abb"
              type="text"
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value)}
              placeholder="e.g., CMO, ABC…"
              required
              disabled={disabled}
              maxLength={10}
              className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-60"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => history.back()}
              disabled={disabled}
              className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 text-white">
      <h1 className="text-2xl font-bold">Choose Plan</h1>
      <p className="text-zinc-400 mt-1">Organization created successfully. Select a plan for this organization.</p>

      {plansErr && (
        <div className="mt-4 rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-200 text-sm">
          {plansErr}
        </div>
      )}

      {loadingPlans ? (
        <div className="mt-6 text-sm text-zinc-400">Loading plans…</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const isFree = (p.priceMonthly ?? 0) <= 0
            return (
              <div
                key={p.planId}
                className="relative rounded-2xl border border-white/10 p-6 bg-zinc-900/50 backdrop-blur-sm shadow-lg transition hover:-translate-y-0.5 hover:ring-1 hover:ring-emerald-400/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-semibold">{p.planName}</div>
                </div>

                <p className="mt-1 text-sm text-zinc-400">{p.description}</p>

                <div className="mt-5">
                  <span className="text-2xl font-bold text-emerald-400">
                    {isFree ? "$0.00" : formatUSD(p.priceMonthly)}
                  </span>
                  <span className="ml-1 text-sm text-zinc-400">/month</span>
                </div>

                <div className="mt-5 flex gap-3">
                  {isFree ? (
                    <button
                      onClick={() => router.push(`/organizations/${createdOrgId}?justCreated=1`)}
                      className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
                    >
                      Continue with Free
                    </button>
                  ) : (
                    <button
                      onClick={() => subscribe(p)}
                      className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
                    >
                      Subscribe
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8">
        <button
          onClick={() => router.push(`/organizations/${createdOrgId}?justCreated=1`)}
          className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
        >
          Skip for now
        </button>
      </div>
    </main>
  )
}
