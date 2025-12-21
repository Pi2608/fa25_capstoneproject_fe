"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminGetOrganizationById } from "@/lib/admin-api";
import Loading from "@/app/loading";
import { useTheme } from "../../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { useI18n } from "@/i18n/I18nProvider";

type OrgStatus = "Active" | "Suspended";

type OrgMember = {
  memberId: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  status: string;
  joinedAt: string;
  leftAt?: string | null;
};

type OrgMembership = {
  membershipId: string;
  userId: string;
  userName: string;
  userEmail: string;
  planId: number;
  planName: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  autoRenew: boolean;
  priceMonthly: number;
  createdAt: string;
};

type OrgTransaction = {
  transactionId: string;
  membershipId: string;
  userName: string;
  amount: number;
  paymentMethod: string;
  status: string;
  transactionDate: string;
};

type OrganizationDetail = {
  orgId: string;
  name: string;
  description?: string | null;
  abbreviation?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status: OrgStatus;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  totalMembers?: number | null;
  totalActiveMemberships?: number | null;
  totalMaps?: number | null;
  totalStorageUsedMB?: number | null;
  totalRevenue?: number | null;
  primaryPlanName?: string | null;
  members?: OrgMember[];
  activeMemberships?: OrgMembership[];
  expiredMemberships?: OrgMembership[];
  recentTransactions?: OrgTransaction[];
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
  const { t } = useI18n();
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
              {data.abbreviation && (
                <span className={`text-sm ${themeClasses.textMuted}`}>({data.abbreviation})</span>
              )}
            </div>
            {StatusBadge}
          </div>

          {/* Basic Information */}
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

            <Field label="Tổng số maps" themeClasses={themeClasses}>
              {data.totalMaps ?? 0}
            </Field>

            <Field label="Storage sử dụng" themeClasses={themeClasses}>
              {data.totalStorageUsedMB ? `${data.totalStorageUsedMB.toFixed(2)} MB` : "0 MB"}
            </Field>

            <Field label="Tổng doanh thu" themeClasses={themeClasses}>
              {data.totalRevenue ? `$${data.totalRevenue.toFixed(2)}` : "$0.00"}
            </Field>

            {data.contactEmail && (
              <Field label="Email liên hệ" themeClasses={themeClasses}>{data.contactEmail}</Field>
            )}

            {data.contactPhone && (
              <Field label="Số điện thoại" themeClasses={themeClasses}>{data.contactPhone}</Field>
            )}

            <Field label="Ngày tạo" themeClasses={themeClasses}>
              {data.createdAt ? new Date(data.createdAt).toLocaleString("vi-VN") : "—"}
            </Field>

            <Field label="Cập nhật lần cuối" themeClasses={themeClasses}>
              {data.updatedAt ? new Date(data.updatedAt).toLocaleString("vi-VN") : "—"}
            </Field>
          </div>

          {/* Address */}
          {data.address && (
            <div style={{ marginTop: 28 }}>
              <div className={`font-semibold mb-2 ${themeClasses.loading.text}`}>Địa chỉ</div>
              <div
                className={`rounded-lg p-3.5 min-h-[48px] whitespace-pre-wrap border ${themeClasses.panel} ${themeClasses.loading.text}`}
              >
                {data.address}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginTop: 28 }}>
            <div className={`font-semibold mb-2 ${themeClasses.loading.text}`}>Mô tả</div>
            <div
              className={`rounded-lg p-3.5 min-h-[64px] whitespace-pre-wrap border ${themeClasses.panel} ${themeClasses.loading.text}`}
            >
              {data.description?.trim() || "Không có mô tả."}
            </div>
          </div>

          {/* Members Table */}
          {data.members && data.members.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 className={`font-semibold mb-3 text-lg ${themeClasses.loading.text}`}>
                Thành viên ({data.members.length})
              </h3>
              <div className={`rounded-lg border ${themeClasses.tableBorder} overflow-hidden`}>
                <table className="w-full">
                  <thead className={themeClasses.panel}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Tên</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Email</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Vai trò</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Trạng thái</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Ngày tham gia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member) => (
                      <tr key={member.memberId} className={`border-t ${themeClasses.tableBorder}`}>
                        <td className={`px-4 py-3 text-sm ${themeClasses.loading.text}`}>{member.userName}</td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.textMuted}`}>{member.userEmail}</td>
                        <td className={`px-4 py-3 text-sm`}>
                          <span className={`px-2 py-1 rounded-md text-xs ${
                            member.role === "Admin" ? "bg-purple-500/10 text-purple-500" : 
                            member.role === "Owner" ? "bg-blue-500/10 text-blue-500" : 
                            "bg-gray-500/10 text-gray-500"
                          }`}>
                            {member.role}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm`}>
                          <span className={`px-2 py-1 rounded-md text-xs ${
                            member.status === "Active" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          }`}>
                            {member.status}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.textMuted}`}>
                          {new Date(member.joinedAt).toLocaleDateString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Active Memberships */}
          {data.activeMemberships && data.activeMemberships.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 className={`font-semibold mb-3 text-lg ${themeClasses.loading.text}`}>
                Membership đang hoạt động ({data.activeMemberships.length})
              </h3>
              <div className={`rounded-lg border ${themeClasses.tableBorder} overflow-hidden`}>
                <table className="w-full">
                  <thead className={themeClasses.panel}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Người dùng</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Gói</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Giá/tháng</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Bắt đầu</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Kết thúc</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Tự động gia hạn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activeMemberships.map((membership) => (
                      <tr key={membership.membershipId} className={`border-t ${themeClasses.tableBorder}`}>
                        <td className={`px-4 py-3 text-sm ${themeClasses.loading.text}`}>
                          <div>{membership.userName}</div>
                          <div className={`text-xs ${themeClasses.textMuted}`}>{membership.userEmail}</div>
                        </td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.loading.text}`}>{membership.planName}</td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.loading.text}`}>${membership.priceMonthly.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.textMuted}`}>
                          {new Date(membership.startDate).toLocaleDateString("vi-VN")}
                        </td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.textMuted}`}>
                          {membership.endDate ? new Date(membership.endDate).toLocaleDateString("vi-VN") : "—"}
                        </td>
                        <td className={`px-4 py-3 text-sm`}>
                          <span className={`px-2 py-1 rounded-md text-xs ${
                            membership.autoRenew ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"
                          }`}>
                            {membership.autoRenew ? "Có" : "Không"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          {data.recentTransactions && data.recentTransactions.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h3 className={`font-semibold mb-3 text-lg ${themeClasses.loading.text}`}>
                {t("billing.recent_title")} ({data.recentTransactions.length})
              </h3>
              <div className={`rounded-lg border ${themeClasses.tableBorder} overflow-hidden`}>
                <table className="w-full">
                  <thead className={themeClasses.panel}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Người dùng</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Số tiền</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Phương thức</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Trạng thái</th>
                      <th className={`px-4 py-3 text-left text-sm font-semibold ${themeClasses.loading.text}`}>Ngày giao dịch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTransactions.map((transaction) => (
                      <tr key={transaction.transactionId} className={`border-t ${themeClasses.tableBorder}`}>
                        <td className={`px-4 py-3 text-sm ${themeClasses.loading.text}`}>{transaction.userName}</td>
                        <td className={`px-4 py-3 text-sm font-semibold ${themeClasses.loading.text}`}>
                          ${transaction.amount.toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.textMuted}`}>{transaction.paymentMethod}</td>
                        <td className={`px-4 py-3 text-sm`}>
                          <span className={`px-2 py-1 rounded-md text-xs ${
                            transaction.status.toLowerCase() === "completed" || transaction.status.toLowerCase() === "paid" || transaction.status.toLowerCase() === "success"
                              ? "bg-green-500/10 text-green-500" 
                              : transaction.status.toLowerCase() === "pending"
                              ? "bg-yellow-500/10 text-yellow-500"
                              : "bg-red-500/10 text-red-500"
                          }`}>
                            {transaction.status}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${themeClasses.textMuted}`}>
                          {new Date(transaction.transactionDate).toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
