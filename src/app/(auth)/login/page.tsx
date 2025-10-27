"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { login, getJson } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import { isFirstTimeUser } from "@/utils/authUtils";
import AuthLayout from "@/components/auth/AuthLayout";
import InputField from "@/components/auth/InputField";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";
import { AuthFormErrors } from "@/types/auth";
import { adminGetSystemDashboard } from "@/lib/admin-api";

const ADMIN_EMAIL = "admin@cusommaposm.com";

interface MeProfile {
  email?: string;
  role?: string;
  full_name?: string;
  phone?: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function readJwtClaims(): Record<string, unknown> | null {
  try {
    if (typeof window === "undefined") return null;
    const token =
      localStorage.getItem("token") ?? localStorage.getItem("access_token");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(payload) : "";
    if (!json) return null;
    const obj = JSON.parse(json) as Record<string, unknown>;
    return obj;
  } catch {
    return null;
  }
}

function isAdminFromToken(): boolean {
  const claims = readJwtClaims();
  if (!claims) return false;

  const role =
    (claims["role"] as string | undefined) ??
    (claims["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] as
      | string
      | undefined);
  if (isNonEmptyString(role) && role === "Admin") return true;

  const emailClaim =
    (claims["email"] as string | undefined) ??
    (claims[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
    ] as string | undefined) ??
    (claims["preferred_username"] as string | undefined) ??
    (claims["unique_name"] as string | undefined);
  if (isNonEmptyString(emailClaim) && emailClaim.toLowerCase() === ADMIN_EMAIL)
    return true;

  return false;
}

async function fetchMeProfile(): Promise<MeProfile | null> {
  const endpoints: ReadonlyArray<string> = [
    "/user/me",
    "/users/me",
    "/account/me",
    "/me",
  ];
  for (const ep of endpoints) {
    try {
      const me = await getJson<MeProfile>(ep);
      if (me) return me;
    } catch {
    }
  }
  return null;
}

async function probeAdminApi(): Promise<boolean> {
  try {
    await adminGetSystemDashboard<void>();
    return true; 
  } catch {
    return false;
  }
}

export default function Page(): JSX.Element {
  const router = useRouter();
  const { showToast } = useToast();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<AuthFormErrors>({});

  const validate = useCallback((): boolean => {
    const next: AuthFormErrors = {};
    if (!email) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Invalid email format";
    if (!password) next.password = "Password is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [email, password]);

  const onSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login({ email, password });

      const [me, tokenAdmin, apiAdmin] = await Promise.all([
        fetchMeProfile(),
        Promise.resolve(isAdminFromToken()),
        probeAdminApi(),
      ]);

      const meEmail =
        me && isNonEmptyString(me.email) ? me.email.toLowerCase() : "";

      const shouldGoDashboard =
        apiAdmin || tokenAdmin || meEmail === ADMIN_EMAIL;

      if (shouldGoDashboard) {
        showToast("success", "Welcome, Admin!");
        router.replace("/dashboard");
        return;
      }

      // 3) Người dùng thường
      const firstTime = isFirstTimeUser();
      if (firstTime) {
        showToast("success", "Login successful! Let's set up your account...");
        router.replace("/login/account-type");
      } else {
        showToast("success", "Login successful! Redirecting…");
        router.replace("/");
      }
    } catch {
      showToast("error", "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <InputField
          type="email"
          value={email}
          onChange={(v: string) => {
            setEmail(v);
            if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
          }}
          placeholder="you@example.com"
          label="Email"
          required
        />
        {errors.email && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.email}
          </p>
        )}

        <PasswordInput
          value={password}
          onChange={(v: string) => {
            setPassword(v);
            if (errors.password)
              setErrors((p) => ({ ...p, password: undefined }));
          }}
          placeholder="••••••••"
          label="Password"
          required
        />
        {errors.password && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.password}
          </p>
        )}

        <SubmitButton loading={loading} disabled={!email || !password}>
          Sign in
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/forgot-password", text: "Reset" },
          { href: "/register", text: "Create an account" },
        ]}
        className="space-y-2"
      />
    </AuthLayout>
  );
}
