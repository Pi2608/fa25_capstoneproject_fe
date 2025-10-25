import { UnknownApiError, NameParts } from "@/types/register";

export const phoneValid = (v: string) => /^\d{10}$/.test(v);
export const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function hasNumber(x: Record<string, unknown>, key: string): x is Record<string, number | unknown> {
  return key in x && typeof x[key] === "number";
}

export function hasString(x: Record<string, unknown>, key: string): x is Record<string, string | unknown> {
  return key in x && typeof x[key] === "string";
}

export function splitVietnameseName(fullName: string): NameParts {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ");
  if (parts.length < 2) {
    throw new Error("Please enter your full name");
  }
  const lastName = parts[0] ?? "";
  const firstName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export function prettyError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  try {
    if (isPlainObject(err)) {
      const obj = err as Record<string, unknown>;

      if (hasNumber(obj, "status")) {
        const st = obj.status as number;
        if (st === 429) return "Too many attempts. Please try again in a moment.";
        if (st === 401) return "You are not authorized to perform this action.";
        if (st === 403) return "You don't have permission to access this resource.";
        if (st === 404) return "Requested resource was not found.";
        if (st >= 500) return "The server is busy. Please try again later.";
      }

      const msgLike: string[] = [];
      if (hasString(obj, "message")) msgLike.push(String(obj.message));
      if (hasString(obj, "detail")) msgLike.push(String(obj.detail));
      if (hasString(obj, "title")) msgLike.push(String(obj.title));
      if (hasString(obj, "type")) msgLike.push(String(obj.type));

      for (const msg of msgLike) {
        if (/already exists/i.test(msg)) return "This email is already registered. Please use a different email.";
        if (/otp/i.test(msg) && /invalid|expired/i.test(msg)) return "The verification code is invalid or expired.";
        if (/too many/i.test(msg) || /rate/i.test(msg)) return "Too many attempts. Please try again later.";
        if (/500|internal server/i.test(msg)) return "The server is busy. Please try again later.";
      }

      if (msgLike.length > 0) return msgLike[0]!;
    }

    if (typeof err === "string") {
      try {
        const j = JSON.parse(err) as unknown;
        return prettyError(j, fallback);
      } catch {
        const s = err;
        if (/already exists/i.test(s)) return "This email is already registered. Please use a different email.";
        if (/otp/i.test(s) && /invalid|expired/i.test(s)) return "The verification code is invalid or expired.";
        if (/500|internal server/i.test(s)) return "The server is busy. Please try again later.";
        return s;
      }
    }
  } catch {
  }
  return fallback;
}
