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
import { useI18n } from "@/i18n/I18nProvider";

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isLoggedIn } = useAuthStatus();
  const { t } = useI18n();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [formData, setFormData] = useState({
    orgName: "",
    selectedPlanId: 1,
    orgBilling: "monthly" as "monthly" | "yearly",
  });

  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getPlans();
        setPlans(data);
      } catch {
        showToast("error", t("orgSetup.toast_plans_error"));
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [showToast, t]);

  const getStepInfo = () => {
    switch (step) {
      case 1:
        return {
          title: t("orgSetup.step1_title"),
          subtitle: t("orgSetup.step1_subtitle"),
        };
      case 2:
        return {
          title: t("orgSetup.step2_title"),
          subtitle: t("orgSetup.step2_subtitle"),
        };
      case 3:
        return {
          title: t("orgSetup.step3_title"),
          subtitle: t("orgSetup.step3_subtitle"),
        };
      default:
        return {
          title: t("orgSetup.step1_title"),
          subtitle: t("orgSetup.step1_subtitle"),
        };
    }
  };

  const selectedPlan = plans.find((p) => p.planId === formData.selectedPlanId);
  const isFreePlan =
    selectedPlan?.priceMonthly === 0 || selectedPlan?.priceMonthly === null;

  const handlePaymentMethod = async (method: PaymentGateway) => {
    if (!isLoggedIn) {
      showToast("error", t("orgSetup.toast_login_required"));
      return;
    }

    setPaymentLoading(true);
    try {
      const orgId = createdOrgId || localStorage.getItem("created_org_id");
      if (!orgId) {
        showToast("error", t("orgSetup.toast_org_not_found"));
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
    } catch {
      showToast("error", t("orgSetup.toast_payment_failed"));
    } finally {
      setPaymentLoading(false);
    }
  };

  const stepInfo = getStepInfo();

  const toVnNumber = (n: number) =>
    new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

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
                        {t("orgSetup.field_org_name")} *
                      </label>
                      <input
                        type="text"
                        value={formData.orgName}
                        onChange={(e) =>
                          setFormData({ ...formData, orgName: e.target.value })
                        }
                        placeholder={t("orgSetup.ph_org_name")}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!formData.orgName.trim()}
                        className="w-full mt-6 bg-emerald-500 text-white text-base py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("orgSetup.btn_continue")}
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
                        className={`px-6 py-2 text-base rounded-md transition-colors ${
                          formData.orgBilling === "monthly"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }`}
                      >
                        {t("orgSetup.billing_monthly")}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, orgBilling: "yearly" })
                        }
                        className={`px-6 py-2 text-base rounded-md transition-colors ${
                          formData.orgBilling === "yearly"
                            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        }`}
                      >
                        {t("orgSetup.billing_yearly")}{" "}
                        <span className="text-emerald-500">{t("orgSetup.save_33")}</span>
                      </button>
                    </div>
                  </div>

                  {loadingPlans ? (
                    <div className="text-center py-12">
                      <p className="text-base text-gray-600 dark:text-gray-300">
                        {t("orgSetup.loading_plans")}
                      </p>
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-base text-gray-600 dark:text-gray-300">
                        {t("orgSetup.no_plans")}
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
                          if (value === -1) return t("orgSetup.unlimited");
                          return `${value}${unit}`;
                        };

                        let featureList: string[] = [];
                        try {
                          if (plan.features) {
                            const featuresObj = JSON.parse(plan.features as string);
                            const featureKeys = Object.keys(featuresObj).filter(
                              (k) => (featuresObj as Record<string, unknown>)[k] === true
                            );
                            const jsonFeatures = featureKeys.slice(0, 3).map((key) => {
                              const title = key
                                .split("_")
                                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(" ");
                              return title;
                            });
                            featureList = jsonFeatures;
                          }
                        } catch { /* ignore */ }

                        const quotaFeatures = [
                          `${formatLimit(plan.maxMapsPerMonth, "")} ${t("orgSetup.unit_maps_per_month")}`,
                          `${formatLimit(plan.maxUsersPerOrg, "")} ${t("orgSetup.unit_users")}`,
                          <span key="layers" title={t("orgSetup.tooltip_layers")}>
                            {`${formatLimit(plan.maxCustomLayers, "")} ${t("orgSetup.unit_layers")}`}
                          </span> as unknown as string,
                          plan.prioritySupport ? t("orgSetup.priority_support") : null,
                        ].filter(Boolean) as string[];

                        featureList = [...featureList, ...quotaFeatures].slice(0, 6);

                        return (
                          <div
                            key={plan.planId}
                            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
                              formData.selectedPlanId === plan.planId
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
                                  /{formData.orgBilling === "monthly" ? t("orgSetup.per_month") : t("orgSetup.per_year")}
                                </span>
                              </div>
                              {priceMonthly > 0 && formData.orgBilling === "yearly" && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {`$${toVnNumber(priceMonthly)}/${t("orgSetup.per_month")} ${t("orgSetup.paid_yearly")}`}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                                {t("orgSetup.key_features")}
                              </h4>
                              <ul className="space-y-2">
                                {featureList.map((feature, index) => (
                                  <li key={index} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                                    <span className="text-emerald-500 mt-0.5">✓</span>
                                    <span className="leading-snug">{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {formData.selectedPlanId === plan.planId && (
                              <div className="mt-4">
                                <div className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium text-center text-sm">
                                  {t("orgSetup.selected")}
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
                      {t("orgSetup.back")}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const orgRequest: OrganizationReqDto = {
                            orgName: formData.orgName,
                            abbreviation: formData.orgName.substring(0, 3).toUpperCase(),
                            description: t("orgSetup.org_created_desc"),
                            contactEmail: "",
                            contactPhone: "",
                            address: "",
                          };

                          const response = await createOrganization(orgRequest);
                          if (!response.orgId) {
                            showToast("error", t("orgSetup.toast_created_no_id"));
                            return;
                          }

                          const newOrgId = response.orgId;
                          setCreatedOrgId(newOrgId);
                          localStorage.setItem("created_org_id", newOrgId);

                          if (!isFreePlan) {
                            setStep(3);
                            showToast("success", t("orgSetup.toast_created_next_payment"));
                          } else {
                            showToast("success", t("orgSetup.toast_created_success"));
                            setTimeout(() => {
                              router.push(`/profile/organizations/${newOrgId}`);
                            }, 1000);
                          }
                        } catch {
                          showToast("error", t("orgSetup.toast_create_failed"));
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading}
                      className="px-6 py-2 bg-emerald-500 text-white text-base rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading
                        ? t("orgSetup.creating_org")
                        : isFreePlan
                        ? t("orgSetup.btn_create_org")
                        : t("orgSetup.btn_continue_payment")}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="max-w-4xl mx-auto space-y-8">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
                    <div className="text-center mb-8">
                      <h3 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
                        {t("orgSetup.finish_setup")}
                      </h3>
                      <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
                        {t("orgSetup.you_chose_plan")}{" "}
                        <span className="font-semibold text-emerald-600">
                          {selectedPlan?.planName || t("orgSetup.chosen")}
                        </span>
                        . {t("orgSetup.setup_payment_to_activate")}
                      </p>

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6 text-left">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xl font-medium text-gray-900 dark:text-white">
                            {t("orgSetup.plan_details")}
                          </span>
                          <span className="text-3xl font-bold text-emerald-600">
                            {(() => {
                              const monthly = selectedPlan?.priceMonthly ?? 0;
                              const yearly = monthly * 12 * 0.67;
                              const price =
                                formData.orgBilling === "monthly" ? monthly : yearly;
                              return `$${toVnNumber(price)}`;
                            })()}
                            <span className="text-lg text-gray-500">
                              /{formData.orgBilling === "monthly" ? t("orgSetup.per_month") : t("orgSetup.per_year")}
                            </span>
                          </span>
                        </div>
                        <div className="text-base text-gray-600 dark:text-gray-300">
                          <p>
                            {t("orgSetup.label_org")}: <span className="font-medium">{formData.orgName}</span>
                          </p>
                          <p>
                            {t("orgSetup.label_plan")}: <span className="font-medium">{selectedPlan?.planName}</span>
                          </p>
                          <p>
                            {t("orgSetup.label_billing_cycle")}:{" "}
                            {formData.orgBilling === "monthly"
                              ? t("orgSetup.billing_cycle_monthly")
                              : t("orgSetup.billing_cycle_yearly")}
                          </p>
                          {selectedPlan && (
                            <p>
                              {t("orgSetup.label_max_users")}:{" "}
                              <span className="font-medium">
                                {selectedPlan.maxUsersPerOrg === -1
                                  ? t("orgSetup.unlimited")
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
                        {t("orgSetup.back")}
                      </button>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const orgId = createdOrgId || localStorage.getItem("created_org_id");
                            showToast("info", t("orgSetup.skip_payment_info"));
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
                          {t("orgSetup.skip_payment")}
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowPaymentPopup(true)}
                          disabled={paymentLoading}
                          className="px-6 py-2 bg-emerald-500 text-white text-base rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {paymentLoading ? t("orgSetup.processing") : t("orgSetup.btn_continue_payment")}
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
              {t("orgSetup.choose_payment_method")}
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
              {t("orgSetup.choose_payment_for_plan")} {selectedPlan?.planName || t("orgSetup.chosen")}.
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
                    <p className="text-base font-medium text-gray-900 dark:text-white">PayOS</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t("orgSetup.payos_subtitle")}
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
                {t("orgSetup.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
