/**
 * Authentication & Authorization API
 */

import { getJson, postJson, setAuthTokens, ApiErrorShape, apiFetch } from "./api-core";

// ===== LOGIN / REGISTER =====
export type LoginRequest = { email: string; password: string };
export type LoginResponse = { accessToken?: string; token?: string; refreshToken?: string };

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type RegisterResponse = { userId: string };

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const response = await postJson<LoginRequest, LoginResponse>("/auth/login", req);
  
  if (response.token ) {
    setAuthTokens({
      accessToken: response.token,
      refreshToken: response.refreshToken
    });
  }
  
  return response;
}

export function register(req: RegisterRequest) {
  return postJson<RegisterRequest, RegisterResponse>("/auth/register", req);
}

// ===== USER INFO =====
export type MeRaw = {
  user: {
    userId: string
    email: string
    fullName: string
    phone?: string | null
    role: string
    accountStatus?: string | null
    createdAt?: string | null
    lastLogin?: string | null
  }
}

export type Me = {
  userId: string
  email: string
  fullName: string
  phone?: string | null
  role: string
  accountStatus?: string | null
  createdAt?: string | null
  lastLogin?: string | null
}

export async function getMe(): Promise<Me> {
  const r = await getJson<MeRaw | Me>("/user/me");
  if (r && typeof r === "object" && "user" in r) {
    return (r as MeRaw).user;
  }
  return r as Me;
}

// ===== PASSWORD RESET =====
export type ResetPasswordVerifyReq = { email: string };
export type ResetPasswordVerifyRes = { message?: string };

export function resetPasswordVerify(req: ResetPasswordVerifyReq) {
  return postJson<ResetPasswordVerifyReq, ResetPasswordVerifyRes>(
    "/auth/reset-password-verify",
    req
  );
}

export type ResetPasswordReq = {
  otp: string;
  newPassword: string;
  confirmPassword: string;
};
export type ResetPasswordRes = { message?: string };

export function resetPassword(req: ResetPasswordReq) {
  return postJson<ResetPasswordReq, ResetPasswordRes>("/auth/reset-password", req);
}

// ===== EMAIL VERIFICATION =====
export type VerifyEmailReq = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  password: string;
};
export type VerifyEmailRes = { message?: string };

export function verifyEmail(req: VerifyEmailReq) {
  return postJson<VerifyEmailReq, VerifyEmailRes>("/auth/verify-email", req);
}

export type VerifyOtpReq = { otp: string };
export type VerifyOtpRes = { message?: string };

export function verifyOtp(req: VerifyOtpReq) {
  return postJson<VerifyOtpReq, VerifyOtpRes>("/auth/verify-otp", req);
}
