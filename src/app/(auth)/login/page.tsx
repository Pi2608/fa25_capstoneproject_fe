"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import InputField from "@/components/ui/InputField";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/ui/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";
import { AuthFormErrors } from "@/types/auth";
import { login, getMe } from "@/lib/api-auth";
import { useI18n } from "@/i18n/I18nProvider";

export default function LoginClientSimple() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<AuthFormErrors>({});

  const validate = useCallback(() => {
    const newErrors: AuthFormErrors = {};
    if (!email) newErrors.email = t("auth", "errEmailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = t("auth", "errEmailFormat");
    if (!password) newErrors.password = t("auth", "errPasswordRequired");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password, t]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email, password });
      try {
        const me = await getMe();
        const role = (me.role || "").toLowerCase();

        if (role === "admin") {
          showToast("success", t("auth", "toastWelcomeAdmin"));
          setTimeout(() => router.push("/dashboard"), 800);
          return;
        }

        const isFirstLogin = !me.lastLogin || me.lastLogin.startsWith("0001-01-01");
        if (isFirstLogin) {
          showToast("success", t("auth", "toastLoginSetup"));
          setTimeout(() => router.push("/login/account-type"), 800);
        } else {
          showToast("success", t("auth", "toastLoginOk"));
          setTimeout(() => router.push("/"), 800);
        }
      } catch {
        showToast("success", t("auth", "toastLoginOk"));
        setTimeout(() => router.push("/"), 800);
      }
    } catch {
      showToast("error", t("auth", "toastLoginFail"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{t("auth", "welcomeBack")}</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">{t("auth", "loginToAccount")}</p>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <InputField
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
          }}
          placeholder={t("auth", "emailPlaceholder")}
          label={t("auth", "emailLabel")}
          required
        />
        {errors.email && <p className="text-sm text-red-600 dark:text-red-400">{errors.email}</p>}

        <PasswordInput
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
          }}
          placeholder={t("auth", "passwordPlaceholder")}
          label={t("auth", "passwordLabel")}
          required
        />
        {errors.password && <p className="text-sm text-red-600 dark:text-red-400">{errors.password}</p>}

        <SubmitButton loading={loading} disabled={!email || !password || loading}>
          {t("auth", "submit")}
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/forgot-password", text: t("auth", "forgotPassword") },
          { href: "/register", text: t("auth", "createAccount") },
        ]}
        className="space-y-2"
      />
    </div>
  );
}
