"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminGetSubscriptionPlans } from "@/lib/admin-api";
import Loading from "@/app/loading";

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
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtNum = (n: number) =>
  n < 0 ? "Không giới hạn" : n.toLocaleString("vi-VN");

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
        const found =
          all.find((x) => String(x.planId) === String(planId)) ?? null;
        setData(found);
        if (!found) setErr("Không tìm thấy gói.");
      } catch (e) {
        if (!alive) return;
        setErr(
          e instanceof Error
            ? e.message
            : "Không thể tải chi tiết gói."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [planId]);

  if (loading) return <div className="p-5">
    <section className="bg-zinc-900/50 p-6 rounded-lg">
      <Loading />
    </section>
  </div>;
  if (err) return <div className="p-5">
    <section className="bg-zinc-900/50 p-6 rounded-lg">
      <p>{err}</p>
    </section>
  </div>;
  if (!data) return <div className="p-5">
    <section className="bg-zinc-900/50 p-6 rounded-lg">
      <p>Không tìm thấy gói đăng ký.</p>
    </section>
  </div>;

  return (
    <div className="p-5">
      <section className="bg-zinc-900/50 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3>Chi tiết gói</h3>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors" onClick={() => router.back()}>
              ← Quay lại
            </button>
          </div>
        </div>

        <div
          style={{
            background: "#070b0b",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              borderBottom: "1px solid #27272a",
              paddingBottom: 10,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {data.name}
            </h2>

            {data.isActive ? (
              <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-500">Đang hoạt động</span>
            ) : (
              <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500">Ngưng</span>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gap: "18px 32px",
            }}
          >
            <Field label="Mô tả">
              {data.description ?? "—"}
            </Field>

            <Field label="Trạng thái hệ thống">
              {data.status}
            </Field>

            <Field label="Giá / tháng">
              {fmtMoney(data.priceMonthly)}
            </Field>

            <Field label="Giá / năm">
              {fmtMoney(data.priceYearly)}
            </Field>

            <Field label="Giới hạn bản đồ">
              {fmtNum(data.mapsLimit)}
            </Field>

            <Field label="Giới hạn xuất file">
              {fmtNum(data.exportsLimit)}
            </Field>

            <Field label="Giới hạn layer tuỳ chỉnh">
              {fmtNum(data.customLayersLimit)}
            </Field>

            <Field label="Token / tháng">
              {data.monthlyTokenLimit.toLocaleString("vi-VN")}
            </Field>

            <Field label="Phổ biến">
              {data.isPopular ? "Có" : "Không"}
            </Field>

            <Field label="Người đăng ký">
              {data.totalSubscribers.toLocaleString("vi-VN")}
            </Field>

            <Field label="Tạo lúc">
              {data.createdAt
                ? new Date(data.createdAt).toLocaleString("vi-VN")
                : "—"}
            </Field>

            <Field label="Cập nhật">
              {data.updatedAt
                ? new Date(data.updatedAt).toLocaleString("vi-VN")
                : "—"}
            </Field>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
        }}
      >
        {children}
      </div>
    </div>
  );
}
