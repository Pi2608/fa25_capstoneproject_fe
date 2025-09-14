"use client"

import { useEffect, useState } from "react"
import { getMe, type Me } from "@/lib/api"

export default function ProfileInfoPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(setMe)
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <h1 className="text-3xl font-semibold mb-4">Personal Information</h1>
      <p className="text-zinc-400">Your personal details are displayed here.</p>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Full Name</div>
          <div className="text-white font-medium">{loading ? "(loading...)" : me?.fullName ?? "-"}</div>
        </div>
        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Email</div>
          <div className="text-white font-medium">{loading ? "(loading...)" : me?.email ?? "-"}</div>
        </div>
        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Phone</div>
          <div className="text-white font-medium">{loading ? "(loading...)" : me?.phone ?? "-"}</div>
        </div>
      </div>
    </>
  )
}
