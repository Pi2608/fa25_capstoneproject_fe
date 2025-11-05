"use client";

import { useEffect, useMemo, useState } from "react";
import { getMe, type Me } from "@/lib/api-auth";
import {
  updateMyPersonalInfo,
  type UpdateUserPersonalInfoRequest,
  type UpdateUserPersonalInfoResponse,
} from "@/lib/api-user";

function initialsFrom(name?: string, email?: string) {
  const n = (name ?? "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "U";
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const e = email ?? "";
  return e ? e[0].toUpperCase() : "U";
}

export default function ThongTinCaNhanPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((m) => {
        setMe(m);
        setFullName(m.fullName ?? "");
        setPhone(m.phone ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => {
    if (!me) return false;
    return (fullName ?? "").trim() !== (me.fullName ?? "") || (phone ?? "").trim() !== (me.phone ?? "");
  }, [fullName, phone, me]);

  async function handleSave() {
    if (!me) return;
    setError(null);
    setOk(null);

    const safeFullName = (fullName ?? "").trim();
    const safePhone = (phone ?? "").trim();
    if (safePhone && !/^\+?\d{8,15}$/.test(safePhone)) {
      setError("Số điện thoại không hợp lệ.");
      return;
    }
    if (!dirty) {
      setEditing(false);
      return;
    }

    const payload: UpdateUserPersonalInfoRequest = { fullName: safeFullName, phone: safePhone };
    setSaving(true);
    try {
      const res: UpdateUserPersonalInfoResponse = await updateMyPersonalInfo(payload);
      setMe((prev) =>
        prev
          ? { ...prev, fullName: res.fullName ?? prev.fullName, phone: res.phone ?? prev.phone, email: res.email ?? prev.email }
          : prev
      );
      setFullName(res.fullName ?? "");
      setPhone(res.phone ?? "");
      setOk("Cập nhật thông tin thành công.");
      setEditing(false);
    } catch (e: unknown) {
      let message = "Cập nhật không thành công. Vui lòng thử lại.";
      if (e instanceof Error) message = e.message;
      else if (typeof e === "object" && e && "message" in e) {
        const msg = (e as { message?: unknown }).message;
        if (typeof msg === "string") message = msg;
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (!me) return;
    setFullName(me.fullName ?? "");
    setPhone(me.phone ?? "");
    setEditing(false);
    setError(null);
    setOk(null);
  }

  return (
    <div className="w-full">
      <div className="rounded-xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between gap-4 px-6 py-5 rounded-t-xl bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-500/10 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
              {initialsFrom(me?.fullName, me?.email)}
            </div>
            <div>
              <h1 className="text-lg font-semibold">Thông tin cá nhân</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Quản lý tên hiển thị, email và số điện thoại của bạn.
              </p>
            </div>
          </div>

          {!editing ? (
            <button
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={() => setEditing(true)}
              disabled={loading}
            >
              Chỉnh sửa
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                onClick={handleCancel}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}
        {ok && (
          <div className="mx-6 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            {ok}
          </div>
        )}

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Họ và tên
              </div>
              {!editing ? (
                <div className="text-sm font-medium">
                  {loading ? <div className="h-5 w-36 animate-pulse rounded bg-zinc-200 dark:bg-white/10" /> : me?.fullName ?? "-"}
                </div>
              ) : (
                <input
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-white/10 dark:bg-transparent"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                />
              )}
            </div>

            <div className="rounded-lg border border-zinc-200/70 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Email
              </div>
              <div className="text-sm font-medium">
                {loading ? <div className="h-5 w-56 animate-pulse rounded bg-zinc-200 dark:bg-white/10" /> : me?.email ?? "-"}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Không thể chỉnh sửa.</div>
            </div>

            <div className="lg:col-span-2 rounded-lg border border-zinc-200/70 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Số điện thoại
              </div>
              {!editing ? (
                <div className="text-sm font-medium">
                  {loading ? <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-white/10" /> : me?.phone ?? "-"}
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <input
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-white/10 dark:bg-transparent"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Nhập số điện thoại"
                    inputMode="tel"
                  />
                  <div className="hidden text-xs text-zinc-500 md:block">8–15 chữ số, cho phép tiền tố +</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="pointer-events-none fixed bottom-5 left-[300px] right-5 z-10">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/80">
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              {dirty ? "Bạn có thay đổi chưa lưu." : "Không có thay đổi."}
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                onClick={handleCancel}
                disabled={saving}
              >
                Hủy
              </button>
              <button
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
