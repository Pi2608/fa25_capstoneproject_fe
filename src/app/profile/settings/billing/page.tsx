"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyMembershipStatus, getPlans, type Plan } from "@/lib/api-membership";

// Hàm định dạng giá tiền
function dinhDangTien(so?: number | null) {
  const giaTri = typeof so === "number" ? so : 0;
  return `${giaTri.toFixed(2)} US$`;
}

export default function TrangThanhToan() {
  const [goi, setGoi] = useState<Plan[]>([]);
  const [goiHienTai, setGoiHienTai] = useState<{ id: number | null; trangThai: string | null }>({
    id: null,
    trangThai: null,
  });
  const [dangTai, setDangTai] = useState(true);

  useEffect(() => {
    let tonTai = true;
    (async () => {
      try {
        const danhSachGoi = await getPlans();
        if (!tonTai) return;
        setGoi(danhSachGoi);

        try {
          const thongTinNguoiDung = await getMyMembershipStatus();
          if (!tonTai) return;
          setGoiHienTai({
            id: thongTinNguoiDung.planId,
            trangThai: thongTinNguoiDung.status ?? "active",
          });
        } catch {
          const goiMienPhi = danhSachGoi.find((g) => (g.priceMonthly ?? 0) <= 0);
          setGoiHienTai({ id: goiMienPhi?.planId ?? null, trangThai: goiMienPhi ? "active" : null });
        }
      } finally {
        if (tonTai) setDangTai(false);
      }
    })();
    return () => {
      tonTai = false;
    };
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Gói & Thanh toán</h2>

      {dangTai ? (
        <div className="text-sm text-zinc-500">Đang tải thông tin gói...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {goi.map((g) => {
            const laGoiMienPhi = (g.priceMonthly ?? 0) <= 0;
            const laGoiHienTai = goiHienTai.id === g.planId && goiHienTai.trangThai === "active";
            const choThanhToan = goiHienTai.id === g.planId && goiHienTai.trangThai === "pending";

            return (
              <div
                key={g.planId}
                className={[
                  "relative rounded-2xl border p-6 shadow-md transition bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm",
                  laGoiHienTai
                    ? "border-emerald-400 shadow-emerald-100 dark:border-emerald-400/60"
                    : "border-zinc-200 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-100/30 dark:border-white/10 dark:hover:ring-1 dark:hover:ring-emerald-400/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                    {g.planName}
                  </div>

                  {laGoiHienTai && (
                    <span className="inline-flex items-center rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                      Gói hiện tại
                    </span>
                  )}

                  {choThanhToan && (
                    <span className="inline-flex items-center rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-600 dark:text-yellow-300">
                      Đang chờ thanh toán
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {g.description || "Không có mô tả chi tiết cho gói này."}
                </p>

                <div className="mt-5">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {laGoiMienPhi ? "0 US$" : dinhDangTien(g.priceMonthly)}
                  </span>
                  <span className="ml-1 text-sm text-zinc-500">/tháng</span>
                </div>

                <div className="mt-6">
                  {laGoiHienTai ? (
                    <span className="inline-flex items-center justify-center w-full rounded-xl border border-emerald-400/40 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Đang sử dụng
                    </span>
                  ) : (
                    <Link
                      href={`/profile/select-plan?planId=${g.planId}`}
                      className="block text-center w-full rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 transition dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    >
                      Chọn gói
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
