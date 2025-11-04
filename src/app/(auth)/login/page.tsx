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
      try {
        const me = await getMe();
        const role = (me.role || "").toLowerCase();
        
        if (role === "admin") {
          showToast("success", "Welcome, Admin! Redirecting to dashboard...");
          setTimeout(() => router.push("/dashboard"), 800);
          return;
        }
        
        if (me.lastLogin === null || me.lastLogin === undefined) {
          showToast("success", "Login successful! Let's set up your account...");
          setTimeout(() => router.push("/login/account-type"), 800);
        } else {
          showToast("success", "Login successful! Redirecting...");
          setTimeout(() => router.push("/"), 800);
        }
      } catch {
        showToast("success", "Login successful! Redirecting...");
        setTimeout(() => router.push("/"), 800);
      }
    } catch {
      showToast("error", "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome back</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">Sign in to your account</p>

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

        <SubmitButton loading={loading} disabled={!email || !password || loading}>
          Sign in
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/forgot-password", text: "Forgot your password?" },
          { href: "/register", text: "Create an account" },
        ]}
        className="space-y-2"
      />
    </div>
  );
}
