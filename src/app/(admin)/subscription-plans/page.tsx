"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import s from "../admin.module.css";
import {
  adminGetSubscriptionPlans,
  adminCreateSubscriptionPlan,
  adminDeleteSubscriptionPlan,
  type CreateSubscriptionPlanRequest,
} from "@/lib/admin-api";

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
    <div className={s.stack}>
      <section className={s.panel}>
        <div className={s.panelHead}>
          <h3>Gói đăng ký</h3>

          <div className={s.filters} style={{ gap: 8 }}>
            <input
              className={s.input}
              placeholder="Tìm theo tên gói…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className={s.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="Tất cả">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>

            <button
              className={s.primaryBtn}
              onClick={() => {
                setCreateErr(null);
                setOpenCreate((v) => !v);
              }}
            >
              {openCreate ? "Đóng form" : "+ Tạo gói"}
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto", width: "100%" }}>
          <table
            className={s.table}
            style={{
              minWidth: 1300,
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Tên gói</th>
                <th style={{ width: "9%" }}>Giá / tháng</th>
                <th style={{ width: "9%" }}>Giá / năm</th>
                <th style={{ width: "9%" }}>Bản đồ</th>
                <th style={{ width: "9%" }}>Xuất file</th>
                <th style={{ width: "9%" }}>Layer tùy chỉnh</th>
                <th style={{ width: "9%" }}>Token / tháng</th>
                <th style={{ width: "10%" }}>Trạng thái</th>
                <th style={{ width: "7%" }}>Người dùng</th>
                <th style={{ width: "7%" }}>Chi tiết</th>
                <th style={{ width: "9%" }}>Hành động</th>
              </tr>
            </thead>

            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center" }}>
                    Đang tải…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center" }}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.planId}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <b>{p.name}</b>
                        {p.isPopular && (
                          <span className={s.badgeInfo}>Phổ biến</span>
                        )}
                      </div>

                      <div
                        className={s.muted}
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

                    <td>{fmtMoney(p.priceMonthly)}</td>
                    <td>{fmtMoney(p.priceYearly)}</td>
                    <td>{fmtNum(p.mapsLimit)}</td>
                    <td>{fmtNum(p.exportsLimit)}</td>
                    <td>{fmtNum(p.customLayersLimit)}</td>
                    <td>
                      {p.monthlyTokenLimit.toLocaleString("vi-VN")}
                    </td>

                    <td>
                      {p.isActive ? (
                        <span className={s.badgeSuccess}>
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className={s.badgeWarn}>Ngưng</span>
                      )}
                    </td>

                    <td>
                      {p.totalSubscribers.toLocaleString("vi-VN")}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <Link
                        className={s.linkBtn}
                        href={`/subscription-plans/${p.planId}`}
                      >
                        Chi tiết
                      </Link>
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Link
                          className={s.linkBtn}
                          href={`/subscription-plans/${p.planId}/edit`}
                          aria-label={`Chỉnh sửa gói ${p.name}`}
                        >
                          Chỉnh sửa
                        </Link>

                        <span style={{ color: "#9ca3af" }}>|</span>

                        <button
                          className={s.linkBtn}
                          style={{ color: "#dc2626" }}
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
          <div className={s.panel} style={{ marginTop: 20 }}>
            <div className={s.panelHead}>
              <h4>Tạo gói mới</h4>
            </div>

            <div
              style={{
                padding: 20,
                display: "grid",
                gap: 18,
              }}
            >
              {createErr && <div className={s.errorBox}>{createErr}</div>}

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  background: "#fff",
                  display: "grid",
                  gap: 16,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span className={s.formLabel}>Tên gói *</span>
                  <input
                    className={s.input}
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Free, Pro, Enterprise…"
                    style={{ padding: "10px 12px" }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span className={s.formLabel}>Mô tả</span>
                  <textarea
                    className={s.input}
                    value={form.description ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Chức năng chính, nhóm người dùng mục tiêu…"
                    rows={5}
                    style={{
                      borderRadius: 12,
                      padding: "10px 12px",
                      resize: "vertical",
                      minHeight: 120,
                    }}
                  />
                </label>
              </div>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  background: "#fff",
                  display: "grid",
                  gap: 16,
                }}
              >
                <b style={{ marginBottom: 4 }}>💰 Giá</b>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span className={s.formLabel}>Giá / tháng (USD)</span>
                    <input
                      className={s.input}
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

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span className={s.formLabel}>Giá / năm (USD)</span>
                    <input
                      className={s.input}
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

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  background: "#fff",
                  display: "grid",
                  gap: 16,
                }}
              >
                <b>📊 Giới hạn</b>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 16,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span className={s.formLabel}>Giới hạn bản đồ</span>
                    <input
                      className={s.input}
                      type="number"
                      value={form.mapsLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          mapsLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <small className={s.muted}>-1 = Không giới hạn</small>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span className={s.formLabel}>Giới hạn xuất file</span>
                    <input
                      className={s.input}
                      type="number"
                      value={form.exportsLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          exportsLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <small className={s.muted}>-1 = Không giới hạn</small>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span className={s.formLabel}>Layer tùy chỉnh</span>
                    <input
                      className={s.input}
                      type="number"
                      value={form.customLayersLimit}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          customLayersLimit: Number(e.target.value),
                        }))
                      }
                    />
                    <small className={s.muted}>-1 = Không giới hạn</small>
                  </label>
                </div>

                <div style={{ maxWidth: 360 }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <span className={s.formLabel}>Token / tháng</span>
                    <input
                      className={s.input}
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

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 20,
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <b>⚙️ Cờ trạng thái</b>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    flexWrap: "wrap",
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
                        setForm((f) => ({
                          ...f,
                          isActive: e.target.checked,
                        }))
                      }
                    />
                    <span>Đang hoạt động</span>
                  </label>

                  <span className={s.muted}>
                    Tắt để ngừng bán / ẩn khỏi danh sách mua
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  className={s.ghostBtn}
                  onClick={() => {
                    resetForm();
                    setOpenCreate(false);
                  }}
                  disabled={creating}
                >
                  Hủy
                </button>

                <button
                  className={s.primaryBtn}
                  onClick={submitCreate}
                  disabled={creating}
                >
                  {creating ? "Đang tạo…" : "Tạo gói"}
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingDeleteId !== null && (
          <div className={s.modalOverlay}>
            <div className={s.modalCardDanger}>
              <div className={s.modalHeadDanger}>
                <div className={s.modalHeadLeft}>
                  <div className={s.iconCircleDanger}>!</div>
                  <div className={s.titleBlock}>
                    <div className={s.modalTitleProDanger}>Xóa gói đăng ký</div>
                    <div className={s.modalSubtitleProDanger}>
                      Hành động này không thể hoàn tác. Gói chỉ có thể xóa nếu không còn người đăng ký.
                    </div>
                  </div>
                </div>
              </div>

              <div className={s.modalBodyDanger}>
                {deleteErr && (
                  <div className={s.dangerBox} style={{ marginBottom: 12 }}>
                    {deleteErr}
                  </div>
                )}
                <p style={{ marginBottom: 6 }}>
                  Bạn có chắc muốn xóa <span className={s.orgNameHighlight}>gói này</span> không?
                </p>
                <p style={{ color: "#6b6b6b", fontSize: 13, lineHeight: 1.4 }}>
                  Hành động này sẽ xóa vĩnh viễn thông tin gói nếu đủ điều kiện.
                </p>
              </div>

              <div className={s.modalFootDanger}>
                <button
                  className={s.btnGhost}
                  onClick={cancelDelete}
                  disabled={deleting}
                >
                  Huỷ
                </button>

                <button
                  className={s.btnDangerOutline}
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
