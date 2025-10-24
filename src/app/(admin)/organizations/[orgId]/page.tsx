"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import s from "../../admin.module.css";
import { adminGetOrganizationById } from "@/lib/admin-api";

type OrgStatus = "Active" | "Suspended";

type OrganizationDetail = {
  orgId: string;
  name: string;
  description?: string | null;
  status: OrgStatus;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  totalMembers?: number | null;
  totalActiveMemberships?: number | null;
  primaryPlanName?: string | null;
};

export default function OrganizationDetailPage() {
  const params = useParams<{ orgId?: string }>();
  const orgId = params?.orgId ?? "";
  const router = useRouter();
  const [data, setData] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!orgId) return;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await adminGetOrganizationById<OrganizationDetail>(orgId);
        if (alive) setData(res);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Không thể tải chi tiết tổ chức.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orgId]);

  if (loading) return <div className={s.loadingBox}>Đang tải thông tin tổ chức...</div>;
  if (err) return <div className={s.errorBox}>{err}</div>;
  if (!data) return <div className={s.emptyBox}>Không tìm thấy tổ chức.</div>;

  const StatusBadge =
    data.status === "Suspended" ? (
      <span className={s.badgeWarn}>Đã khóa</span>
    ) : (
      <span className={s.badgeSuccess}>Hoạt động</span>
    );

  return (
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Chi tiết tổ chức</h3>
          <div className={s.actionsRight}>
            <button className={s.btn} onClick={() => router.back()}>← Quay lại</button>
          </div>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              paddingBottom: 12,
              borderBottom: "1px solid #eee",
              marginBottom: 20,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: 20,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
                title={data.name}
              >
                {data.name}
              </h2>
            </div>
            {StatusBadge}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "18px 32px",
            }}
          >
            <Field label="Chủ sở hữu">
              {data.ownerName}{" "}
              <span style={{ color: "#6b7280" }}>({data.ownerEmail})</span>
            </Field>

            <Field label="Gói chính">{data.primaryPlanName ?? "—"}</Field>

            <Field label="Tổng thành viên">{data.totalMembers ?? 0}</Field>

            <Field label="Membership đang hoạt động">
              {data.totalActiveMemberships ?? 0}
            </Field>

            <Field label="Ngày tạo">
              {data.createdAt ? new Date(data.createdAt).toLocaleString("vi-VN") : "—"}
            </Field>

            <Field label="Cập nhật lần cuối">
              {data.updatedAt ? new Date(data.updatedAt).toLocaleString("vi-VN") : "—"}
            </Field>
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Mô tả</div>
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: "12px 14px",
                minHeight: 64,
                whiteSpace: "pre-wrap",
                color: "#111827",
              }}
            >
              {data.description?.trim() || "Không có mô tả."}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{props.label}</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>{props.children}</div>
    </div>
  );
}
