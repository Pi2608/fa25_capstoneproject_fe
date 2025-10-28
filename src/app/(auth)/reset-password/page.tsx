"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "@/lib/api";
import InputField from "@/components/ui/InputField";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/ui/SubmitButton";
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
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Reset Password</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">Enter the verification code and your new password.</p>
      
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
    </div>
  );
}
