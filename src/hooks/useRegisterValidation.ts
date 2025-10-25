import { useCallback } from "react";
import { RegisterFormData, RegisterErrors } from "@/types/register";
import { phoneValid, emailValid } from "@/utils/registerUtils";

export function useRegisterValidation() {
  const validateStep1 = useCallback((formData: RegisterFormData): RegisterErrors => {
    const errors: RegisterErrors = {};
    if (!formData.name.trim()) errors.name = "Please enter your name.";
    if (!formData.email.trim()) errors.email = "Please enter your email.";
    else if (!emailValid(formData.email)) errors.email = "Invalid email address.";
    if (formData.phone && !phoneValid(formData.phone)) errors.phone = "Phone number must be exactly 10 digits.";
    if (!formData.password.trim()) errors.password = "Please enter a password.";
    else if (formData.password.length < 8) errors.password = "Password must be at least 8 characters.";
    if (!formData.confirm.trim()) errors.confirm = "Please re-enter your password.";
    else if (formData.confirm !== formData.password) errors.confirm = "Passwords do not match.";
    if (!formData.agree) errors.agree = "Please agree to the Terms.";
    return errors;
  }, []);

  const validateStep2 = useCallback((formData: RegisterFormData): RegisterErrors => {
    const errors: RegisterErrors = {};
    if (!formData.otp.trim()) errors.otp = "Please enter the verification code.";
    else if (!/^\d{4,8}$/.test(formData.otp)) errors.otp = "Invalid code.";
    return errors;
  }, []);

  return {
    validateStep1,
    validateStep2,
  };
}
