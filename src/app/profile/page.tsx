"use client";

import { getMe, Me } from "@/lib/api-auth";
import { updateMyPersonalInfo, UpdateUserPersonalInfoRequest, UpdateUserPersonalInfoResponse } from "@/lib/api-user";
import { useEffect, useMemo, useState } from "react";


export default function ThongTinCaNhanPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

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
    const meFull = me.fullName ?? "";
    const mePhone = me.phone ?? "";
    return (fullName ?? "").trim() !== meFull || (phone ?? "").trim() !== mePhone;
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

    const payload: UpdateUserPersonalInfoRequest = {
      fullName: safeFullName,
      phone: safePhone,
    };

    setSaving(true);
    try {
      const res: UpdateUserPersonalInfoResponse = await updateMyPersonalInfo(payload);

      setMe((prev) =>
        prev
          ? {
              ...prev,
              fullName: res.fullName ?? prev.fullName,
              phone: res.phone ?? prev.phone,
              email: res.email ?? prev.email,
            }
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
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold mb-4">Thông tin cá nhân</h1>
        {!editing ? (
          <button
            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
            onClick={() => setEditing(true)}
            disabled={loading}
          >
            Chỉnh sửa
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-sm"
              onClick={handleCancel}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        )}
      </div>

      <p className="text-zinc-400">Thông tin cá nhân của bạn được hiển thị tại đây.</p>

      {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      {ok && <div className="mt-3 text-sm text-emerald-400">{ok}</div>}

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Họ và tên</div>
          {!editing ? (
            <div className="text-white font-medium">
              {loading ? "(đang tải...)" : me?.fullName ?? "-"}
            </div>
          ) : (
            <input
              className="w-full bg-transparent border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-white/30"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên"
            />
          )}
        </div>

        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Email</div>
          <div className="text-white font-medium">{loading ? "(đang tải...)" : me?.email ?? "-"}</div>
        </div>

        <div className="bg-zinc-800/40 p-4 rounded border border-white/10">
          <div className="text-zinc-400 mb-1">Số điện thoại</div>
          {!editing ? (
            <div className="text-white font-medium">
              {loading ? "(đang tải...)" : me?.phone ?? "-"}
            </div>
          ) : (
            <input
              className="w-full bg-transparent border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-white/30"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Nhập số điện thoại"
              inputMode="tel"
            />
          )}
        </div>
      </div>
    </>
  );
}
