"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/ui/InputField";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/ui/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";
import { resetPassword } from "@/lib/api-auth";
import { useI18n } from "@/i18n/I18nProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [otp, setOtp] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);

    if (newPassword.length < 8) {
      setToast(t("reset", "errTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast(t("reset", "errMismatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ otp, newPassword, confirmPassword });
      router.push("/login");
    } catch {
      setToast(t("reset", "errInvalid"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">
        {t("reset", "title")}
      </h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        {t("reset", "subtitle")}
      </p>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <InputField
          value={otp}
          onChange={setOtp}
          placeholder={t("reset", "otpPlaceholder")}
          label={t("reset", "otpLabel")}
          required
        />

        <PasswordInput
          value={newPassword}
          onChange={setNewPassword}
          placeholder="••••••••"
          label={t("reset", "newPasswordLabel")}
          required
        />

        <PasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          label={t("reset", "confirmNewPasswordLabel")}
          required
        />

        {toast && (
          <p className="text-sm text-red-600 dark:text-red-400">{toast}</p>
        )}

        <SubmitButton
          loading={loading}
          disabled={!otp || !newPassword || !confirmPassword}
        >
          {t("reset", "submit")}
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/forgot-password", text: t("reset", "resendCode") },
          { href: "/login", text: t("reset", "backToLogin") },
        ]}
      />
    </div>
  );
}
