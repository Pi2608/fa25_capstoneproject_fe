"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import s from "../../admin.module.css";
import { adminGetSubscriptionPlans } from "@/lib/admin-api";

type Plan = {
  planId: number;
  name: string;
  description: string | null;
  status: string;
  priceMonthly: number;
  priceYearly: number;
  mapsLimit: number;
  exportsLimit: number;
  customLayersLimit: number;
  monthlyTokenLimit: number;
  isPopular: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  totalSubscribers: number;
  totalRevenue: number;
};

const fmtMoney = (n: number) =>
  n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });
const fmtNum = (n: number) => (n < 0 ? "Không giới hạn" : n.toLocaleString("vi-VN"));

export default function PlanDetailPage() {
  const params = useParams<{ planId?: string }>();
  const planId = params?.planId ?? "";

  const router = useRouter();
  const [data, setData] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const all = await adminGetSubscriptionPlans<Plan>();
        if (!alive) return;
        const found = all.find((x) => String(x.planId) === String(planId)) ?? null;
        setData(found);
        if (!found) setErr("Không tìm thấy gói.");
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Không thể tải chi tiết gói.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [planId]);

  if (loading) return <div className={s.loadingBox}>Đang tải…</div>;
  if (err) return <div className={s.errorBox}>{err}</div>;
  if (!data) return <div className={s.emptyBox}>Không có dữ liệu.</div>;

  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Chi tiết gói</h3>
          <div className={s.actionsRight}>
            <button className={s.btn} onClick={() => router.back()}>← Quay lại</button>
          </div>
        </div>

        <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{data.name}</h2>
            {data.isActive ? <span className={s.badgeSuccess}>Đang hoạt động</span> : <span className={s.badgeWarn}>Ngưng</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "18px 32px" }}>
            <Field label="Mô tả">{data.description ?? "—"}</Field>
            <Field label="Trạng thái hệ thống">{data.status}</Field>
            <Field label="Giá / tháng">{fmtMoney(data.priceMonthly)}</Field>
            <Field label="Giá / năm">{fmtMoney(data.priceYearly)}</Field>
            <Field label="Giới hạn bản đồ">{fmtNum(data.mapsLimit)}</Field>
            <Field label="Giới hạn xuất file">{fmtNum(data.exportsLimit)}</Field>
            <Field label="Giới hạn layer tuỳ chỉnh">{fmtNum(data.customLayersLimit)}</Field>
            <Field label="Token / tháng">{data.monthlyTokenLimit.toLocaleString("vi-VN")}</Field>
            <Field label="Phổ biến">{data.isPopular ? "Có" : "Không"}</Field>
            <Field label="Người đăng ký">{data.totalSubscribers.toLocaleString("vi-VN")}</Field>
            <Field label="Tạo lúc">{data.createdAt ? new Date(data.createdAt).toLocaleString("vi-VN") : "—"}</Field>
            <Field label="Cập nhật">{data.updatedAt ? new Date(data.updatedAt).toLocaleString("vi-VN") : "—"}</Field>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>{children}</div>
    </div>
  );
}
