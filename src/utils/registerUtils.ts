import { UnknownApiError, NameParts } from "@/types/register";
import { messages, type Lang } from "@/i18n/messages";

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

/**
 * Get current language from localStorage or default to 'en'
 */
function getCurrentLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("lang") as Lang | null;
  return saved === "vi" || saved === "en" ? saved : "en";
}

/**
 * Get translated message from i18n messages
 */
function t(namespace: "register", key: string): string {
  const lang = getCurrentLang();
  const pack = messages[lang]?.[namespace] as Record<string, unknown> | undefined;
  const msg = pack ? (pack[key] as string | undefined) : undefined;
  return typeof msg === "string" ? msg : key;
}

export function splitVietnameseName(fullName: string): NameParts {
  const clean = fullName.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(" ");
  if (parts.length < 2) {
    throw new Error(t("register", "errorNameParse"));
  }
  const lastName = parts[0] ?? "";
  const firstName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export function prettyError(err: unknown, fallback?: string): string {
  const defaultFallback = fallback ?? t("register", "errorGeneric");
  
  try {
    if (isPlainObject(err)) {
      const obj = err as Record<string, unknown>;

      if (hasNumber(obj, "status")) {
        const st = obj.status as number;
        if (st === 429) return t("register", "errorTooManyAttempts");
        if (st === 401) return t("register", "errorUnauthorized");
        if (st === 403) return t("register", "errorForbidden");
        if (st === 404) return t("register", "errorNotFound");
        if (st >= 500) return t("register", "errorServerBusy");
      }

      const msgLike: string[] = [];
      if (hasString(obj, "message")) msgLike.push(String(obj.message));
      if (hasString(obj, "detail")) msgLike.push(String(obj.detail));
      if (hasString(obj, "title")) msgLike.push(String(obj.title));
      if (hasString(obj, "type")) msgLike.push(String(obj.type));

      for (const msg of msgLike) {
        if (/already exists/i.test(msg)) return t("register", "errorEmailExists");
        if (/otp/i.test(msg) && /invalid|expired|incorrect/i.test(msg)) return t("register", "errorOtpInvalidExpired");
        if (/too many/i.test(msg) || /rate/i.test(msg)) return t("register", "errorRateLimit");
        if (/500|internal server/i.test(msg)) return t("register", "errorServerBusy");
      }

      if (msgLike.length > 0) return msgLike[0]!;
    }

    if (typeof err === "string") {
      try {
        const j = JSON.parse(err) as unknown;
        return prettyError(j, defaultFallback);
      } catch {
        const s = err;
        if (/already exists/i.test(s)) return t("register", "errorEmailExists");
        if (/otp/i.test(s) && /invalid|expired/i.test(s)) return t("register", "errorOtpInvalidExpired");
        if (/500|internal server/i.test(s)) return t("register", "errorServerBusy");
        return s;
      }
    }
  } catch {
  }
  return defaultFallback;
}
