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
  getMyOrganizations, 
  type OrganizationReqDto 
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
    selectedPlanId: 1, // Default to Free plan (ID: 1)
    orgBilling: "monthly" as "monthly" | "yearly",
    orgSeats: 1
  });
  
  // Payment state
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  // Fetch plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getPlans();
        setPlans(data);
      } catch (error) {
        console.error("Failed to fetch plans:", error);
        showToast("error", "Failed to load plans. Please refresh the page.");
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, [showToast]);


  const getStepInfo = () => {
    switch (step) {
      case 1: return { title: "Name your Organization", subtitle: "Set up your organization to collaborate with your team on IMOS." };
      case 2: return { title: "IMOS Teams", subtitle: "Select the plan you want to start with:" };
      case 3: return { title: "Payment Setup", subtitle: "Complete your organization setup with secure payment" };
      default: return { title: "Name your Organization", subtitle: "Set up your organization to collaborate with your team on IMOS." };
    }
  };

  // Get selected plan details
  const selectedPlan = plans.find(p => p.planId === formData.selectedPlanId);
  const isFreePlan = selectedPlan?.priceMonthly === 0 || selectedPlan?.priceMonthly === null;

  // Payment handlers
  const handlePaymentMethod = async (method: PaymentGateway) => {
    if (!isLoggedIn) {
      showToast("error", "Please login to continue with payment.");
      return;
    }

    setPaymentLoading(true);
    try {
      // Use the created organization ID
      const orgId = createdOrgId || localStorage.getItem("created_org_id");
      
      if (!orgId) {
        showToast("error", "Organization not found. Please try again.");
        return;
      }

      const req: SubscribeRequest = {
        userId: "08ddf705-7b38-41a8-8b65-80141dc31d21", // This should come from auth context
        orgId: orgId,
        planId: formData.selectedPlanId,
        paymentMethod: method,
        autoRenew: true,
      };

      const res: SubscribeResponse = await subscribeToPlan(req);
      localStorage.setItem("planId", String(formData.selectedPlanId));
      localStorage.setItem("orgId", orgId);
      
      // Store the organization ID for redirect after payment success
      localStorage.setItem("redirect_after_payment", `/profile/organizations/${orgId}`);
      
      window.location.href = res.paymentUrl;
    } catch (err) {
      console.error("Payment error:", err);
      showToast("error", "Payment setup failed. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const stepInfo = getStepInfo();

  return (
    <main className="relative min-h-screen text-gray-900 dark:text-white transition-colors">
      <div className="absolute inset-0 -z-20 bg-white dark:bg-[#070b0b]" aria-hidden />
      <div
        className="absolute inset-0 -z-10
                   bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.18),transparent_60%)]
                   dark:bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.12),transparent_60%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10
                   bg-[linear-gradient(to_bottom,rgba(16,185,129,0.08),transparent_35%)]
                   dark:bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06),transparent_35%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-40">
        <div
          className="pointer-events-none absolute inset-x-0 h-20 -z-10
                     bg-[linear-gradient(to_bottom,rgba(255,255,255,0.85),transparent)]
                     dark:bg-[linear-gradient(to_bottom,rgba(7,11,11,0.65),transparent)]"
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
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6">{stepInfo.subtitle}</p>
            
            <div className="space-y-6">
        {/* Step 1: Organization Name */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div>
                <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  placeholder="Enter your organization name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-base text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800"
                  required
                />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!formData.orgName.trim()}
                  className="w-full mt-6 bg-emerald-500 text-white text-base py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Billing Period Toggle */}
            <div className="flex justify-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, orgBilling: "monthly" })}
                  className={`px-6 py-2 text-base rounded-md transition-colors ${
                    formData.orgBilling === "monthly"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Pay Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, orgBilling: "yearly" })}
                  className={`px-6 py-2 text-base rounded-md transition-colors ${
                    formData.orgBilling === "yearly"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Pay Yearly <span className="text-emerald-500">[Save 33%]</span>
                </button>
              </div>
            </div>

            {loadingPlans ? (
              <div className="text-center py-12">
                <p className="text-base text-gray-600 dark:text-gray-300">Loading plans...</p>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-base text-gray-600 dark:text-gray-300">No plans available.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const priceMonthly = plan.priceMonthly ?? 0;
                  const priceYearly = priceMonthly * 12 * 0.67; // 33% discount for yearly
                  const displayPrice = formData.orgBilling === "monthly" ? priceMonthly : priceYearly;
                  
                  // Helper to format number with "unlimited" for -1
                  const formatLimit = (value: number, unit: string = "") => {
                    if (value === -1) return "Unlimited";
                    return `${value}${unit}`;
                  };
                  
                  // Parse features from JSON and create display list - LIMIT to key features
                  let featureList: string[] = [];
                  try {
                    if (plan.features) {
                      const featuresObj = JSON.parse(plan.features);
                      // Convert features object to readable array
                      const featureKeys = Object.keys(featuresObj).filter(k => featuresObj[k] === true);
                      const jsonFeatures = featureKeys.slice(0, 3).map(key => { // Limit to 3 JSON features
                        // Convert snake_case to Title Case
                        return key.split('_').map(word => 
                          word.charAt(0).toUpperCase() + word.slice(1)
                        ).join(' ');
                      });
                      featureList = jsonFeatures;
                    }
                  } catch {
                    // Fallback: create feature list from plan properties
                  }
                  
                  // Add only most important quota information to features
                  const quotaFeatures = [
                    `${formatLimit(plan.maxMapsPerMonth)} maps/month`,
                    `${formatLimit(plan.maxUsersPerOrg)} users`,
                    `${formatLimit(plan.maxCustomLayers)} layers`,
                    plan.prioritySupport ? "Priority support" : null
                  ].filter(Boolean) as string[];
                  
                  featureList = [...featureList, ...quotaFeatures].slice(0, 6); // Max 6 features total

                  return (
                    <div
                      key={plan.planId}
                      className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.selectedPlanId === plan.planId
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                      }`}
                      onClick={() => setFormData({ ...formData, selectedPlanId: plan.planId })}
                    >
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{plan.planName}</h3>
                        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                          ${displayPrice.toFixed(2)}
                          <span className="text-lg text-gray-500 dark:text-gray-400">
                            /{formData.orgBilling === "monthly" ? "mo" : "yr"}
                          </span>
                        </div>
                        {priceMonthly > 0 && formData.orgBilling === "yearly" && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ${priceMonthly.toFixed(2)}/mo billed monthly
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-1">Key Features:</h4>
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
                            Selected
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
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    // Create organization via API
                    const orgRequest: OrganizationReqDto = {
                      orgName: formData.orgName,
                      abbreviation: formData.orgName.substring(0, 3).toUpperCase(),
                      description: `Organization created via registration flow`,
                      contactEmail: "",
                      contactPhone: "",
                      address: ""
                    };

                    const response = await createOrganization(orgRequest);
                    
                    if (!response.orgId) {
                      showToast("error", "Organization created but could not retrieve ID. Please try again.");
                      return;
                    }
                    
                    const newOrgId = response.orgId;
                    setCreatedOrgId(newOrgId);
                    localStorage.setItem("created_org_id", newOrgId);
                    
                    // Check if selected plan is paid
                    if (!isFreePlan) {
                      // Move to payment step
                      setStep(3);
                      showToast("success", "Organization created! Now let's set up payment.");
                    } else {
                      // Free plan - complete setup immediately and redirect to org page
                      showToast("success", "Organization created successfully! 🎉");
                      setTimeout(() => {
                        router.push(`/profile/organizations/${newOrgId}`);
                      }, 1000);
                    }
                  } catch (e: unknown) {
                    console.error("Organization creation error:", e);
                    showToast("error", "Could not create organization. Please try again.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="px-6 py-2 bg-emerald-500 text-white text-base rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating Organization..." : "Continue to Payment"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment Setup */}
        {step === 3 && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div className="text-center mb-8">
                <h3 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
                  Complete Your Setup
                </h3>
                <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
                  You've selected the <span className="font-semibold text-emerald-600">{selectedPlan?.planName || "Selected"}</span> plan. 
                  Let's set up your payment to activate your organization.
                </p>
                
                {/* Plan Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xl font-medium text-gray-900 dark:text-white">Plan Details</span>
                    <span className="text-3xl font-bold text-emerald-600">
                      ${(() => {
                        const monthly = selectedPlan?.priceMonthly ?? 0;
                        const yearly = monthly * 12 * 0.67;
                        const price = formData.orgBilling === "monthly" ? monthly : yearly;
                        return price.toFixed(2);
                      })()}
                      <span className="text-lg text-gray-500">/{formData.orgBilling === "monthly" ? "mo" : "yr"}</span>
                    </span>
                  </div>
                  <div className="text-base text-gray-600 dark:text-gray-300 text-left">
                    <p>Organization: <span className="font-medium">{formData.orgName}</span></p>
                    <p>Plan: <span className="font-medium">{selectedPlan?.planName}</span></p>
                    <p>Billing: {formData.orgBilling === "monthly" ? "Monthly" : "Yearly (Save 33%)"}</p>
                    {selectedPlan && (
                      <p>Max Users: <span className="font-medium">
                        {selectedPlan.maxUsersPerOrg === -1 ? "Unlimited" : selectedPlan.maxUsersPerOrg}
                      </span></p>
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
                  Back
                </button>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const orgId = createdOrgId || localStorage.getItem("created_org_id");
                      showToast("info", "Payment skipped. Using free plan.");
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
                    Skip Payment
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowPaymentPopup(true)}
                    disabled={paymentLoading}
                    className="px-6 py-2 bg-emerald-500 text-white text-base rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {paymentLoading ? "Processing..." : "Proceed to Payment"}
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

      {/* Payment Method Popup */}
      {showPaymentPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Select Payment Method</h2>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
              Choose your preferred payment method for the {selectedPlan?.planName || "selected"} plan.
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bank transfer, QR code, ATM</p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentPopup(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-base text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
