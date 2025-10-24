"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import s from "@/app/(admin)/admin.module.css";
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
      <div className={s.stack}>
        <section className={s.panel}>
          <p>Đang tải dữ liệu...</p>
        </section>
      </div>
    );

  if (!form)
    return (
      <div className={s.stack}>
        <section className={s.panel}>
          <p>Không tìm thấy gói đăng ký.</p>
        </section>
      </div>
    );

  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Chỉnh sửa gói: <span style={{ color: "#2563eb" }}>{form.name}</span></h3>
        </div>

        {error && <div className={s.errorBox}>{error}</div>}

        <div
          style={{
            display: "grid",
            gap: 24,
            padding: "24px 28px 40px",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={s.formLabel}>Tên gói</span>
              <input
                className={s.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nhập tên gói (Free, Pro, Enterprise...)"
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className={s.formLabel}>Mô tả</span>
              <textarea
                className={s.input}
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
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={s.formLabel}>Giá / tháng (VND)</span>
                <input
                  className={s.input}
                  type="number"
                  value={form.priceMonthly}
                  onChange={(e) =>
                    setForm({ ...form, priceMonthly: Number(e.target.value) })
                  }
                  min={0}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={s.formLabel}>Giá / năm (VND)</span>
                <input
                  className={s.input}
                  type="number"
                  value={form.priceYearly}
                  onChange={(e) =>
                    setForm({ ...form, priceYearly: Number(e.target.value) })
                  }
                  min={0}
                />
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
            <h4 style={{ marginBottom: 0, color: "#111827" }}>📊 Giới hạn</h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={s.formLabel}>Giới hạn bản đồ</span>
                <input
                  className={s.input}
                  type="number"
                  value={form.mapsLimit}
                  onChange={(e) =>
                    setForm({ ...form, mapsLimit: Number(e.target.value) })
                  }
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={s.formLabel}>Giới hạn xuất file</span>
                <input
                  className={s.input}
                  type="number"
                  value={form.exportsLimit}
                  onChange={(e) =>
                    setForm({ ...form, exportsLimit: Number(e.target.value) })
                  }
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={s.formLabel}>Layer tùy chỉnh</span>
                <input
                  className={s.input}
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
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className={s.formLabel}>Token / tháng</span>
                <input
                  className={s.input}
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
            <h4 style={{ marginBottom: 0, color: "#111827" }}>⚙️ Cờ trạng thái</h4>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 20,
                marginLeft: 10,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={(e) =>
                    setForm({ ...form, isPopular: e.target.checked })
                  }
                />
                <span>Phổ biến</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
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
              className={s.ghostBtn}
              onClick={() => router.back()}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              className={s.primaryBtn}
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
