"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrganization, type OrganizationReqDto } from "@/lib/api";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgName.trim()) {
      setError("Tên tổ chức là bắt buộc.");
      return;
    }
    if (!abbreviation.trim()) {
      setError("Tên viết tắt là bắt buộc.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: OrganizationReqDto = {
        orgName: orgName.trim(),
        abbreviation: abbreviation.trim().toUpperCase(),
      };
      await createOrganization(payload); 
      router.push("/profile"); 
    } catch (err) {
      const msg =
        typeof err === "object" && err && "message" in err
          ? (err as { message?: string }).message
          : "Tạo tổ chức thất bại.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 text-white">
      <h1 className="text-2xl font-bold mb-6">Tạo tổ chức</h1>

      <form
        onSubmit={onSubmit}
        className="space-y-6 bg-zinc-900/50 rounded-xl border border-white/10 p-6"
      >
        {error && (
          <div className="text-sm rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm mb-2">Tên tổ chức *</label>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Nhập tên tổ chức..."
            required
            className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-white/10
                       focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>

        <div>
          <label className="block text-sm mb-2">Viết tắt *</label>
          <input
            type="text"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            placeholder="VD: CMO, ABC..."
            required
            className="w-full rounded-md px-3 py-2 bg-zinc-800 border border-white/10
                       focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition disabled:opacity-60"
          >
            {submitting ? "Đang tạo..." : "Tạo tổ chức"}
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition"
          >
            Hủy
          </button>
        </div>
      </form>
    </main>
  );
}
