"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterFormData, RegisterErrors } from "@/types/register";
import { useRegisterValidation } from "@/hooks/useRegisterValidation";
import { postJson } from "@/lib/api";
import { prettyError, splitVietnameseName } from "@/utils/registerUtils";
import { setFirstTimeUser, clearRegistrationData } from "@/utils/authUtils";
import { useToast } from "@/contexts/ToastContext";
import AuthLinks from "@/components/auth/AuthLinks";
import Step1BasicRegistration from "@/components/register/Step1BasicRegistration";
import Step2OTPVerification from "@/components/register/Step2OTPVerification";

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    agree: false,
    showPass: false,
    otp: "",
  });

  const { validateStep1, validateStep2 } = useRegisterValidation();

  // Load cached data
  useEffect(() => {
    try {
      const cachedEmail = typeof window !== "undefined" ? localStorage.getItem("reg_email") : null;
      const cachedName = typeof window !== "undefined" ? localStorage.getItem("reg_name") : null;
      if (cachedEmail && cachedName) {
        const { firstName, lastName } = JSON.parse(cachedName);
        if (!formData.name) setFormData(prev => ({ ...prev, name: [lastName, firstName].filter(Boolean).join(" ") }));
        if (!formData.email) setFormData(prev => ({ ...prev, email: cachedEmail }));
      }
    } catch {
    }
  }, [formData.name, formData.email]);

  const handleUpdate = useCallback((updates: Partial<RegisterFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSetErrors = useCallback((updates: Partial<RegisterErrors>) => {
    setErrors(prev => ({ ...prev, ...updates }));
  }, []);

  const handleBack = useCallback(() => {
    setStep(Math.max(step - 1, 1) as 1 | 2);
  }, [step]);

  // Submit handlers
  const submitStep1 = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateStep1(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast("error", "Please complete all required fields.");
      return;
    }
    setLoading(true);
    try {
      // Clear any existing registration data
      clearRegistrationData();
      
      let firstName: string, lastName: string;
      try {
        ({ firstName, lastName } = splitVietnameseName(formData.name));
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : "Please enter your full name");
        setLoading(false);
        return;
      }
      await postJson("/auth/verify-email", {
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone || null,
        password: formData.password,
      });
      try {
        localStorage.setItem("reg_name", JSON.stringify({ firstName, lastName }));
        localStorage.setItem("reg_email", formData.email);
      } catch {
      }
      showToast("success", "Verification code sent. Please check your inbox.");
      setStep(2);
    } catch (e: unknown) {
      showToast("error", prettyError(e, "Could not send verification code. Please try again later."));
    } finally {
      setLoading(false);
    }
  }, [formData, validateStep1, showToast]);

  const submitStep2 = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateStep2(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      await postJson("/auth/verify-otp", { otp: formData.otp });
      
      // Mark as first-time user
      setFirstTimeUser(formData.email);
      
      showToast("success", "Email verified successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 1000);
    } catch (e: unknown) {
      showToast("error", prettyError(e, "The verification code is invalid or expired."));
    } finally {
      setLoading(false);
    }
  }, [formData, validateStep2, router, showToast]);

  const getSubmitHandler = useCallback(() => {
    switch (step) {
      case 1: return submitStep1;
      case 2: return submitStep2;
      default: return submitStep1;
    }
  }, [step, submitStep1, submitStep2]);

  const getStepInfo = useCallback(() => {
    switch (step) {
      case 1: return { title: "Create your account", subtitle: "Join and start building maps" };
      case 2: return { title: "Verify your email", subtitle: "Enter the verification code we sent to your email" };
      default: return { title: "Create your account", subtitle: "Join and start building maps" };
    }
  }, [step]);

  const stepProps = {
    formData,
    errors,
    loading,
    onUpdate: handleUpdate,
    onSetErrors: handleSetErrors,
    onBack: handleBack,
    onSubmit: getSubmitHandler(),
  };

  const stepInfo = getStepInfo();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{stepInfo.title}</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">{stepInfo.subtitle}</p>
      
      {step > 1 && (
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      )}

      {step === 1 && <Step1BasicRegistration {...stepProps} />}
      {step === 2 && <Step2OTPVerification {...stepProps} />}
      
      {step === 1 && (
        <AuthLinks
          links={[
            { href: "/login", text: "Already have an account? Sign in" }
          ]}
          className="mt-6"
        />
      )}
    </div>
  );
}