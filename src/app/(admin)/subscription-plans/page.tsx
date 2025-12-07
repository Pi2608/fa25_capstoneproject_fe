"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminGetSubscriptionPlans,
  adminCreateSubscriptionPlan,
  adminDeleteSubscriptionPlan,
  type CreateSubscriptionPlanRequest,
} from "@/lib/admin-api";
import { useTheme } from "../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import Loading from "@/app/loading";

type PlanStatus = "active" | "inactive" | string;

type Plan = {
  planId: number;
  name: string;
  description: string | null;
  status: PlanStatus;
  priceMonthly: number;
  priceYearly: number;
  mapsLimit: number;
  exportsLimit: number;
  customLayersLimit: number;
  monthlyTokenLimit: number;
  isPopular: boolean;
  isActive: boolean;
  totalSubscribers: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  totalRevenue?: number;
};

type StatusFilter = "Tất cả" | "active" | "inactive";

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtNum = (n: number) =>
  n < 0 ? "Không giới hạn" : n.toLocaleString("vi-VN");

export default function PlansPage() {
  const { isDark } = useTheme();
  const theme = getThemeClasses(isDark);
  const [rows, setRows] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("Tất cả");

  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [form, setForm] = useState<CreateSubscriptionPlanRequest>({
    name: "",
    description: "",
    priceMonthly: 0,
    priceYearly: 0,
    mapsLimit: -1,
    exportsLimit: -1,
    customLayersLimit: -1,
    monthlyTokenLimit: 0,
    isPopular: false,
    isActive: true,
  });

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await adminGetSubscriptionPlans<Plan>();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Không thể tải danh sách gói.");
      } finally {
        setLoading(false);
      }
    };
    void fetchPlans();
  }, []);

  const reloadPlans = async () => {
    try {
      const data = await adminGetSubscriptionPlans<Plan>();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không thể tải danh sách gói.");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((p) =>
        status === "Tất cả" ? true : p.status?.toLowerCase() === status
      )
      .filter((p) =>
        q
          ? p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => a.planId - b.planId);
  }, [rows, search, status]);

  const resetForm = () =>
    setForm({
      name: "",
      description: "",
      priceMonthly: 0,
      priceYearly: 0,
      mapsLimit: -1,
      exportsLimit: -1,
      customLayersLimit: -1,
      monthlyTokenLimit: 0,
      isPopular: false,
      isActive: true,
    });

  const submitCreate = async () => {
    if (!form.name.trim()) {
      setCreateErr("Vui lòng nhập tên gói.");
      return;
    }
    if (form.priceMonthly < 0 || form.priceYearly < 0) {
      setCreateErr("Giá tháng/năm không được âm.");
      return;
    }
    if (form.monthlyTokenLimit < 0) {
      setCreateErr("Token/tháng không được âm.");
      return;
    }

    try {
      setCreating(true);
      setCreateErr(null);

      await adminCreateSubscriptionPlan(form);

      resetForm();
      setOpenCreate(false);

      await reloadPlans();
    } catch (e) {
      setCreateErr(
        e instanceof Error ? e.message : "Không thể tạo gói. Vui lòng thử lại."
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (planId: number) => {
    setDeleteErr(null);
    setPendingDeleteId(planId);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setPendingDeleteId(null);
    setDeleteErr(null);
  };

  const doDelete = async () => {
    if (pendingDeleteId == null) return;
    try {
      setDeleting(true);
      setDeleteErr(null);
      await adminDeleteSubscriptionPlan(pendingDeleteId);
      setPendingDeleteId(null);
      await reloadPlans();
    } catch (e) {
      setDeleteErr(
        e instanceof Error
          ? e.message
          : "Không thể xoá gói. Có thể gói vẫn còn người đăng ký."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-5">
      <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="m-0 text-base font-extrabold">Gói đăng ký</h3>

          <div className="flex gap-2 flex-wrap">
            <input
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 min-w-[160px] ${theme.input}`}
              placeholder="Tìm theo tên gói…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className={`h-[34px] px-2.5 text-sm rounded-lg border outline-none focus:ring-1 ${theme.select}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>

            <button
              className="px-3 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer"
              onClick={() => {
                setCreateErr(null);
                setOpenCreate((v) => !v);
              }}
            >
              {openCreate ? "Đóng form" : "+ Tạo gói"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table
            className="w-full border-collapse text-sm"
            style={{
              minWidth: 1300,
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "22%" }}>Tên gói</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Giá / tháng</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Giá / năm</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Bản đồ</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Xuất file</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Layer tùy chỉnh</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Token / tháng</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "10%" }}>Trạng thái</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "7%" }}>Người dùng</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "7%" }}>Chi tiết</th>
                <th className={`p-3 border-b ${theme.tableHeader} text-left font-extrabold text-xs`} style={{ width: "9%" }}>Hành động</th>
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`p-8 text-center ${theme.textMuted}`}>
                    <Loading />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className={`p-8 text-center ${theme.textMuted}`}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.planId}>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      <div className="flex items-center gap-2">
                        <b>{p.name}</b>
                        {p.isPopular && (
                          <span className="px-2 py-1 rounded-full text-xs font-extrabold text-blue-600 bg-blue-500/16">
                            Phổ biến
                          </span>
                        )}
                      </div>

                      <div
                        className={`${theme.textMuted} text-sm`}
                        style={{
                          maxWidth: 420,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.description ?? "—"}
                      </div>
                    </td>

                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>{fmtMoney(p.priceMonthly)}</td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>{fmtMoney(p.priceYearly)}</td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>{fmtNum(p.mapsLimit)}</td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>{fmtNum(p.exportsLimit)}</td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>{fmtNum(p.customLayersLimit)}</td>
                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {p.monthlyTokenLimit.toLocaleString("vi-VN")}
                    </td>

                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {p.isActive ? (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">
                          Ngưng
                        </span>
                      )}
                    </td>

                    <td className={`p-3 border-b ${theme.tableCell} text-left`}>
                      {p.totalSubscribers.toLocaleString("vi-VN")}
                    </td>

                    <td className={`p-3 border-b ${theme.tableCell} text-center`}>
                      <Link
                        className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer ${
                          isDark ? "text-[#3f5f36]" : "text-blue-600"
                        }`}
                        href={`/subscription-plans/${p.planId}`}
                      >
                        Chi tiết
                      </Link>
                    </td>

                    <td className={`p-3 border-b ${theme.tableCell} text-center`}>
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        <Link
                          className={`text-sm font-bold hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer ${
                            isDark ? "text-[#3f5f36]" : "text-blue-600"
                          }`}
                          href={`/subscription-plans/${p.planId}/edit`}
                          aria-label={`Chỉnh sửa gói ${p.name}`}
                        >
                          Chỉnh sửa
                        </Link>

                        <span className={theme.textMuted}>|</span>

                        <button
                          className="text-sm font-bold text-red-600 hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer disabled:opacity-50"
                          onClick={() => confirmDelete(p.planId)}
                          disabled={deleting && pendingDeleteId === p.planId}
                        >
                          {deleting && pendingDeleteId === p.planId
                            ? "Đang xoá…"
                            : "Xoá"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {openCreate && (
          <div className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3 mt-5`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h4 className="m-0 text-base font-extrabold">Tạo gói mới</h4>
            </div>

            <div className="p-5 grid gap-4">
              {createErr && (
                <div className="p-4 text-center text-red-500 font-semibold text-sm rounded-lg border border-red-300 bg-red-50">
                  {createErr}
                </div>
              )}

              <div className={`border ${theme.tableBorder} rounded-xl p-5 ${isDark ? "bg-zinc-800/50" : "bg-gray-50"} grid gap-4`}>
                <label className="flex flex-col gap-2">
                  <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Tên gói *</span>
                  <input
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Free, Pro, Enterprise…"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Mô tả</span>
                  <textarea
                    className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 resize-y min-h-[120px] ${theme.input}`}
                    value={form.description ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Chức năng chính, nhóm người dùng mục tiêu…"
                    rows={5}
                  />
                </label>
              </div>

              <div className={`border ${theme.tableBorder} rounded-xl p-5 ${isDark ? "bg-zinc-800/50" : "bg-gray-50"} grid gap-4`}>
                <b className="mb-1">💰 Giá</b>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-2">
                    <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Giá / tháng (USD)</span>
                    <input
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                      type="number"
                      min={0}
                      value={form.priceMonthly}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          priceMonthly: Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Giá / năm (USD)</span>
                    <input
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                      type="number"
                      min={0}
                      value={form.priceYearly}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          priceYearly: Number(e.target.value),
                        }))
                      }
                      placeholder="0"
                    />
                  </label>
                </div>
              </div>

              <div className={`border ${theme.tableBorder} rounded-xl p-5 ${isDark ? "bg-zinc-800/50" : "bg-gray-50"} grid gap-4`}>
                <b>📊 Giới hạn</b>

                <div className="grid grid-cols-3 gap-4">
                  <label className="flex flex-col gap-2">
                    <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Giới hạn bản đồ</span>
                    <input
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                      type="number"
                      value={form.mapsLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          mapsLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <small className={`${theme.textMuted} text-xs`}>-1 = Không giới hạn</small>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Giới hạn xuất file</span>
                    <input
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                      type="number"
                      value={form.exportsLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          exportsLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <small className={`${theme.textMuted} text-xs`}>-1 = Không giới hạn</small>
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Layer tùy chỉnh</span>
                    <input
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                      type="number"
                      value={form.customLayersLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          customLayersLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <small className={`${theme.textMuted} text-xs`}>-1 = Không giới hạn</small>
                  </label>
                </div>

                <div className="max-w-[360px]">
                  <label className="flex flex-col gap-2">
                    <span className={`block text-sm font-medium ${isDark ? "text-zinc-300" : "text-gray-700"}`}>Token / tháng</span>
                    <input
                      className={`w-full px-3 py-2 rounded-lg border outline-none focus:ring-1 ${theme.input}`}
                      type="number"
                      min={0}
                      value={form.monthlyTokenLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          monthlyTokenLimit: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className={`border ${theme.tableBorder} rounded-xl p-5 ${isDark ? "bg-zinc-800/50" : "bg-gray-50"} flex flex-col gap-3`}>
                <b>⚙️ Cờ trạng thái</b>

                <div className="flex items-center gap-5 flex-wrap ml-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isPopular}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isPopular: e.target.checked,
                        }))
                      }
                    />
                    <span>
                      Đánh dấu <b>Phổ biến</b>
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          isActive: e.target.checked,
                        }))
                      }
                    />
                    <span>Đang hoạt động</span>
                  </label>

                  <span className={`${theme.textMuted} text-sm`}>
                    Tắt để ngừng bán / ẩn khỏi danh sách mua
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  className={`px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${theme.button}`}
                  onClick={() => {
                    resetForm();
                    setOpenCreate(false);
                  }}
                  disabled={creating}
                >
                  Hủy
                </button>

                <button
                  className="px-4 py-2 rounded-lg bg-gradient-to-b from-[#2f6a39] to-[#264b30] text-white border-none font-extrabold cursor-pointer disabled:opacity-50"
                  onClick={submitCreate}
                  disabled={creating}
                >
                  {creating ? <Loading /> : "Tạo gói"}
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingDeleteId !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className={`${isDark ? "bg-zinc-900" : "bg-white"} rounded-2xl shadow-xl border border-red-500/20 max-w-lg w-full mx-4`}>
              <div className={`p-6 border-b ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/18 border border-red-500/40 flex-shrink-0">
                    <span className="text-red-600 font-semibold">!</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="m-0 text-lg font-semibold leading-tight text-red-600">
                      Xóa gói đăng ký
                    </div>
                    <div className={`${theme.textMuted} text-sm mt-1`}>
                      Hành động này không thể hoàn tác. Gói chỉ có thể xóa nếu không còn người đăng ký.
                    </div>
                  </div>
                </div>
              </div>

              <div className={`p-6 border-b ${isDark ? "border-zinc-800" : "border-gray-200"}`}>
                {deleteErr && (
                  <div className="p-3 mb-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                    {deleteErr}
                  </div>
                )}
                <p className="mb-2">
                  Bạn có chắc muốn xóa <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-gray-900"}`}>gói này</span> không?
                </p>
                <p className={`${theme.textMuted} text-sm leading-relaxed`}>
                  Hành động này sẽ xóa vĩnh viễn thông tin gói nếu đủ điều kiện.
                </p>
              </div>

              <div className="p-6 flex justify-end gap-3">
                <button
                  className={`px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
                    isDark
                      ? "border-zinc-800 bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={cancelDelete}
                  disabled={deleting}
                >
                  Huỷ
                </button>

                <button
                  className="px-4 py-2 rounded-lg border border-red-500/40 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shadow-sm"
                  onClick={doDelete}
                  disabled={deleting}
                >
                  {deleting ? "Đang xoá…" : "Xoá gói"}
                </button>
              </div>
            </div>
          </div>
        )}

      </section>
    </div>
  );
}
