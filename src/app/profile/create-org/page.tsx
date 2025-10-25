"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  createOrganization,
  type OrganizationReqDto,
  getPlans,
  type Plan,
  subscribeToPlan,
  type SubscribeRequest,
  type SubscribeResponse,
  confirmPayment,
  type PaymentConfirmationRequest,
  cancelPayment,
  type CancelPaymentRequest,
  getMyOrganizations,
  type MyOrganizationDto,
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

function pickOrgIdFromCreateRes(x: unknown): string | null {
  if (!x || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  const cands: unknown[] = []
  if (typeof o.orgId === "string") cands.push(o.orgId)
  if (typeof o.organizationId === "string") cands.push(o.organizationId)
  if (o.organization && typeof o.organization === "object") {
    const org = o.organization as Record<string, unknown>
    if (typeof org.orgId === "string") cands.push(org.orgId)
    if (typeof org.organizationId === "string") cands.push(org.organizationId)
  }
  if (o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>
    if (typeof d.orgId === "string") cands.push(d.orgId)
    if (typeof d.organizationId === "string") cands.push(d.organizationId)
  }
  for (const c of cands) if (typeof c === "string" && c.trim()) return c
  return null
}

function pickNewestOrgId(list: MyOrganizationDto[], name: string, abb: string): string | null {
  const exact =
    list.find(
      (o) =>
        (o.orgName ?? "").trim().toLowerCase() === name.trim().toLowerCase() &&
        (o.abbreviation ?? "").trim().toUpperCase() === abb.trim().toUpperCase()
    ) ?? null
  if (exact?.orgId) return exact.orgId
  const sorted = [...list].sort((a, b) => {
    const ad = new Date(a.joinedAt ?? 0).getTime()
    const bd = new Date(b.joinedAt ?? 0).getTime()
    return ad - bd
  })
  const newest = sorted.length ? sorted[sorted.length - 1] : undefined
  return newest?.orgId ?? null
}

// Component that handles search params
function CreateOrganizationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orgName, setOrgName] = useState("")
  const [abbreviation, setAbbreviation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null)

  const [plans, setPlans] = useState<Plan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)
  const [plansErr, setPlansErr] = useState<string | null>(null)

  const [popup, setPopup] = useState<{ type: "success" | "cancel"; msg: string } | null>(null)

  const me = useMemo(getMyIdentityFromToken, [])
  const myUserId = me.userId ?? undefined

  function gotoOrgOrProfile(targetId: string | null) {
    if (targetId && targetId.trim()) {
      router.push(`/profile/organizations/${targetId}?justCreated=1`)
    } else {
      router.push("/profile")
    }
  }

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
      let oid = pickOrgIdFromCreateRes(res)
      if (!oid) {
        try {
          const mine = await getMyOrganizations()
          const list = Array.isArray(mine.organizations) ? mine.organizations : []
          oid = pickNewestOrgId(list, payload.orgName, payload.abbreviation)
        } catch {
          oid = null
        }
      }
      setCreatedOrgId(oid)
      if (typeof window !== "undefined" && oid) {
        window.dispatchEvent(new Event("orgs-changed"))
        sessionStorage.setItem("lastCreatedOrgId", oid)
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

  // Handle payment confirmation from PayOS redirect
  useEffect(() => {
    const transactionId = searchParams?.get("transactionId") ?? null
    const code = searchParams?.get("code") ?? null
    const cancel = searchParams?.get("cancel") ?? null
    const status = searchParams?.get("status") ?? null
    const orderCode = searchParams?.get("orderCode") ?? null
    const paymentId = searchParams?.get("id") ?? null // PayOS sends 'id' parameter

    if (!transactionId) return

    let finalStatus: "success" | "cancel" | null = null

    console.log({ transactionId, code, cancel, status, orderCode, paymentId })

    // PayOS success: code=00, cancel=false, status=PAID
    if (code === "00" && cancel === "false" && status?.toUpperCase() === "PAID") {
      finalStatus = "success"
    }
    // PayOS cancel: cancel=true OR status=CANCELLED
    else if (cancel === "true" || status?.toUpperCase() === "CANCELLED") {
      finalStatus = "cancel"
    }

    console.log({ finalStatus })

    if (finalStatus === "success") {
      const req: PaymentConfirmationRequest = {
        paymentGateway: "payOS",
        paymentId: paymentId ?? "",
        orderCode: orderCode ?? "",
        purpose: "membership",
        transactionId,
        status: "success",
      }

      confirmPayment(req)
        .then(() => setPopup({ type: "success", msg: "Thanh toán thành công!" }))
        .catch((res) => { setPopup({ type: "cancel", msg: "Thanh toán thất bại." }); console.log(res); })
    }

    if (finalStatus === "cancel") {
      const req: CancelPaymentRequest = {
        paymentGateway: "payOS",
        transactionId,
        paymentId: paymentId ?? "",
        orderCode: orderCode ?? "",
      }

      cancelPayment(req)
        .then(() => setPopup({ type: "cancel", msg: "Bạn đã hủy thanh toán." }))
        .catch(() => setPopup({ type: "cancel", msg: "Có lỗi khi hủy giao dịch." }))
    }
  }, [searchParams])

  async function subscribe(plan: Plan) {
    try {
      if (!createdOrgId || !myUserId) {
        router.push("/profile")
        return
      }
      const req: SubscribeRequest = {
        userId: myUserId,
        orgId: createdOrgId,
        planId: plan.planId,
        paymentMethod: "payOS",
        autoRenew: true,
      }
      const res: SubscribeResponse = await subscribeToPlan(req)
      localStorage.setItem("planId", String(plan.planId))
      window.location.href = res.paymentUrl
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
              onClick={() => router.push("/profile")}
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
                      onClick={() => gotoOrgOrProfile(createdOrgId)}
                      className="flex-1 rounded-xl bg-emerald-500/90 hover:bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950"
                    >
                      Continue with Free
                    </button>
                  ) : (
                    <button
                      onClick={() => void subscribe(p)}
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
          onClick={() => gotoOrgOrProfile(createdOrgId)}
          className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
        >
          Skip for now
        </button>
      </div>

      {/* Payment Result Popup */}
      {popup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-zinc-900 text-white rounded-xl p-6 max-w-sm">
            <h2 className="text-3xl font-semibold mb-4">
              {popup.type === "success" ? "Payment success" : "Payment failed"}
            </h2>
            <p>{popup.msg}</p>
            <button
              onClick={() => {
                setPopup(null)
                router.replace("/profile/create-org")
                localStorage.removeItem("planId")
              }}
              className="mt-4 px-4 py-2 rounded bg-emerald-500 text-black"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  )
}

// Main export with Suspense boundary
export default function CreateOrganizationPage() {
  return (
    <Suspense fallback={
      <main className="max-w-2xl mx-auto px-6 py-10 text-white">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-400 border-t-transparent"></div>
          <span className="ml-3 text-zinc-400">Loading...</span>
        </div>
      </main>
    }>
      <CreateOrganizationPageContent />
    </Suspense>
  )
}
