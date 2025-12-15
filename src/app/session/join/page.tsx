"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PinInput } from "@/components/session/PinInput";
import { joinSession, getSessionByCode } from "@/lib/api-ques";
import { toast } from "react-toastify";
import { useI18n } from "@/i18n/I18nProvider";

function JoinSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams?.get("code") || null;
  const { t } = useI18n();

  const [step, setStep] = useState<"pin" | "name">(codeFromUrl ? "name" : "pin");
  const [pin, setPin] = useState(codeFromUrl || "");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    name?: string;
    code: string;
  } | null>(null);

  // If code is in URL (from QR code), verify and skip to name entry
  useEffect(() => {
    if (codeFromUrl && step === "name") {
      (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const session = await getSessionByCode(codeFromUrl);

          if (session.status === "COMPLETED" || session.status === "CANCELLED") {
            setError(t("session", "errorSessionEnded"));
            setStep("pin");
            setIsLoading(false);
            return;
          }

          setSessionInfo({
            name: session.sessionName || "",
            code: codeFromUrl,
          });
          setIsLoading(false);
        } catch (err: any) {
          console.error("Failed to verify session:", err);
          setError(err?.message || t("session", "errorInvalidCode"));
          setStep("pin");
          setIsLoading(false);
        }
      })();
    }
  }, [codeFromUrl, step, t]);

  const handlePinComplete = async (pinCode: string) => {
    setIsLoading(true);
    setError(null);
    setPin(pinCode);

    try {
      // Verify session exists
      const session = await getSessionByCode(pinCode);

      if (session.status === "COMPLETED" || session.status === "CANCELLED") {
        setError(t("session", "errorSessionEnded"));
        setIsLoading(false);
        return;
      }

      setSessionInfo({
        name: session.sessionName || "",
        code: pinCode,
      });

      // Move to name entry step
      setStep("name");
      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to verify session:", err);
      setError(err?.message || t("session", "errorInvalidCode"));
      setIsLoading(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      setError(t("session", "errorEnterName"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const participant = await joinSession({
        sessionCode: pin,
        displayName: displayName.trim(),
      });

      toast.success(`${t("session", "toastWelcome")} ${participant.displayName}!`);

      const session = await getSessionByCode(pin);

      if (!session.mapId) {
        setError(t("session", "errorNoMap"));
        setIsLoading(false);
        return;
      }

      const participantId =
        (participant as any).sessionParticipantId ??
        (participant as any).participantId ??
        (participant as any).id ??
        "";

      const joinedSessionId =
        (participant as any).sessionId ??
        (session as any).sessionId ??
        (session as any).id ??
        "";

      if (!participantId || !joinedSessionId) {
        setError(t("session", "errorNoParticipantInfo"));
        setIsLoading(false);
        return;
      }

      // Save to sessionStorage for view page
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("imos_student_name", displayName.trim());
        window.sessionStorage.setItem("imos_session_code", pin);
        window.sessionStorage.setItem("imos_participant_id", participantId);
        window.sessionStorage.setItem("imos_session_id", joinedSessionId);
      }

      router.push(
        `/storymap/view/${session.mapId}?sessionId=${joinedSessionId}&participantId=${participantId}`
      );

    } catch (err: any) {
      console.error("Failed to join session:", err);

      const errorMessage = err?.message || err?.detail || "";

      // Handle specific error types based on message content
      if (errorMessage.includes("tối đa") || errorMessage.includes("đầy") || errorMessage.toLowerCase().includes("full")) {
        const msg = t("session", "errorSessionFull");
        setError(msg);
        toast.error(msg);
      } else if (errorMessage.includes("không tìm thấy") || errorMessage.toLowerCase().includes("not found")) {
        const msg = t("session", "errorSessionNotFound");
        setError(msg);
        toast.error(msg);
      } else if (errorMessage.includes("kết thúc") || errorMessage.toLowerCase().includes("ended")) {
        const msg = t("session", "errorSessionEndedJoin");
        setError(msg);
        toast.error(msg);
      } else {
        const msg = errorMessage || t("session", "errorGeneric");
        setError(msg);
        toast.error(msg);
      }
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("pin");
    setError(null);
    setSessionInfo(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            {t("session", "pageTitle")}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-lg">
            {step === "pin"
              ? t("session", "subtitlePin")
              : t("session", "subtitleName")}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-background/80 backdrop-blur rounded-2xl border shadow-2xl p-8">
          {step === "pin" ? (
            /* PIN Entry Step */
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🔢</div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t("session", "pinTitle")}
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {t("session", "pinSubtitle")}
                </p>
              </div>

              <PinInput
                length={6}
                onComplete={handlePinComplete}
                disabled={isLoading}
                error={error}
                autoFocus
                className="py-4"
              />

              {isLoading && (
                <div className="text-center text-zinc-600 dark:text-zinc-400">
                  <div className="animate-spin inline-block w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
                  <div className="mt-2">{t("session", "verifyingCode")}</div>
                </div>
              )}
            </div>
          ) : (
            /* Name Entry Step */
            <form onSubmit={handleJoinSession} className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">👤</div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t("session", "nameTitle")}
                </h2>
                {sessionInfo && (
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {t("session", "joiningLabel")} <span className="font-semibold">{sessionInfo.code}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
                >
                  {t("session", "displayNameLabel")}
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("session", "displayNamePlaceholder")}
                  maxLength={50}
                  disabled={isLoading}
                  className="
                    w-full px-4 py-3
                    border-2 border-border
                    rounded-lg
                    text-lg
                    bg-background
                    text-zinc-900 dark:text-zinc-100
                    focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50
                    disabled:bg-muted
                    transition-colors
                  "
                  autoFocus
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t("session", "displayNameHint")}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="
                    px-6 py-3
                    bg-muted hover:bg-muted/80
                    text-zinc-900 dark:text-zinc-100
                    font-semibold
                    rounded-lg
                    transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {t("session", "btnBack")}
                </button>
                <button
                  type="submit"
                  disabled={!displayName.trim() || isLoading}
                  className="
                    flex-1 px-8 py-3
                    bg-emerald-600 hover:bg-emerald-700
                    disabled:bg-muted
                    text-white font-semibold text-lg
                    rounded-lg
                    transition-colors
                    disabled:cursor-not-allowed
                    flex items-center justify-center gap-2
                  "
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin w-5 h-5 border-3 border-white border-t-transparent rounded-full"></div>
                      <span>{t("session", "btnJoining")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("session", "btnJoin")}</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/")}
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline transition-colors"
          >
            {t("session", "btnBackToHome")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinSessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-emerald-100 via-white to-emerald-50 dark:from-[#0b0f0e] dark:via-emerald-900/10 dark:to-[#0b0f0e] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <JoinSessionContent />
    </Suspense>
  );
}
