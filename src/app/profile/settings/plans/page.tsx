"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getMe, type Me } from "@/lib/api-auth";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import { useSearchParams } from "next/navigation";
import {
    getPlans,
    getMyMembership,
    parsePlanFeatures,
    createOrRenewMembership,
    subscribeToPlan,
    upgradePlan,
    cancelPayment,
    confirmPayment,
    retryPayment,
    type Plan,
    type CurrentMembershipDto,
    type PaymentConfirmationRequest,
    type CancelPaymentRequest,
} from "@/lib/api-membership";
import { UpgradeConfirmationModal } from "@/components/membership/UpgradeConfirmationModal";
import {
    getMyOrganizations,
    type MyOrganizationDto,
} from "@/lib/api-organizations";
import { useI18n } from "@/i18n/I18nProvider";

type Banner = { type: "info" | "success" | "error"; text: string } | null;
type PaymentMethod = "payOS";

function thongBaoLoi(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string") return m;
    }
    if (typeof err === "string") {
        try {
            const j = JSON.parse(err) as { detail?: string; title?: string };
            if (typeof j.detail === "string" && j.detail.length) return j.detail;
            if (typeof j.title === "string" && j.title.length) return j.title;
        } catch { }
    }
    return fallback;
}
function la404(err: unknown): boolean {
    if (typeof err === "object" && err && "status" in err) {
        const s = (err as { status?: unknown }).status;
        return s === 404 || s === "404";
    }
    if (typeof err === "string") {
        return err.includes('"status":404') || err.includes('"status": 404');
    }
    return false;
}
function dinhDangTien(n?: number | null) {
    if (n == null) return "—";
    try {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `${n}$`;
    }
}

function formatDateVN(dateString?: string | null): string {
    if (!dateString) return "—";
    try {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh",
        }).format(date);
    } catch {
        return dateString;
    }
}
function veMang(x: unknown): MyOrganizationDto[] {
    if (!x) return [];
    if (Array.isArray(x)) return x as MyOrganizationDto[];
    if (typeof x === "object" && x) {
        const o = x as Record<string, unknown>;
        if (Array.isArray(o.organizations))
            return o.organizations as MyOrganizationDto[];
        if (Array.isArray(o.items)) return o.items as MyOrganizationDto[];
        if ("orgId" in o && "orgName" in o)
            return [o as unknown as MyOrganizationDto];
    }
    return [];
}

function HinhTronChuCai({ ten }: { ten?: string }) {
    const ini =
        (ten ?? "?")
            .split(/\s+/)
            .filter(Boolean)
            .map((s) => s[0]?.toUpperCase())
            .slice(0, 2)
            .join("") || "?";
    return (
        <span className="inline-grid h-6 w-6 place-items-center rounded bg-emerald-600/15 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-500/20 dark:text-emerald-300">
            {ini}
        </span>
    );
}
type ToChuc = { orgId: string; orgName: string };
function ChonToChuc({
    orgs,
    value,
    onChange,
    className = "",
    themeClasses,
    isDark,
}: {
    orgs: ToChuc[];
    value?: string;
    onChange: (id: string) => void;
    className?: string;
    themeClasses: ReturnType<typeof getThemeClasses>;
    isDark: boolean;
}) {
    const { t } = useI18n();
    const current = orgs.find((o) => o.orgId === value);
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <span className={`text-xs font-medium ${themeClasses.textMuted}`}>
                {t("plans.org_label")}
            </span>
            <div className="relative">
                <div
                    className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${themeClasses.textMuted}`}
                >
                    ▾
                </div>
                <select
                    className={`min-w-64 appearance-none rounded-md border px-3 py-2 pr-7 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 ${themeClasses.select}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {orgs.length === 0 ? (
                        <option value="" disabled>
                            {t("plans.org_none")}
                        </option>
                    ) : null}
                    {orgs.map((o) => (
                        <option key={o.orgId} value={o.orgId}>
                            {o.orgName}
                        </option>
                    ))}
                </select>
            </div>
            {current && (
                <div
                    className={`hidden md:flex items-center gap-2 text-sm ${
                        isDark ? "text-zinc-200" : "text-gray-700"
                    }`}
                >
                    <HinhTronChuCai ten={current.orgName} />
                    <span className="font-medium">{current.orgName}</span>
                </div>
            )}
        </div>
    );
}

function layVaiTro(orgs: MyOrganizationDto[], orgId: string): string {
    const o = orgs.find((x) => (x as { orgId?: string }).orgId === orgId);
    if (!o) return "";
    const r = o as unknown as Record<string, unknown>;
    if (typeof r.myRole === "string") return r.myRole;
    if (typeof r.role === "string") return r.role;
    if (typeof r.yourRole === "string") return r.yourRole;
    if (typeof r.license === "string") return r.license;
    if (r.isOwner === true) return "Owner";
    return "";
}

// Helper function to get plan tier
function getPlanTier(planName?: string): number {
    if (!planName) return 0;
    const name = planName.toLowerCase();
    if (name.includes("enterprise")) return 4;
    if (name.includes("pro")) return 3;
    if (name.includes("basic")) return 2;
    if (name.includes("free")) return 1;
    return 0;
}

// PaymentMethodPopup component
interface PaymentMethodPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectMethod: (method: PaymentMethod) => void;
    planName?: string;
    planPrice?: number;
    isDark: boolean;
}

const PaymentMethodPopup: React.FC<PaymentMethodPopupProps> = ({
    isOpen,
    onClose,
    onSelectMethod,
    planName = "Premium Plan",
    planPrice = 0.1,
    isDark,
}) => {
    const { t } = useI18n();
    const [selectedMethod, setSelectedMethod] =
        React.useState<PaymentMethod | null>(null);

    if (!isOpen) return null;

    const handleMethodSelect = (method: PaymentMethod) => {
        console.log("PaymentMethodPopup: Method selected:", method);
        setSelectedMethod(method);
    };

    const handleConfirm = () => {
        console.log("PaymentMethodPopup: Continue clicked, selectedMethod:", selectedMethod);
        if (selectedMethod) {
            console.log("PaymentMethodPopup: Calling onSelectMethod with:", selectedMethod);
            onSelectMethod(selectedMethod);
            onClose();
        } else {
            console.warn("PaymentMethodPopup: No method selected!");
        }
    };

    const formatUSD = (price: number) => `$${price.toFixed(2)}`;

    const paymentMethods = [
        {
            id: "payOS" as PaymentMethod,
            name: "PayOS",
            description: t("plans.payos_description"),
            icon: (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 48 48"
                >
                    <path
                        fill="currentColor"
                        d="M16.25 4A4.25 4.25 0 0 0 12 8.25v31.5A4.25 4.25 0 0 0 16.25 44h15.5A4.25 4.25 0 0 0 36 39.75V8.25A4.25 4.25 0 0 0 31.75 4zM14.5 8.25c0-.966.784-1.75 1.75-1.75h15.5c.967 0 1.75.784 1.75 1.75v31.5a1.75 1.75 0 0 1-1.75 1.75h-15.5a1.75 1.75 0 0 1-1.75-1.75zm6.75 27.25a1.25 1.25 0 1 0 0 2.5h5.5a1.25 1.25 0 1 0 0-2.5z"
                    />
                </svg>
            ),
            available: true,
            popular: true,
        },
    ];

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
            <div
                className={`${
                    isDark
                        ? "bg-zinc-900 border-zinc-700"
                        : "bg-white border-gray-200"
                } border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`}
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2
                            className={`text-xl font-semibold ${
                                isDark ? "text-zinc-100" : "text-gray-900"
                            }`}
                        >
                            {t("plans.select_payment_method")}
                        </h2>
                        <p
                            className={`text-sm mt-1 ${
                                isDark ? "text-zinc-400" : "text-gray-600"
                            }`}
                        >
                            {planName} -{" "}
                            {t("plans.price_per_month", {
                                price: formatUSD(planPrice),
                            })}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${
                            isDark ? "hover:bg-zinc-800" : "hover:bg-gray-100"
                        }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3 mb-6">
                    {paymentMethods.map((method) => (
                        <div
                            key={method.id}
                            className={`
                                relative rounded-xl border p-4 cursor-pointer transition-all
                                ${
                                    !method.available
                                        ? `${
                                              isDark
                                                  ? "border-zinc-700 bg-zinc-800/30"
                                                  : "border-gray-300 bg-gray-100"
                                          } opacity-60 cursor-not-allowed`
                                        : selectedMethod === method.id
                                        ? "border-emerald-400/60 bg-emerald-500/10 ring-1 ring-emerald-400/40"
                                        : isDark
                                        ? "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800/70"
                                        : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                                }
                            `}
                            onClick={() =>
                                method.available && handleMethodSelect(method.id)
                            }
                        >
                            {method.popular && method.available && (
                                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                                    {t("plans.popular_badge")}
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <div
                                    className={`
                                    p-2 rounded-lg
                                    ${
                                        !method.available
                                            ? isDark
                                                ? "bg-zinc-700 text-zinc-500"
                                                : "bg-gray-200 text-gray-400"
                                            : selectedMethod === method.id
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : isDark
                                            ? "bg-zinc-700 text-zinc-300"
                                            : "bg-gray-200 text-gray-700"
                                    }
                                `}
                                >
                                    {method.icon}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3
                                            className={`font-medium ${
                                                !method.available
                                                    ? isDark
                                                        ? "text-zinc-500"
                                                        : "text-gray-400"
                                                    : isDark
                                                    ? "text-zinc-100"
                                                    : "text-gray-900"
                                            }`}
                                        >
                                            {method.name}
                                        </h3>
                                        {!method.available && (
                                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                                {t(
                                                    "plans.under_maintenance_badge"
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <p
                                        className={`text-sm ${
                                            !method.available
                                                ? isDark
                                                    ? "text-zinc-600"
                                                    : "text-gray-400"
                                                : isDark
                                                ? "text-zinc-400"
                                                : "text-gray-600"
                                        }`}
                                    >
                                        {method.description}
                                    </p>
                                </div>

                                {method.available && (
                                    <div
                                        className={`
                                        w-4 h-4 rounded-full border-2 transition-colors
                                        ${
                                            selectedMethod === method.id
                                                ? "border-emerald-400 bg-emerald-400"
                                                : isDark
                                                ? "border-zinc-600"
                                                : "border-gray-300"
                                        }
                                    `}
                                    >
                                        {selectedMethod === method.id && (
                                            <div className="w-full h-full rounded-full bg-emerald-400 scale-50" />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className={`flex-1 px-4 py-2 border rounded-xl transition-colors ${
                            isDark
                                ? "border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                        {t("plans.cancel")}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedMethod}
                        className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                    >
                        {t("plans.continue")}
                    </button>
                </div>

                <p
                    className={`text-xs text-center mt-4 ${
                        isDark ? "text-zinc-500" : "text-gray-500"
                    }`}
                >
                    {t("plans.security_note")}
                </p>
            </div>
        </div>
    );
};

export default function TrangGoiThanhVien() {
    const { resolvedTheme, theme } = useTheme();
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const preselectedOrgId = searchParams?.get('orgId');
    const currentTheme = (resolvedTheme ?? theme ?? "light") as
        | "light"
        | "dark";
    const isDark = currentTheme === "dark";
    const themeClasses = getThemeClasses(isDark);
    const [me, setMe] = useState<Me | null>(null);
    const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
    const [orgId, setOrgId] = useState<string>("");
    const [plans, setPlans] = useState<Plan[]>([]);
    const [membership, setMembership] =
        useState<CurrentMembershipDto | null>(null);
    const [dangLoadTrang, setDangLoadTrang] = useState(true);
    const [dangLoadMem, setDangLoadMem] = useState(false);
    const [dangXuLy, setDangXuLy] = useState(false);
    const [banner, setBanner] = useState<Banner>(null);
    const [showPaymentPopup, setShowPaymentPopup] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<{
        planId: number;
        planName: string;
        price: number;
        isUpgrade: boolean;
    } | null>(null);
    const [paymentResultPopup, setPaymentResultPopup] = useState<{ type: "success" | "cancel"; msg: string } | null>(null);
    const [pendingRetryTransactionId, setPendingRetryTransactionId] = useState<string | null>(null);
    const paymentRedirectHandledRef = React.useRef(false);

    useEffect(() => {
        Promise.all([getMe(), getMyOrganizations(), getPlans()])
            .then(([meRes, orgResRaw, planRes]) => {
                setMe(meRes);
                const orgList = veMang(orgResRaw);
                setOrgs(orgList);
                setPlans(Array.isArray(planRes) ? planRes : []);
                // Auto-select organization from URL or use first org
                if (preselectedOrgId && orgList.some(o => o.orgId === preselectedOrgId)) {
                    setOrgId(preselectedOrgId);
                } else if (orgList.length > 0) {
                    setOrgId((orgList[0].orgId ?? "").toString());
                }
            })
            .catch((e) =>
                setBanner({
                    type: "error",
                    text: thongBaoLoi(e, t("plans.error_generic")),
                })
            )
            .finally(() => setDangLoadTrang(false));
    }, [t, preselectedOrgId]);

    const vaiTro = useMemo(() => layVaiTro(orgs, orgId), [orgs, orgId]);
    const laOwner = vaiTro.toLowerCase() === "owner";

    useEffect(() => {
        if (!orgId) {
            setMembership(null);
            return;
        }
        setDangLoadMem(true);
        setBanner(null);
        getMyMembership(orgId)
            .then((m) => {
                setMembership(m);
                if (!laOwner) {
                    setBanner({
                        type: "info",
                        text: t("plans.banner_not_owner_view_only"),
                    });
                }
            })
            .catch((e) => {
                if (la404(e)) {
                    setMembership(null);
                    if (!laOwner) {
                        setBanner({
                            type: "info",
                            text: t("plans.banner_not_owner_no_membership"),
                        });
                    } else {
                        setBanner({
                            type: "info",
                            text: t("plans.banner_owner_no_membership"),
                        });
                    }
                } else {
                    setBanner({
                        type: "error",
                        text: thongBaoLoi(e, t("plans.error_generic")),
                    });
                }
            })
            .finally(() => setDangLoadMem(false));
    }, [orgId, laOwner, t]);

    // Handle payment redirect from PayOS
    useEffect(() => {
        if (typeof window === "undefined") return;

        const params = new URLSearchParams(window.location.search);
        const transactionId = params.get("transactionId");
        const code = params.get("code");
        const cancel = params.get("cancel");
        const status = params.get("status");
        const orderCode = params.get("orderCode");
        const paymentId = params.get("id");

        // Handle retry scenario - transactionId present but no payment result params
        if (transactionId && !code && !status && !cancel) {
            setPendingRetryTransactionId(transactionId);
            setBanner({
                type: "info",
                text: "Bạn có thanh toán đang chờ. Nhấn nút bên dưới để tiếp tục thanh toán.",
            });
            return;
        }

        if (!transactionId) return;

        // Check if already handled using localStorage to persist across re-renders
        const handledKey = `payment_handled_${transactionId}`;
        const popupDataKey = `payment_popup_${transactionId}`;

        if (localStorage.getItem(handledKey)) {
            console.log(`Payment ${transactionId} already handled, checking for popup data...`);

            // Restore popup from localStorage if exists
            const savedPopupData = localStorage.getItem(popupDataKey);
            if (savedPopupData && !paymentResultPopup) {
                try {
                    const popupData = JSON.parse(savedPopupData);
                    setPaymentResultPopup(popupData);
                    console.log(`Restored popup from localStorage:`, popupData);
                } catch (e) {
                    console.error("Failed to parse popup data:", e);
                }
            }
            return;
        }

        // Mark as handled immediately before API call
        localStorage.setItem(handledKey, "true");
        paymentRedirectHandledRef.current = true;

        // Restore orgId from localStorage
        const savedOrgId = localStorage.getItem("pendingPaymentOrgId");
        if (savedOrgId && savedOrgId !== orgId) {
            setOrgId(savedOrgId);
        }

        let finalStatus: "success" | "cancel" | null = null;

        console.log({ transactionId, code, cancel, status, orderCode, paymentId });

        if (code === "00" && cancel === "false" && status?.toUpperCase() === "PAID") {
            finalStatus = "success";
        } else if (cancel === "true" || status?.toUpperCase() === "CANCELLED") {
            finalStatus = "cancel";
        }

        console.log({ finalStatus });

        if (finalStatus === "success") {
            // Get the purpose from localStorage (saved when payment was initiated)
            // Default to "membership" for backward compatibility
            const savedPurpose = localStorage.getItem("pendingPaymentPurpose") || "membership";
            console.log("Payment purpose from localStorage:", savedPurpose);
            
            const req: PaymentConfirmationRequest = {
                paymentGateway: "payOS",
                paymentId: paymentId ?? "",
                orderCode: orderCode ?? "",
                purpose: savedPurpose as "membership" | "upgrade",
                transactionId,
                status: "success",
            };
            
            console.log("Confirming payment with request:", req);

            confirmPayment(req)
                .then(() => {
                    const popupData = { type: "success" as const, msg: t("plans.payment_success") };
                    setPaymentResultPopup(popupData);
                    // Save popup data to localStorage for re-renders
                    localStorage.setItem(popupDataKey, JSON.stringify(popupData));

                    // Cleanup payment-related localStorage items
                    localStorage.removeItem("pendingPaymentOrgId");
                    localStorage.removeItem("pendingPaymentPlanId");
                    localStorage.removeItem("pendingPaymentPurpose");

                    if (orgId) {
                        getMyMembership(orgId)
                            .then(setMembership)
                            .catch(() => {});
                    }
                })
                .catch((res) => {
                    const popupData = { type: "cancel" as const, msg: t("plans.payment_failed") };
                    setPaymentResultPopup(popupData);
                    // Save popup data to localStorage for re-renders
                    localStorage.setItem(popupDataKey, JSON.stringify(popupData));
                    console.log(res);
                })
                .finally(() => {
                    // Cleanup: Remove handled flag after processing (keep popup data)
                    setTimeout(() => {
                        localStorage.removeItem(handledKey);
                    }, 60000); // Keep for 1 minute to prevent accidental re-processing
                });
        }

        if (finalStatus === "cancel") {
            // Show cancelled message immediately to user
            const popupData = { type: "cancel" as const, msg: t("plans.payment_cancelled") };
            setPaymentResultPopup(popupData);
            // Save popup data to localStorage for re-renders
            localStorage.setItem(popupDataKey, JSON.stringify(popupData));

            // Try to notify backend, but don't show error to user if it fails
            // (payment is already cancelled on PayOS side)
            const req: CancelPaymentRequest = {
                paymentGateway: "payOS",
                transactionId,
                paymentId: paymentId ?? "",
                orderCode: orderCode ?? "",
            };

            cancelPayment(req)
                .then(() => {
                    console.log("Backend notified of payment cancellation");
                })
                .catch((error) => {
                    // Log error but don't show to user (payment is already cancelled)
                    console.warn("Failed to notify backend of payment cancellation:", error);
                })
                .finally(() => {
                    // Cleanup: Remove handled flag after processing (keep popup data)
                    setTimeout(() => {
                        localStorage.removeItem(handledKey);
                    }, 60000); // Keep for 1 minute
                });
        }
    }, [orgId, t]);

    const planHienTaiId = membership?.planId;
    const planHienTaiTen = membership?.planName ?? "—";
    const currentPlanTier = getPlanTier(membership?.planName);
    const danhSachPlan = useMemo(
        () =>
            [...(Array.isArray(plans) ? plans : [])].sort(
                (a, b) => (a.priceMonthly ?? 0) - (b.priceMonthly ?? 0)
            ),
        [plans]
    );

    async function handleRenew() {
        if (!membership || !planHienTaiId || !orgId) return;
        setDangXuLy(true);
        setBanner(null);
        try {
            await createOrRenewMembership({
                membershipId: membership.membershipId,
                orgId,
                planId: membership.planId,
                autoRenew: membership.autoRenew ?? false,
            });

            setBanner({
                type: "success",
                text: t("plans.renew_success"),
            });
            const m = await getMyMembership(orgId);
            setMembership(m);
        } catch (e) {
            if (la404(e)) {
                setBanner({
                    type: "info",
                    text: t("plans.renew_not_found"),
                });
            } else {
                setBanner({
                    type: "error",
                    text: thongBaoLoi(e, t("plans.error_generic")),
                });
            }
        } finally {
            setDangXuLy(false);
        }
    }
    function openPaymentPopup(
        planId: number,
        planName: string,
        price: number,
        isUpgrade: boolean
    ) {
        setSelectedPlanForPayment({ planId, planName, price, isUpgrade });
        // For upgrades, show confirmation modal first; for new subscriptions, show payment method popup directly
        if (isUpgrade && membership) {
            setShowUpgradeModal(true);
        } else {
            setShowPaymentPopup(true);
        }
    }

    async function handleConfirmUpgrade() {
        console.log("=== handleConfirmUpgrade START ===");
        console.log("me:", me);
        console.log("orgId:", orgId);
        console.log("selectedPlanForPayment:", selectedPlanForPayment);
        console.log("membership:", membership);
        
        if (!me || !orgId || !selectedPlanForPayment || !membership) {
            console.error("Missing required data in handleConfirmUpgrade");
            return;
        }
        
        // Close upgrade modal and show payment method popup
        // IMPORTANT: Don't clear selectedPlanForPayment here - we need it for the payment popup
        console.log("Closing upgrade modal and opening payment popup");
        setShowUpgradeModal(false);
        // Use setTimeout to ensure modal closes before opening payment popup
        setTimeout(() => {
            setShowPaymentPopup(true);
        }, 100);
        console.log("=== handleConfirmUpgrade END ===");
    }

    async function handlePaymentMethodSelected(method: PaymentMethod) {
        console.log("=== handlePaymentMethodSelected START ===");
        console.log("Method:", method);
        console.log("Selected plan:", selectedPlanForPayment);
        console.log("Membership:", membership);
        console.log("User:", me);
        console.log("OrgId:", orgId);

        if (!me || !orgId || !selectedPlanForPayment) {
            console.error("Missing required data:", { me: !!me, orgId: !!orgId, selectedPlanForPayment: !!selectedPlanForPayment });
            return;
        }

        setDangXuLy(true);
        setBanner(null);
        setShowPaymentPopup(false);

        try {
            console.log("Making API call...");
            let res;
            if (selectedPlanForPayment.isUpgrade && membership) {
                const upgradeRequest = {
                    userId: me.userId,
                    orgId,
                    newPlanId: selectedPlanForPayment.planId,
                    paymentMethod: method,
                    autoRenew: true,
                };
                console.log("Upgrade request:", upgradeRequest);
                res = await upgradePlan(upgradeRequest);
            } else {
                const subscribeRequest = {
                    userId: me.userId,
                    orgId,
                    planId: selectedPlanForPayment.planId,
                    paymentMethod: method,
                    autoRenew: true,
                };
                console.log("Subscribe request:", subscribeRequest);
                res = await subscribeToPlan(subscribeRequest);
            }

            // Debug logging
            console.log("=== API RESPONSE ===");
            console.log("Full response:", JSON.stringify(res, null, 2));
            console.log("Payment URL:", res.paymentUrl);
            console.log("Status:", res.status);
            console.log("Message:", res.message);

            // Check if we have a valid payment URL
            if (res.paymentUrl && res.paymentUrl.trim() !== "") {
                console.log("Redirecting to payment URL:", res.paymentUrl);
                // Save orgId and purpose to localStorage to restore after payment redirect
                localStorage.setItem("pendingPaymentOrgId", orgId);
                localStorage.setItem("pendingPaymentPlanId", String(selectedPlanForPayment.planId));
                // Store the purpose (membership or upgrade) so we can use it when confirming payment
                const purpose = selectedPlanForPayment.isUpgrade ? "upgrade" : "membership";
                localStorage.setItem("pendingPaymentPurpose", purpose);
                console.log("Saved payment purpose:", purpose);
                window.location.href = res.paymentUrl;
                return;
            }

            // If no payment URL but status is pending, there's an issue
            if (res.status === "pending" && !res.paymentUrl) {
                console.error("Payment gateway did not return a payment URL");
                setBanner({
                    type: "error",
                    text: res.message || "Payment gateway did not return a payment URL. Please try again or contact support.",
                });
                return;
            }

            // Success case (shouldn't happen for upgrades, but handle it)
            console.log("No payment URL, showing success message");
            setBanner({
                type: "success",
                text: res.message || (selectedPlanForPayment.isUpgrade
                    ? t("plans.upgrade_success")
                    : t("plans.subscribe_success")),
            });
            const m = await getMyMembership(orgId);
            setMembership(m);
        } catch (e) {
            console.error("=== PAYMENT ERROR ===");
            console.error("Error object:", e);
            console.error("Error message:", e instanceof Error ? e.message : String(e));
            console.error("Error stack:", e instanceof Error ? e.stack : "No stack trace");
            setBanner({
                type: "error",
                text: thongBaoLoi(e, t("plans.error_generic")),
            });
        } finally {
            console.log("=== handlePaymentMethodSelected END ===");
            setDangXuLy(false);
            setSelectedPlanForPayment(null);
        }
    }

    async function handleRetryPayment(transactionId: string) {
        try {
            setBanner({ type: "info", text: "Đang tạo lại liên kết thanh toán..." });
            
            const res = await retryPayment({ transactionId });
            
            if (res.paymentUrl && res.paymentUrl.trim() !== "") {
                // Redirect to payment URL
                window.location.href = res.paymentUrl;
                return;
            }
            
            setBanner({
                type: "error",
                text: "Không thể tạo lại liên kết thanh toán. Vui lòng thử lại.",
            });
        } catch (e: any) {
            console.error("Retry payment error:", e);
            setBanner({
                type: "error",
                text: e?.message || "Đã xảy ra lỗi khi thử lại thanh toán.",
            });
        }
    }

    if (dangLoadTrang) {
        return (
            <div className="w-full">
                <div className="h-8 w-56 rounded bg-white/40 dark:bg-white/10 animate-pulse mb-3" />
                <div className="h-9 w-72 rounded bg-white/40 dark:bg-white/10 animate-pulse mb-6" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-56 rounded bg-white/40 dark:bg-white/10 animate-pulse" />
                    <div className="h-56 rounded bg-white/40 dark:bg-white/10 animate-pulse" />
                    <div className="h-56 rounded bg-white/40 dark:bg-white/10 animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h1 className="text-2xl font-semibold">
                {t("plans.page_title")}
            </h1>
            <p className={`mt-1 text-sm ${themeClasses.textMuted}`}>
                {t("plans.page_subtitle")}
            </p>

            <div className="mt-3">
                <ChonToChuc
                    orgs={orgs}
                    value={orgId}
                    onChange={setOrgId}
                    themeClasses={themeClasses}
                    isDark={isDark}
                />
            </div>

            {banner && (
                <div
                    className={
                        banner.type === "error"
                            ? "mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                            : banner.type === "success"
                            ? "mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
                    }
                >
                    {banner.text}
                </div>
            )}

            {pendingRetryTransactionId && (
                <div className="mt-4 mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Bạn có thanh toán đang chờ xử lý
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                                Nhấn nút bên dưới để tiếp tục thanh toán
                            </p>
                        </div>
                        <button
                            onClick={() => handleRetryPayment(pendingRetryTransactionId)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-md text-sm font-medium transition-colors"
                        >
                            {t("plans.continue_payment")}
                        </button>
                    </div>
                </div>
            )}

            {orgs.length === 0 ? (
                <div
                    className={`mt-4 rounded-xl border p-6 text-sm ${themeClasses.panel} ${themeClasses.textMuted}`}
                >
                    {t("plans.no_orgs")}
                </div>
            ) : (
                <div
                    className={`mt-4 rounded-xl border shadow-sm backdrop-blur ${themeClasses.panel}`}
                >
                    <div
                        className={`px-6 py-5 rounded-t-xl bg-gradient-to-r ${
                            isDark
                                ? "from-emerald-500/10"
                                : "from-emerald-50"
                        } to-transparent`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <div
                                    className={`text-xs ${themeClasses.textMuted}`}
                                >
                                    {t("plans.current_plan_label")}
                                </div>
                                <div
                                    className={`text-lg font-semibold ${
                                        isDark
                                            ? "text-zinc-100"
                                            : "text-gray-900"
                                    }`}
                                >
                                    {planHienTaiTen}
                                </div>
                                {dangLoadMem ? (
                                    <div
                                        className={`text-sm ${themeClasses.textMuted}`}
                                    >
                                        {t("plans.loading_membership")}
                                    </div>
                                ) : !membership ? (
                                    <div
                                        className={`text-sm ${themeClasses.textMuted}`}
                                    >
                                        {laOwner
                                            ? t(
                                                  "plans.no_membership_owner"
                                              )
                                            : t(
                                                  "plans.no_membership_not_owner"
                                              )}
                                    </div>
                                ) : (
                                    <div
                                        className={`mt-1 grid grid-cols-1 gap-1 text-sm ${
                                            isDark
                                                ? "text-zinc-300"
                                                : "text-gray-700"
                                        }`}
                                    >
                                        <div>
                                            {t("plans.status_label")}{" "}
                                            <span className="font-medium">
                                                {membership.status}
                                            </span>
                                        </div>
                                        <div>
                                            {t(
                                                "plans.billing_cycle_end_label"
                                            )}{" "}
                                            <span className="font-medium">
                                                {formatDateVN(
                                                    membership.billingCycleEndDate
                                                )}
                                            </span>
                                        </div>
                                        {/* <div>
                                            {t(
                                                "plans.auto_renew_label"
                                            )}{" "}
                                            <span className="font-medium">
                                                {membership.autoRenew
                                                    ? t("plans.toggle_on")
                                                    : t("plans.toggle_off")}
                                            </span>
                                        </div> */}
                                    </div>
                                )}
                            </div>
                            {/* {currentPlanTier !== 1 && laOwner && (
                                <div className="flex gap-2">
                                    <button
                                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                                        onClick={handleRenew}
                                        disabled={
                                            !membership ||
                                            !planHienTaiId ||
                                            dangXuLy
                                        }
                                    >
                                        {dangXuLy
                                            ? t("plans.processing")
                                            : t("plans.renew_button")}
                                    </button>
                                </div>
                            )} */}
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {danhSachPlan.map((p) => {
                                const laHienTai =
                                    p.planId === planHienTaiId;
                                const currentPlanTier =
                                    getPlanTier(membership?.planName);
                                const thisPlanTier = getPlanTier(p.planName);
                                const isLowerTier =
                                    thisPlanTier < currentPlanTier;
                                const isHigherTier =
                                    thisPlanTier > currentPlanTier;
                                const isCurrentFree =
                                    currentPlanTier === 1;

                                const feats = parsePlanFeatures(p);
                                const features = feats.length
                                    ? feats
                                    : [
                                          t("plans.feature_max_maps", {
                                              value:
                                                  (p.maxMapsPerMonth ?? 0) < 0
                                                      ? t("plans.unlimited")
                                                      : p.maxMapsPerMonth,
                                          }),
                                          t(
                                              "plans.feature_max_users_per_org",
                                              {
                                                  value:
                                                      (p.maxUsersPerOrg ??
                                                          0) < 0
                                                          ? t(
                                                                "plans.unlimited"
                                                            )
                                                          : p.maxUsersPerOrg,
                                              }
                                          ),
                                          t("plans.feature_max_exports", {
                                              value:
                                                  (p.exportQuota ?? 0) < 0
                                                      ? t("plans.unlimited")
                                                      : p.exportQuota,
                                          }),
                                      ];

                                return (
                                    <div
                                        key={p.planId}
                                        className={`rounded-lg border p-4 ${
                                            laHienTai
                                                ? isDark
                                                    ? "border-emerald-500/30 bg-emerald-500/10"
                                                    : "border-emerald-300 bg-emerald-50/60"
                                                : themeClasses.tableBorder
                                        } ${
                                            isDark
                                                ? "bg-zinc-900/50"
                                                : "bg-white"
                                        }`}
                                    >
                                        <div className="flex items-baseline justify-between">
                                            <div
                                                className={`text-base font-semibold ${
                                                    isDark
                                                        ? "text-zinc-100"
                                                        : "text-gray-900"
                                                }`}
                                            >
                                                {p.planName}
                                            </div>
                                            <div
                                                className={`text-sm font-semibold ${
                                                    isDark
                                                        ? "text-zinc-100"
                                                        : "text-gray-800"
                                                }`}
                                            >
                                                {t("plans.price_per_month", {
                                                    price: dinhDangTien(
                                                        p.priceMonthly
                                                    ),
                                                })}
                                            </div>
                                        </div>
                                        <ul
                                            className={`mt-3 space-y-1 text-sm ${themeClasses.textMuted}`}
                                        >
                                            {features
                                                .slice(0, 6)
                                                .map((f, i) => (
                                                    <li key={i}>• {f}</li>
                                                ))}
                                        </ul>
                                        {laOwner && (
                                            <>
                                                {laHienTai ? (
                                                    <button
                                                        className="mt-4 w-full rounded-md border border-emerald-300 bg-transparent px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                                                        disabled
                                                    >
                                                        {t(
                                                            "plans.current_plan"
                                                        )}
                                                    </button>
                                                ) : isLowerTier ? (
                                                    <button
                                                        className={`mt-4 w-full rounded-md border px-3 py-2 text-xs font-medium ${
                                                            isDark
                                                                ? "border-zinc-700 bg-zinc-800 text-zinc-500"
                                                                : "border-gray-300 bg-gray-100 text-gray-400"
                                                        }`}
                                                        disabled
                                                    >
                                                        {t(
                                                            "plans.downgrade_disabled"
                                                        )}
                                                    </button>
                                                ) : isCurrentFree &&
                                                  isHigherTier ? (
                                                    <button
                                                        className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() =>
                                                            openPaymentPopup(
                                                                p.planId,
                                                                p.planName,
                                                                p.priceMonthly ??
                                                                    0,
                                                                false
                                                            )
                                                        }
                                                        disabled={
                                                            !orgId || dangXuLy
                                                        }
                                                    >
                                                        {dangXuLy
                                                            ? t(
                                                                  "plans.processing"
                                                              )
                                                            : t(
                                                                  "plans.choose_plan"
                                                              )}
                                                    </button>
                                                ) : isHigherTier ? (
                                                    <button
                                                        className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() =>
                                                            openPaymentPopup(
                                                                p.planId,
                                                                p.planName,
                                                                p.priceMonthly ??
                                                                    0,
                                                                true
                                                            )
                                                        }
                                                        disabled={
                                                            !orgId || dangXuLy
                                                        }
                                                    >
                                                        {dangXuLy
                                                            ? t(
                                                                  "plans.processing"
                                                              )
                                                            : t(
                                                                  "plans.upgrade_plan"
                                                              )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() =>
                                                            openPaymentPopup(
                                                                p.planId,
                                                                p.planName,
                                                                p.priceMonthly ??
                                                                    0,
                                                                false
                                                            )
                                                        }
                                                        disabled={
                                                            !orgId || dangXuLy
                                                        }
                                                    >
                                                        {dangXuLy
                                                            ? t(
                                                                  "plans.processing"
                                                              )
                                                            : t(
                                                                  "plans.choose_plan"
                                                              )}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className={`mt-8 rounded-lg border p-4 text-xs ${themeClasses.tableBorder} ${
                                isDark ? "bg-white/5" : "bg-gray-50"
                            } ${themeClasses.textMuted}`}
                        >
                            {t("plans.payos_note")}
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Confirmation Modal */}
            {selectedPlanForPayment?.isUpgrade && membership && membership.billingCycleStartDate && membership.billingCycleEndDate && (
                <UpgradeConfirmationModal
                    open={showUpgradeModal}
                    onOpenChange={(open) => {
                        setShowUpgradeModal(open);
                        // Don't clear selectedPlanForPayment here - it will be cleared when payment popup closes
                        // This allows the payment popup to access the selected plan data
                    }}
                    currentPlan={{
                        id: membership.planId,
                        name: membership.planName,
                        price: danhSachPlan.find(p => p.planId === membership.planId)?.priceMonthly ?? 0,
                    }}
                    newPlan={{
                        id: selectedPlanForPayment.planId,
                        name: selectedPlanForPayment.planName,
                        price: selectedPlanForPayment.price,
                    }}
                    billingCycleStartDate={new Date(membership.billingCycleStartDate)}
                    billingCycleEndDate={new Date(membership.billingCycleEndDate)}
                    onConfirmUpgrade={handleConfirmUpgrade}
                />
            )}

            {/* Payment Method Popup */}
            <PaymentMethodPopup
                isOpen={showPaymentPopup}
                onClose={() => {
                    setShowPaymentPopup(false);
                    setSelectedPlanForPayment(null);
                }}
                onSelectMethod={handlePaymentMethodSelected}
                planName={selectedPlanForPayment?.planName}
                planPrice={selectedPlanForPayment?.price}
                isDark={isDark}
            />

            {/* Payment Result Modal - Tailwind UI Style */}
            {paymentResultPopup && (
                <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-black/30 transition-opacity" aria-hidden="true"></div>

                    <div className="fixed inset-0 z-50 w-screen overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                            <div className={`relative transform overflow-hidden rounded-lg ${isDark ? 'bg-zinc-900' : 'bg-white'} px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6`}>
                                <div>
                                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${paymentResultPopup.type === "success" ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                                        {paymentResultPopup.type === "success" ? (
                                            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        ) : (
                                            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="mt-3 text-center sm:mt-5">
                                        <h3 className={`text-base font-semibold leading-6 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`} id="modal-title">
                                            {paymentResultPopup.type === "success"
                                                ? t("plans.payment_success_title")
                                                : t("plans.payment_failed_title")}
                                        </h3>
                                        <div className="mt-2">
                                            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                                {paymentResultPopup.msg}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPaymentResultPopup(null);
                                            // Clean URL and localStorage after closing popup
                                            if (typeof window !== "undefined") {
                                                window.history.replaceState({}, "", window.location.pathname);
                                                localStorage.removeItem("pendingPaymentOrgId");
                                                localStorage.removeItem("pendingPaymentPlanId");

                                                // Remove all payment-related popup data
                                                Object.keys(localStorage).forEach(key => {
                                                    if (key.startsWith("payment_popup_") || key.startsWith("payment_handled_")) {
                                                        localStorage.removeItem(key);
                                                    }
                                                });
                                            }
                                        }}
                                        className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                            paymentResultPopup.type === "success"
                                                ? 'bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600'
                                                : 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600'
                                        }`}
                                    >
                                        {t("plans.close")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
