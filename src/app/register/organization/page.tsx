"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { 
  subscribeToPlan, 
  type SubscribeRequest, 
  type SubscribeResponse,
  type PaymentGateway,
} from "@/lib/api-membership";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { getMyOrganizations, OrganizationReqDto, OrganizationResDto } from "@/lib/api-organizations";
import { createProject, CreateProjectRequest } from "@/lib/api-workspaces";
import { postJson } from "@/lib/api-core";

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isLoggedIn } = useAuthStatus();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orgName: "",
    orgPlan: "basic" as "basic" | "pro" | "enterprise",
    orgBilling: "monthly" as "monthly" | "yearly",
    orgSeats: 1
  });
  
  // Payment state
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);


  const getStepInfo = () => {
    switch (step) {
      case 1: return { title: "Name your Organization", subtitle: "Set up your organization to collaborate with your team on IMOS." };
      case 2: return { title: "IMOS Teams", subtitle: "Select the plan you want to start with:" };
      case 3: return { title: "Payment Setup", subtitle: "Complete your organization setup with secure payment" };
      default: return { title: "Name your Organization", subtitle: "Set up your organization to collaborate with your team on IMOS." };
    }
  };

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

      // Map plan names to plan IDs (you may need to adjust these based on your API)
      const planIdMap = {
        "basic": 1,
        "pro": 2, 
        "enterprise": 3
      };

      const req: SubscribeRequest = {
        userId: "08ddf705-7b38-41a8-8b65-80141dc31d21", // This should come from auth context
        orgId: orgId,
        planId: planIdMap[formData.orgPlan],
        paymentMethod: method,
        autoRenew: true,
      };

      const res: SubscribeResponse = await subscribeToPlan(req);
      localStorage.setItem("planId", String(planIdMap[formData.orgPlan]));
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

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <section className="min-h-[60vh] md:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-full max-w-6xl">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{stepInfo.title}</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">{stepInfo.subtitle}</p>
            
            <div className="space-y-6">
        {/* Step 1: Organization Name */}
        {step === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Organization Name *
                </label>
                <input
                  type="text"
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  placeholder="Enter your organization name"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-800"
                  required
                />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!formData.orgName.trim()}
                  className="w-full mt-6 bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className="space-y-8">
            {/* Billing Period Toggle */}
            <div className="flex justify-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, orgBilling: "monthly" })}
                  className={`px-6 py-2 rounded-md transition-colors ${
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
                  className={`px-6 py-2 rounded-md transition-colors ${
                    formData.orgBilling === "yearly"
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Pay Yearly <span className="text-emerald-500">[Save 33%]</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[
                { id: "basic", name: "Basic", price: { monthly: 0, yearly: 100 }, features: ["Up to 5 maps", "Basic support", "Standard features"] },
                { id: "pro", name: "Pro", price: { monthly: 25, yearly: 250 }, features: ["Up to 25 maps", "Priority support", "Advanced features"] },
                { id: "enterprise", name: "Enterprise", price: { monthly: 50, yearly: 500 }, features: ["Unlimited maps", "24/7 support", "Custom features"] }
              ].map((plan) => (
                <div
                  key={plan.id}
                  className={`p-8 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.orgPlan === plan.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
                  }`}
                  onClick={() => setFormData({ ...formData, orgPlan: plan.id as "basic" | "pro" | "enterprise" })}
                >
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">{plan.name}</h3>
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                      ${formData.orgBilling === "monthly" ? plan.price.monthly : plan.price.yearly}
                      <span className="text-lg text-gray-500 dark:text-gray-400">
                        /{formData.orgBilling === "monthly" ? "mo" : "yr"}
                      </span>
                    </div>
                    {plan.price.monthly > 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        ${formData.orgBilling === "monthly" ? plan.price.monthly : plan.price.yearly}/month
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">Includes:</h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">✓</span>
                          <span className="leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {formData.orgPlan === plan.id && (
                    <div className="mt-6">
                      <div className="w-full py-2 bg-emerald-500 text-white rounded-lg font-medium text-center text-sm">
                        Selected
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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

                    const orgResponse = await postJson<OrganizationReqDto, OrganizationResDto>("/organizations", orgRequest);
                    
                    // Get the created organization ID
                    const orgs = await getMyOrganizations();
                    const latestOrg = orgs.organizations?.[0];
                    if (latestOrg) {
                      setCreatedOrgId(latestOrg.orgId);
                      localStorage.setItem("created_org_id", latestOrg.orgId);

                      // Auto-create a default project for this organization
                      try {
                        const projReq: CreateProjectRequest = {
                          orgId: latestOrg.orgId,
                          workspaceName: `${formData.orgName} Workspace`,
                          description: "Default project",
                          access: "AllMembers",
                        };
                        await createProject(projReq);
                        // Optionally remember last project name/id by refetching list later
                      } catch (e) {
                        console.warn("Auto-create project failed:", e);
                      }
                    }
                    
                    // Save organization data to localStorage for reference
                    localStorage.setItem("org_name", formData.orgName);
                    localStorage.setItem("org_plan", JSON.stringify({
                      type: formData.orgPlan,
                      billing: formData.orgBilling,
                      seats: formData.orgSeats
                    }));
                    
                    // Check if plan requires payment
                    const isPaidPlan = formData.orgPlan !== "basic";
                    
                    if (isPaidPlan) {
                      // Move to payment step
                      setStep(3);
                      showToast("success", "Organization created! Now let's set up payment.");
                    } else {
                      // Free plan - complete setup
                      showToast("success", "Organization ready! 🎉");
                      setTimeout(() => {
                        const orgId = latestOrg?.orgId || createdOrgId;
                        if (orgId) {
                          router.push(`/profile/organizations/${orgId}`);
                        } else {
                          router.push("/profile/organizations");
                        }
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
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Complete Your Setup
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  You've selected the <span className="font-semibold text-emerald-600">{formData.orgPlan}</span> plan. 
                  Let's set up your payment to activate your organization.
                </p>
                
                {/* Plan Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-medium text-gray-900 dark:text-white">Plan Details</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      ${formData.orgPlan === "basic" ? "0" : formData.orgPlan === "pro" ? "25" : "50"}
                      <span className="text-sm text-gray-500">/{formData.orgBilling === "monthly" ? "mo" : "yr"}</span>
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <p>Organization: <span className="font-medium">{formData.orgName}</span></p>
                    <p>Billing: {formData.orgBilling === "monthly" ? "Monthly" : "Yearly"}</p>
                    <p>Seats: {formData.orgSeats}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  Back
                </button>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      showToast("success", "Organization created successfully! 🎉");
                      setTimeout(() => {
                        const orgId = createdOrgId || localStorage.getItem("created_org_id");
                        if (orgId) {
                          router.push(`/profile/organizations/${orgId}`);
                        } else {
                          router.push("/profile/organizations");
                        }
                      }, 1000);
                    }}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Skip Payment (Free Plan)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setShowPaymentPopup(true)}
                    disabled={paymentLoading}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Select Payment Method</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Choose your preferred payment method for the {formData.orgPlan} plan.
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handlePaymentMethod("payOS")}
                disabled={paymentLoading}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">P</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">PayOS</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Bank transfer, QR code, ATM</p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentPopup(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
