"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordVerify } from "@/lib/api";
import { getApiMessage } from "@/lib/errors";
import AuthLayout from "@/components/auth/AuthLayout";
import InputField from "@/components/auth/InputField";
import SubmitButton from "@/components/auth/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);
    setLoading(true);
    try {
      await resetPasswordVerify({ email });
      router.push("/reset-password");
    } catch (err: unknown) {
      setToast("Invalid email address");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email address and we'll send you a verification code to reset your password."
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <InputField
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          label="Email"
          required
        />

        <SubmitButton loading={loading} disabled={!email}>
          Send Code
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/login", text: "Back to login" }
        ]}
      />
    </AuthLayout>
  );
}
