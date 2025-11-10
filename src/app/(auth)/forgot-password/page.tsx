"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InputField from "@/components/ui/InputField";
import SubmitButton from "@/components/ui/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";
import { resetPasswordVerify } from "@/lib/api-auth";
import { useI18n } from "@/i18n/I18nProvider";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    setLoading(true);
    try {
      await resetPasswordVerify({ email });
      router.push("/reset-password");
    } catch {
      setToast(t("forgot", "invalidEmail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">
        {t("forgot", "title")}
      </h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">
        {t("forgot", "subtitle")}
      </p>

      <form onSubmit={submit} className="space-y-6" noValidate>
        <InputField
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t("auth", "emailPlaceholder")}
          label={t("auth", "emailLabel")}
          required
        />

        {toast && (
          <p className="text-sm text-red-600 dark:text-red-400">{toast}</p>
        )}

        <SubmitButton loading={loading} disabled={!email}>
          {t("forgot", "sendCode")}
        </SubmitButton>
      </form>

      <AuthLinks
        links={[{ href: "/login", text: t("forgot", "backToLogin") }]}
      />
    </div>
  );
}
