"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  adminGetSubscriptionPlanById,
  adminUpdateSubscriptionPlan,
} from "@/lib/admin-api";
import Loading from "@/app/loading";

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
        <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
          <p><Loading /></p>
        </section>
      </div>
    );

  if (!form)
    return (
      <div className="p-5">
        <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
          <p>Không tìm thấy gói đăng ký.</p>
        </section>
      </div>
    );

  return (
    <div className="p-5">
      <section className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3>
            Chỉnh sửa gói:{" "}
            <span style={{ color: "#2563eb" }}>{form.name}</span>
          </h3>
        </div>

        {error && <div className="p-4 mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700">{error}</div>}

        <div className="grid gap-6 p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="grid gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-700">Tên gói</span>
              <input
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
              <span className="text-sm font-medium text-gray-700">Mô tả</span>
              <textarea
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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

          <div className="border-t border-gray-200 pt-3 grid gap-4">
            <h4 className="m-0 text-gray-900">💰 Giá</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Giá / tháng (USD)</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
                <small className="text-gray-500 text-sm">
                  Ví dụ: 29.99 = $29.99 / tháng
                </small>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-700">Giá / năm (USD)</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
                <small className="text-gray-500 text-sm">
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
                <span className="text-sm font-medium text-gray-700">Giới hạn bản đồ</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
                <span className="text-sm font-medium text-gray-700">Giới hạn xuất file</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
                  <span className="text-sm font-medium text-gray-700">Layer tùy chỉnh</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
                <span className="text-sm font-medium text-gray-700">Token / tháng</span>
                <input
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
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
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => router.back()}
              disabled={saving}
            >
              Hủy
            </button>

            <button
              className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loading /> : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
