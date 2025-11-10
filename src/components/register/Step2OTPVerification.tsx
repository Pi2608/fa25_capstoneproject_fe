// src/components/register/Step2OTPVerification.tsx
"use client";

import { RegisterStepProps } from "@/types/register";
import { useI18n } from "@/i18n/I18nProvider";

export default function Step2OTPVerification({
  formData,
  errors,
  loading,
  onUpdate,
  onSetErrors,
  onSubmit
}: RegisterStepProps) {
  const { t } = useI18n();

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("register", "otpLabel")}
        </label>
        <div className="flex gap-3">
          <input
            className={`flex-1 px-4 py-3 border rounded-lg text-center text-lg font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
              errors.otp
                ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            }`}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={formData.otp}
            onChange={(e) => {
              onUpdate({ otp: e.target.value.replace(/\D/g, "") });
              if (errors.otp) onSetErrors({ otp: undefined });
            }}
            placeholder={t("register", "otpPlaceholder")}
            aria-invalid={!!errors.otp}
            autoFocus
          />
          <button
            type="submit"
            className="bg-emerald-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !formData.otp}
          >
            {loading ? t("register", "verifying") : t("register", "verifyAndFinish")}
          </button>
        </div>
        {errors.otp && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.otp}</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{t("register", "noCode")}</span>
        <button
          type="button"
          className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
          onClick={async () => {}}
        >
          {t("register", "resendCode")}
        </button>
      </div>
    </form>
  );
}
