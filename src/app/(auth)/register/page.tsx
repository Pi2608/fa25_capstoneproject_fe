"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterFormData, RegisterErrors } from "@/types/register";
import { useRegisterValidation } from "@/hooks/useRegisterValidation";
import { prettyError, splitVietnameseName } from "@/utils/registerUtils";
import { setFirstTimeUser, clearRegistrationData } from "@/utils/authUtils";
import { useToast } from "@/contexts/ToastContext";
import { verifyEmail, verifyOtp } from "@/lib/api-auth";
import AuthLinks from "@/components/auth/AuthLinks";
import Step1BasicRegistration from "@/components/register/Step1BasicRegistration";
import Step2OTPVerification from "@/components/register/Step2OTPVerification";
import { useI18n } from "@/i18n/I18nProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();

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

  useEffect(() => {
    try {
      const cachedEmail = typeof window !== "undefined" ? localStorage.getItem("reg_email") : null;
      const cachedName = typeof window !== "undefined" ? localStorage.getItem("reg_name") : null;
      if (cachedEmail && cachedName) {
        const { firstName, lastName } = JSON.parse(cachedName) as { firstName: string; lastName: string };
        if (!formData.name) setFormData(prev => ({ ...prev, name: [lastName, firstName].filter(Boolean).join(" ") }));
        if (!formData.email) setFormData(prev => ({ ...prev, email: cachedEmail }));
      }
    } catch {}
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

  const submitStep1 = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateStep1(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast("error", t("register", "errorFillRequired"));
      return;
    }
    setLoading(true);
    try {
      clearRegistrationData();

      let firstName: string;
      let lastName: string;
      try {
        ({ firstName, lastName } = splitVietnameseName(formData.name));
      } catch (error) {
        showToast("error", error instanceof Error ? error.message : t("register", "errorNameParse"));
        setLoading(false);
        return;
      }

      await verifyEmail({
        firstName,
        lastName,
        email: formData.email,
        phone: formData.phone || null,
        password: formData.password,
      });

      try {
        localStorage.setItem("reg_name", JSON.stringify({ firstName, lastName }));
        localStorage.setItem("reg_email", formData.email);
      } catch {}

      showToast("success", t("register", "toastOtpSent"));
      setStep(2);
    } catch (e: unknown) {
      showToast("error", prettyError(e, t("register", "errorSendOtp")));
    } finally {
      setLoading(false);
    }
  }, [formData, validateStep1, showToast, t]);

  const submitStep2 = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateStep2(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      await verifyOtp({ otp: formData.otp });
      setFirstTimeUser(formData.email);
      showToast("success", t("register", "toastVerifySuccess"));
      setTimeout(() => router.push("/login"), 1000);
    } catch (e: unknown) {
      showToast("error", prettyError(e, t("register", "errorOtpInvalid")));
    } finally {
      setLoading(false);
    }
  }, [formData, validateStep2, router, showToast, t]);

  const getSubmitHandler = useCallback(() => {
    switch (step) {
      case 1: return submitStep1;
      case 2: return submitStep2;
      default: return submitStep1;
    }
  }, [step, submitStep1, submitStep2]);

  const getStepInfo = useCallback(() => {
    switch (step) {
      case 1: return { title: t("register", "createTitle"), subtitle: t("register", "createSubtitle") };
      case 2: return { title: t("register", "verifyTitle"), subtitle: t("register", "verifySubtitle") };
      default: return { title: t("register", "createTitle"), subtitle: t("register", "createSubtitle") };
    }
  }, [step, t]);

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
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("register", "back")}
          </button>
        </div>
      )}

      {step === 1 && <Step1BasicRegistration {...stepProps} />}
      {step === 2 && <Step2OTPVerification {...stepProps} />}

      {step === 1 && (
        <AuthLinks
          links={[{ href: "/login", text: t("register", "haveAccount") }]}
          className="mt-6"
        />
      )}
    </div>
  );
}
