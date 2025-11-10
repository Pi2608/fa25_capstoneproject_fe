// src/components/register/Step1BasicRegistration.tsx
"use client";

import { useMemo } from "react";
import { RegisterStepProps } from "@/types/register";
import { useI18n } from "@/i18n/I18nProvider";

export default function Step1BasicRegistration({
  formData,
  errors,
  loading,
  onUpdate,
  onSetErrors,
  onSubmit
}: RegisterStepProps) {
  const { t } = useI18n();

  const passScore = useMemo<number>(() => {
    let s = 0;
    if (formData.password.length >= 8) s++;
    if (/[A-Z]/.test(formData.password)) s++;
    if (/[a-z]/.test(formData.password)) s++;
    if (/\d/.test(formData.password)) s++;
    if (/[^A-Za-z0-9]/.test(formData.password)) s++;
    return Math.min(s, 4);
  }, [formData.password]);

  const scoreLabel =
    [
      t("register", "passVeryWeak"),
      t("register", "passWeak"),
      t("register", "passFair"),
      t("register", "passStrong"),
      t("register", "passVeryStrong"),
    ][passScore] ?? "";

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("register", "fullNameLabel")} *
          </label>
          <input
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
              errors.name
                ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            }`}
            type="text"
            value={formData.name}
            onChange={(e) => {
              onUpdate({ name: e.target.value });
              if (errors.name) onSetErrors({ name: undefined });
            }}
            placeholder={t("register", "fullNamePlaceholder")}
            aria-invalid={!!errors.name}
            autoComplete="name"
          />
          {errors.name && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("auth", "emailLabel")} *
          </label>
          <input
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
              errors.email
                ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            }`}
            type="email"
            value={formData.email}
            onChange={(e) => {
              onUpdate({ email: e.target.value });
              if (errors.email) onSetErrors({ email: undefined });
            }}
            placeholder={t("auth", "emailPlaceholder")}
            aria-invalid={!!errors.email}
            autoComplete="email"
          />
          {errors.email && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("register", "phoneLabel")}
        </label>
        <input
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
            errors.phone
              ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          }`}
          type="tel"
          value={formData.phone}
          onChange={(e) => {
            onUpdate({ phone: e.target.value.replace(/[^\d]/g, "") });
            if (errors.phone) onSetErrors({ phone: undefined });
          }}
          placeholder={t("register", "phonePlaceholder")}
          aria-invalid={!!errors.phone}
          autoComplete="tel"
          inputMode="tel"
          maxLength={10}
        />
        {errors.phone && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("auth", "passwordLabel")}
        </label>
        <div className="relative">
          <input
            className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
              errors.password
                ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            }`}
            type={formData.showPass ? "text" : "password"}
            value={formData.password}
            onChange={(e) => {
              onUpdate({ password: e.target.value });
              if (errors.password) onSetErrors({ password: undefined });
            }}
            placeholder={t("auth", "passwordPlaceholder")}
            aria-invalid={!!errors.password}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => onUpdate({ showPass: !formData.showPass })}
            aria-label={formData.showPass ? t("register", "hidePassword") : t("register", "showPassword")}
          >
            {formData.showPass ? t("register", "hidePassword") : t("register", "showPassword")}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2" aria-hidden="true">
          <div className={`h-2 w-14 rounded-full ${passScore >= 1 ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
          <div className={`h-2 w-14 rounded-full ${passScore >= 2 ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
          <div className={`h-2 w-14 rounded-full ${passScore >= 3 ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
          <div className={`h-2 w-14 rounded-full ${passScore >= 4 ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{formData.password ? scoreLabel : ""}</span>
        </div>
        {errors.password && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.password}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("register", "confirmPasswordLabel")}
        </label>
        <input
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors ${
            errors.confirm
              ? "border-red-300 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          }`}
          type="password"
          value={formData.confirm}
          onChange={(e) => {
            onUpdate({ confirm: e.target.value });
            if (errors.confirm) onSetErrors({ confirm: undefined });
          }}
          placeholder={t("register", "confirmPasswordPlaceholder")}
          aria-invalid={!!errors.confirm}
          autoComplete="new-password"
        />
        {errors.confirm && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.confirm}</p>}
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={formData.agree}
          onChange={(e) => {
            onUpdate({ agree: e.target.checked });
            if (errors.agree) onSetErrors({ agree: undefined });
          }}
          className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {t("register", "agreePrefix")}{" "}
          <a className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400" href="/terms">
            {t("footer", "terms")}
          </a>{" "}
          {t("register", "and")}{" "}
          <a className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400" href="/privacy">
            {t("footer", "privacy")}
          </a>.
        </span>
      </div>
      {errors.agree && <p className="text-sm text-red-600 dark:text-red-400">{errors.agree}</p>}

      <button
        className="w-full bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="submit"
        disabled={
          loading ||
          !formData.name ||
          !formData.email ||
          !formData.password ||
          !formData.confirm ||
          !formData.agree
        }
      >
        {loading ? t("register", "creating") : t("register", "createAccount")}
      </button>
    </form>
  );
}
