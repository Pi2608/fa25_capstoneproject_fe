"use client";

import { useMemo } from "react";
import { RegisterStepProps } from "@/types/register";

export default function Step1BasicRegistration({
  formData,
  errors,
  loading,
  onUpdate,
  onSetErrors,
  onSubmit
}: RegisterStepProps) {
  const passScore = useMemo<number>(() => {
    let s = 0;
    if (formData.password.length >= 8) s++;
    if (/[A-Z]/.test(formData.password)) s++;
    if (/[a-z]/.test(formData.password)) s++;
    if (/\d/.test(formData.password)) s++;
    if (/[^A-Za-z0-9]/.test(formData.password)) s++;
    return Math.min(s, 4);
  }, [formData.password]);

  const scoreLabel = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][passScore];

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Full name *
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
            placeholder="John Doe"
            aria-invalid={!!errors.name}
            autoComplete="name"
          />
          {errors.name && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email *
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
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            autoComplete="email"
          />
          {errors.email && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Phone (optional)
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
          placeholder="0912345678"
          aria-invalid={!!errors.phone}
          autoComplete="tel"
          inputMode="tel"
          maxLength={10}
        />
        {errors.phone && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>}
      </div>


      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Password
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
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => onUpdate({ showPass: !formData.showPass })}
            aria-label={formData.showPass ? "Hide password" : "Show password"}
          >
            {formData.showPass ? "Hide" : "Show"}
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
          Confirm password
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
          placeholder="Re-enter your password"
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
          I agree to the <a className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400" href="/terms">Terms</a> and <a className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400" href="/privacy">Privacy Policy</a>.
        </span>
      </div>
      {errors.agree && <p className="text-sm text-red-600 dark:text-red-400">{errors.agree}</p>}

      <button 
        className="w-full bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="submit" 
        disabled={loading || !formData.name || !formData.email || !formData.password || !formData.confirm || !formData.agree}
      >
        {loading ? "Sending…" : "Create account"}
      </button>
    </form>
  );
}
