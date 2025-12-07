"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminGetOrganizationById } from "@/lib/admin-api";
import Loading from "@/app/loading";
import { useTheme } from "../../layout";
import { getThemeClasses } from "@/utils/theme-utils";

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
  const { isDark } = useTheme();
  const themeClasses = getThemeClasses(isDark);
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

  if (loading) return <div className="p-5"><Loading /></div>;
  if (err) return (
    <div className={`p-5 ${themeClasses.loading.text}`}>
      Không tìm thấy tổ chức.
    </div>
  );
  if (!data) return (
    <div className={`p-5 ${themeClasses.loading.text}`}>
      Không tìm thấy tổ chức.
    </div>
  );

  const StatusBadge =
    data.status === "Suspended" ? (
      <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-500">Đã khóa</span>
    ) : (
      <span className="px-2 py-1 rounded-md bg-green-500/10 text-green-500">Hoạt động</span>
    );

  return (
    <div className="p-5">
      <section className={`${themeClasses.panel} p-6 rounded-lg border`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={themeClasses.loading.text}>Chi tiết tổ chức</h3>
          <div className="flex items-center gap-2">
            <button 
              className={`px-4 py-2 rounded-lg border transition-colors ${themeClasses.button}`} 
              onClick={() => router.back()}
            >
              ← Quay lại
            </button>
          </div>
        </div>

        <div
          className={`${themeClasses.panel} rounded-lg p-6 shadow-sm border`}
        >
          <div
            className={`flex items-center justify-between gap-4 pb-3 border-b mb-5 ${themeClasses.tableBorder}`}
          >
            <div className="min-w-0">
              <h2
                className={`m-0 text-2xl font-bold leading-none whitespace-nowrap text-ellipsis overflow-hidden ${themeClasses.loading.text}`}
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
            <Field label="Chủ sở hữu" themeClasses={themeClasses}>
              {data.ownerName}{" "}
              <span className={themeClasses.textMuted}>({data.ownerEmail})</span>
            </Field>

            <Field label="Gói chính" themeClasses={themeClasses}>{data.primaryPlanName ?? "—"}</Field>

            <Field label="Tổng thành viên" themeClasses={themeClasses}>{data.totalMembers ?? 0}</Field>

            <Field label="Membership đang hoạt động" themeClasses={themeClasses}>
              {data.totalActiveMemberships ?? 0}
            </Field>

            <Field label="Ngày tạo" themeClasses={themeClasses}>
              {data.createdAt ? new Date(data.createdAt).toLocaleString("vi-VN") : "—"}
            </Field>

            <Field label="Cập nhật lần cuối" themeClasses={themeClasses}>
              {data.updatedAt ? new Date(data.updatedAt).toLocaleString("vi-VN") : "—"}
            </Field>
          </div>

          <div style={{ marginTop: 28 }}>
            <div className={`font-semibold mb-2 ${themeClasses.loading.text}`}>Mô tả</div>
            <div
              className={`rounded-lg p-3.5 min-h-[64px] whitespace-pre-wrap border ${themeClasses.panel} ${themeClasses.loading.text}`}
            >
              {data.description?.trim() || "Không có mô tả."}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field(props: { 
  label: string; 
  children: React.ReactNode; 
  themeClasses: ReturnType<typeof getThemeClasses>;
}) {
  return (
    <div>
      <div className={`text-xs mb-1 ${props.themeClasses.textMuted}`}>{props.label}</div>
      <div className={`text-sm font-medium ${props.themeClasses.loading.text}`}>{props.children}</div>
    </div>
  );
}
