"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  adminGetSubscriptionPlanById,
  adminUpdateSubscriptionPlan,
} from "@/lib/admin-api";

type Plan = {
  planId: number;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  mapsLimit: number;
  exportsLimit: number;
  customLayersLimit: number;
  monthlyTokenLimit: number;
  isPopular: boolean;
  isActive: boolean;
};

export default function EditPlanPage() {
  const router = useRouter();
  const params = useParams<{ planId?: string }>();
  const planId = Number(params?.planId ?? 0);

  const [form, setForm] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      setLoading(false);
      setError("Thiếu hoặc sai planId trong URL.");
      return;
    }
    const load = async () => {
      try {
        const data = await adminGetSubscriptionPlanById<Plan>(planId);
        setForm(data);
      } catch {
        setError("Không thể tải dữ liệu gói.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [planId]);

  const handleSave = async () => {
    if (!form || !planId) return;
    setSaving(true);
    setError(null);
    try {
      await adminUpdateSubscriptionPlan(planId, form);
      router.push("/subscription-plans");
    } catch {
      setError("Không thể lưu thay đổi, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="p-5">
        <section className="bg-zinc-900/50 p-6 rounded-lg">
          <p>Đang tải dữ liệu...</p>
        </section>
      </div>
    );

  if (!form)
    return (
      <div className="p-5">
        <section className="bg-zinc-900/50 p-6 rounded-lg">
          <p>Không tìm thấy gói đăng ký.</p>
        </section>
      </div>
    );

  return (
    <div className="p-5">
      <section className="bg-zinc-900/50 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-6">
          <h3>
            Chỉnh sửa gói:{" "}
            <span style={{ color: "#2563eb" }}>{form.name}</span>
          </h3>
        </div>

        {error && <div className="p-4 mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700">{error}</div>}

        <div
          style={{
            display: "grid",
            gap: 24,
            padding: "24px 28px 40px",
            background: "#070b0b",
            borderRadius: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          <div className="grid gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-zinc-300">Tên gói</span>
              <input
                className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="Nhập tên gói (Free, Pro, Enterprise...)"
              />
            </label>

            <label
              className="flex flex-col gap-2"
            >
              <span className="text-sm font-medium text-zinc-300">Mô tả</span>
              <textarea
                className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                rows={4}
                style={{
                  resize: "vertical",
                  minHeight: 100,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Mô tả ngắn gọn về gói (ví dụ: Dành cho doanh nghiệp vừa và nhỏ...)"
              />
            </label>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: 10,
              display: "grid",
              gap: 16,
            }}
          >
            <h4 style={{ marginBottom: 0, color: "#111827" }}>💰 Giá</h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="text-sm font-medium text-zinc-300">Giá / tháng (USD)</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                  type="number"
                  value={form.priceMonthly}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priceMonthly: Number(e.target.value),
                    })
                  }
                  min={0}
                />
                <small className="text-zinc-400 text-sm">
                  Ví dụ: 29.99 = $29.99 / tháng
                </small>
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="text-sm font-medium text-zinc-300">Giá / năm (USD)</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                  type="number"
                  value={form.priceYearly}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priceYearly: Number(e.target.value),
                    })
                  }
                  min={0}
                />
                <small className="text-zinc-400 text-sm">
                  Ví dụ: 99.99 = $99.99 / năm
                </small>
              </label>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: 10,
              display: "grid",
              gap: 16,
            }}
          >
            <h4 style={{ marginBottom: 0, color: "#111827" }}>
              📊 Giới hạn
            </h4>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="text-sm font-medium text-zinc-300">Giới hạn bản đồ</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                  type="number"
                  value={form.mapsLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mapsLimit: Number(e.target.value),
                    })
                  }
                />
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="text-sm font-medium text-zinc-300">Giới hạn xuất file</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                  type="number"
                  value={form.exportsLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      exportsLimit: Number(e.target.value),
                    })
                  }
                />
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                  <span className="text-sm font-medium text-zinc-300">Layer tùy chỉnh</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                  type="number"
                  value={form.customLayersLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customLayersLimit: Number(e.target.value),
                    })
                  }
                />
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span className="text-sm font-medium text-zinc-300">Token / tháng</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-colors"
                  type="number"
                  value={form.monthlyTokenLimit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthlyTokenLimit: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: 10,
              display: "grid",
              gap: 10,
            }}
          >
            <h4 style={{ marginBottom: 0, color: "#111827" }}>
              ⚙️ Cờ trạng thái
            </h4>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 20,
                marginLeft: 10,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isPopular: e.target.checked,
                    })
                  }
                />
                <span>Phổ biến</span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      isActive: e.target.checked,
                    })
                  }
                />
                <span>Đang hoạt động</span>
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              borderTop: "1px solid #e5e7eb",
              paddingTop: 20,
              marginTop: 10,
            }}
          >
            <button
              className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors"
              onClick={() => router.back()}
              disabled={saving}
            >
              Hủy
            </button>

            <button
              className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700 transition-colors"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
