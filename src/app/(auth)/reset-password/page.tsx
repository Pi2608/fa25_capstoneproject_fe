"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/api";
import AuthLayout from "@/components/auth/AuthLayout";
import InputField from "@/components/auth/InputField";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import AuthLinks from "@/components/auth/AuthLinks";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);

    if (newPassword.length < 8) {
      setToast("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ otp, newPassword, confirmPassword });
      router.push("/login");
    } catch (err: unknown) {
      setToast("Invalid verification code or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter the verification code and your new password."
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <InputField
          value={otp}
          onChange={setOtp}
          placeholder="Enter 6-digit code"
          label="Verification Code (OTP)"
          required
        />

        <PasswordInput
          value={newPassword}
          onChange={setNewPassword}
          placeholder="••••••••"
          label="New Password"
          required
        />

        <PasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          label="Confirm New Password"
          required
        />

        <SubmitButton 
          loading={loading} 
          disabled={!otp || !newPassword || !confirmPassword}
        >
          Reset Password
        </SubmitButton>
      </form>

      <AuthLinks
        links={[
          { href: "/forgot-password", text: "Resend code" },
          { href: "/login", text: "Back to login" }
        ]}
      />
    </AuthLayout>
  );
}
