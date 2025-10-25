"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { isFirstTimeUser } from "@/utils/authUtils";
import { useToast } from "@/contexts/ToastContext";
import AuthLayout from "@/components/auth/AuthLayout";
import InputField from "@/components/auth/InputField";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";
import { AuthFormErrors } from "@/types/auth";

export default function LoginClientSimple() {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<AuthFormErrors>({});


  const validate = useCallback(() => {
    const newErrors: AuthFormErrors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email format";
    if (!password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email, password });
      
      const isFirstTime = isFirstTimeUser();
      
      if (isFirstTime) {
        showToast("success", "Login successful! Let's set up your account...");
        setTimeout(() => router.push("/login/account-type"), 1000);
      } else {
        showToast("success", "Login successful! Redirecting...");
        setTimeout(() => router.push("/"), 1000);
      }
    } catch (err: unknown) {
      showToast("error", "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account"
    >
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <InputField
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
          }}
          placeholder="you@example.com"
          label="Email"
          required
        />
        {errors.email && <p className="text-sm text-red-600 dark:text-red-400">{errors.email}</p>}

        <PasswordInput
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
          }}
          placeholder="••••••••"
          label="Password"
          required
        />
        {errors.password && <p className="text-sm text-red-600 dark:text-red-400">{errors.password}</p>}

        <SubmitButton loading={loading} disabled={!email || !password}>
          Sign in
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/forgot-password", text: "Reset" },
          { href: "/register", text: "Create an account" }
        ]}
        className="space-y-2"
      />

    </AuthLayout>
  );
}
