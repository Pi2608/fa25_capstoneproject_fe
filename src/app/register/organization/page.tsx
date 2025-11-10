"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import {
  subscribeToPlan,
  type SubscribeRequest,
  type SubscribeResponse,
  type PaymentGateway,
  getPlans,
  type Plan,
} from "@/lib/api-membership";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import {
  createOrganization,
  type OrganizationReqDto,
} from "@/lib/api-organizations";

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isLoggedIn } = useAuthStatus();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [formData, setFormData] = useState({
    orgName: "",
    selectedPlanId: 1,
    orgBilling: "monthly" as "monthly" | "yearly",
    orgSeats: 1,
  });

  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getPlans();
        setPlans(data);
      } catch (error) {
        showToast("error", "Không tải được danh sách gói. Vui lòng tải lại trang.");
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [showToast]);

  const getStepInfo = () => {
    switch (step) {
      case 1:
        return {
          title: "Đặt tên tổ chức của bạn",
          subtitle: "Tạo tổ chức để cộng tác cùng đội ngũ của bạn trên IMOS.",
        };
      case 2:
        return {
          title: "Gói IMOS Teams",
          subtitle: "Chọn gói mà bạn muốn bắt đầu:",
        };
      case 3:
        return {
          title: "Thiết lập thanh toán",
          subtitle: "Hoàn tất thiết lập tổ chức với phương thức thanh toán an toàn.",
        };
      default:
        return {
          title: "Đặt tên tổ chức của bạn",
          subtitle: "Tạo tổ chức để cộng tác cùng đội ngũ của bạn trên IMOS.",
        };
    }
  };

  const selectedPlan = plans.find((p) => p.planId === formData.selectedPlanId);
  const isFreePlan =
    selectedPlan?.priceMonthly === 0 || selectedPlan?.priceMonthly === null;

  const handlePaymentMethod = async (method: PaymentGateway) => {
    if (!isLoggedIn) {
      showToast("error", "Vui lòng đăng nhập để tiếp tục thanh toán.");
      return;
    }

    setPaymentLoading(true);
    try {
      const orgId = createdOrgId || localStorage.getItem("created_org_id");
      if (!orgId) {
        showToast("error", "Không tìm thấy tổ chức. Vui lòng thử lại.");
        return;
      }

      const req: SubscribeRequest = {
        userId: "08ddf705-7b38-41a8-8b65-80141dc31d21",
        orgId,
        planId: formData.selectedPlanId,
        paymentMethod: method,
        autoRenew: true,
      };

      const res: SubscribeResponse = await subscribeToPlan(req);
      localStorage.setItem("planId", String(formData.selectedPlanId));
      localStorage.setItem("orgId", orgId);
      localStorage.setItem(
        "redirect_after_payment",
        `/profile/organizations/${orgId}`
      );

      window.location.href = res.paymentUrl;
    } catch (err) {
      showToast("error", "Thiết lập thanh toán thất bại. Vui lòng thử lại.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const stepInfo = getStepInfo();

  const toVnNumber = (n: number) =>
    new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      n
    );

  return (
    <main className="relative min-h-screen text-gray-900 dark:text-white transition-colors">
      <div className="absolute inset-0 -z-20 bg-white dark:bg-[#070b0b]" aria-hidden />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.18),transparent_60%)] dark:bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.12),transparent_60%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(16,185,129,0.08),transparent_35%)] dark:bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06),transparent_35%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-40">
        <div
          className="pointer-events-none absolute inset-x-0 h-20 -z-10 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.85),transparent)] dark:bg-[linear-gradient(to_bottom,rgba(7,11,11,0.65),transparent)]"
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <a href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-500 shadow" />
            <span className="text-lg md:text-xl font-bold tracking-tight">IMOS</span>
          </a>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-6">
        <section className="flex flex-col items-center justify-start text-center space-y-4">
          <div className="w-full max-w-6xl">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">{stepInfo.title}</h1>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
              {stepInfo.subtitle}
            </p>

            <div className="space-y-6">
              {step === 1 && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                    <div>
                      <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Tên tổ chức *
                      </label>
                      <input
                        type="text"
                        value={formData.orgName}
                        onChange={(e) =>
                          setFormData({ ...formData, orgName: e.target.value })
                        }
                        placeholder="Nhập tên tổ chức của bạn"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!formData.orgName.trim()}
                        className="w-full mt-6 bg-emerald-500 text-white text-base py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Tiếp tục
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, orgBilling: "monthly" })
                        }
                        className={`px-6 py-2 text-base rounded-md transition-colors ${formData.orgBilling === "monthly"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                      >
                        Thanh toán theo tháng
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, orgBilling: "yearly" })
                        }
                        className={`px-6 py-2 text-base rounded-md transition-colors ${formData.orgBilling === "yearly"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          }`}
                      >
                        Thanh toán theo năm <span className="text-emerald-500">(Tiết kiệm 33%)</span>
                      </button>
                    </div>
                  </div>

                  {loadingPlans ? (
                    <div className="text-center py-12">
                      <p className="text-base text-gray-600 dark:text-gray-300">
                        Đang tải các gói…
                      </p>
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-base text-gray-600 dark:text-gray-300">
                        Chưa có gói khả dụng.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {plans.map((plan) => {
                        const priceMonthly = plan.priceMonthly ?? 0;
                        const priceYearly = priceMonthly * 12 * 0.67;
                        const displayPrice =
                          formData.orgBilling === "monthly"
                            ? priceMonthly
                            : priceYearly;

                        const formatLimit = (value: number, unit = "") => {
                          if (value === -1) return "Không giới hạn";
                          return `${value}${unit}`;
                        };

                        let featureList: string[] = [];
                        try {
                          if (plan.features) {
                            const featuresObj = JSON.parse(plan.features);
                            const featureKeys = Object.keys(featuresObj).filter(
                              (k) => featuresObj[k] === true
                            );
                            const jsonFeatures = featureKeys
                              .slice(0, 3)
                              .map((key) => {
                                const title = key
                                  .split("_")
                                  .map(
                                    (w: string) =>
                                      w.charAt(0).toUpperCase() + w.slice(1)
                                  )
                                  .join(" ");
                                return title;
                              });
                            featureList = jsonFeatures;
                          }
                        } catch { }

                        const quotaFeatures = [
                          `${formatLimit(plan.maxMapsPerMonth)} bản đồ/tháng`,
                          `${formatLimit(plan.maxUsersPerOrg)} người dùng`,
                          <span title="Lớp dữ liệu (layer) là một tập dữ liệu chồng lên bản đồ nền, ví dụ: ranh giới, khu vực, POI…">
                            {`${formatLimit(plan.maxCustomLayers)} lớp dữ liệu`}
                          </span>
                          ,
                          plan.prioritySupport ? "Hỗ trợ ưu tiên" : null,
                        ].filter(Boolean) as string[];

                        featureList = [...featureList, ...quotaFeatures].slice(0, 6);

                        return (
                          <div
                            key={plan.planId}
                            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${formData.selectedPlanId === plan.planId
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg"
                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                              }`}
                            onClick={() =>
                              setFormData({
                                ...formData,
                                selectedPlanId: plan.planId,
                              })
                            }
                          >
                            <div className="text-center mb-4">
                              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                {plan.planName}
                              </h3>
                              <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                                ${toVnNumber(displayPrice)}
                                <span className="text-lg text-gray-500 dark:text-gray-400">
                                  /{formData.orgBilling === "monthly" ? "tháng" : "năm"}
                                </span>
                              </div>
                              {priceMonthly > 0 &&
                                formData.orgBilling === "yearly" && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    {`$${toVnNumber(priceMonthly)}/tháng thanh toán theo năm`}
                                  </div>
                                )}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                                Tính năng chính
                              </h4>
                              <ul className="space-y-2">
                                {featureList.map((feature, index) => (
                                  <li
                                    key={index}
                                    className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2"
                                  >
                                    <span className="text-emerald-500 mt-0.5">✓</span>
                                    <span className="leading-snug">{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {formData.selectedPlanId === plan.planId && (
                              <div className="mt-4">
                                <div className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium text-center text-sm">
                                  Đã chọn
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-base text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const orgRequest: OrganizationReqDto = {
                            orgName: formData.orgName,
                            abbreviation: formData.orgName
                              .substring(0, 3)
                              .toUpperCase(),
                            description: "Tổ chức được tạo từ quy trình thiết lập",
                            contactEmail: "",
                            contactPhone: "",
                            address: "",
                          };

                          const response = await createOrganization(orgRequest);
                          if (!response.orgId) {
                            showToast(
                              "error",
                              "Đã tạo tổ chức nhưng không lấy được ID. Vui lòng thử lại."
                            );
                            return;
                          }

                          const newOrgId = response.orgId;
                          setCreatedOrgId(newOrgId);
                          localStorage.setItem("created_org_id", newOrgId);

                          if (!isFreePlan) {
                            setStep(3);
                            showToast(
                              "success",
                              "Đã tạo tổ chức! Tiếp theo là thiết lập thanh toán."
                            );
                          } else {
                            showToast(
                              "success",
                              "Tạo tổ chức thành công! 🎉"
                            );
                            setTimeout(() => {
                              router.push(`/profile/organizations/${newOrgId}`);
                            }, 1000);
                          }
                        } catch {
                          showToast(
                            "error",
                            "Không thể tạo tổ chức. Vui lòng thử lại."
                          );
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="px-6 py-2 bg-emerald-500 text-white text-base rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading
                        ? "Đang tạo tổ chức..."
                        : isFreePlan
                          ? "Tạo tổ chức"
                          : "Tiếp tục thanh toán"}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="max-w-4xl mx-auto space-y-8">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                    <div className="text-center mb-8">
                      <h3 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
                        Hoàn tất thiết lập
                      </h3>
                      <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
                        Bạn đã chọn gói{" "}
                        <span className="font-semibold text-emerald-600">
                          {selectedPlan?.planName || "đã chọn"}
                        </span>
                        . Hãy thiết lập thanh toán để kích hoạt tổ chức.
                      </p>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6 text-left">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xl font-medium text-gray-900 dark:text-white">
                            Chi tiết gói
                          </span>
                          <span className="text-3xl font-bold text-emerald-600">
                            {(() => {
                              const monthly = selectedPlan?.priceMonthly ?? 0;
                              const yearly = monthly * 12 * 0.67;
                              const price =
                                formData.orgBilling === "monthly"
                                  ? monthly
                                  : yearly;
                              return `$${toVnNumber(price)}`;
                            })()}
                            <span className="text-lg text-gray-500">
                              /{formData.orgBilling === "monthly" ? "tháng" : "năm"}
                            </span>
                          </span>
                        </div>
                        <div className="text-base text-gray-600 dark:text-gray-300">
                          <p>
                            Tổ chức: <span className="font-medium">{formData.orgName}</span>
                          </p>
                          <p>
                            Gói: <span className="font-medium">{selectedPlan?.planName}</span>
                          </p>
                          <p>
                            Chu kỳ thanh toán:{" "}
                            {formData.orgBilling === "monthly"
                              ? "Hàng tháng"
                              : "Hàng năm (Tiết kiệm 33%)"}
                          </p>
                          {selectedPlan && (
                            <p>
                              Số người dùng tối đa:{" "}
                              <span className="font-medium">
                                {selectedPlan.maxUsersPerOrg === -1
                                  ? "Không giới hạn"
                                  : selectedPlan.maxUsersPerOrg}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-base text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        Quay lại
                      </button>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const orgId =
                              createdOrgId || localStorage.getItem("created_org_id");
                            showToast("info", "Bỏ qua thanh toán. Sử dụng gói miễn phí.");
                            setTimeout(() => {
                              if (orgId) {
                                router.push(`/profile/organizations/${orgId}`);
                              } else {
                                router.push("/profile/organizations");
                              }
                            }, 800);
                          }}
                          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-base text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Bỏ qua thanh toán
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPaymentPopup(true)}
                          disabled={paymentLoading}
                          className="px-6 py-2 bg-emerald-500 text-white text-base rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {paymentLoading ? "Đang xử lý..." : "Tiếp tục thanh toán"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {showPaymentPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Chọn phương thức thanh toán
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
              Hãy chọn phương thức thanh toán cho gói{" "}
              {selectedPlan?.planName || "đã chọn"}.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => handlePaymentMethod("payOS")}
                disabled={paymentLoading}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-base">P</span>
                  </div>
                  <div>
                    <p className="text-base font-medium text-gray-900 dark:text-white">
                      PayOS
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Chuyển khoản ngân hàng, mã QR, thẻ ATM
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentPopup(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-base text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
