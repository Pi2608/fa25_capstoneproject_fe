"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getMe, type Me } from "@/lib/api-auth";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import {
    getPlans,
    getMyMembership,
    parsePlanFeatures,
    createOrRenewMembership,
    subscribeToPlan,
    upgradePlan,
    type Plan,
    type CurrentMembershipDto,
} from "@/lib/api-membership";
import {
    getMyOrganizations,
    type MyOrganizationDto,
} from "@/lib/api-organizations";
import { useI18n } from "@/i18n/I18nProvider";

type Banner = { type: "info" | "success" | "error"; text: string } | null;
type PaymentMethod = 'payOS' | 'stripe' | 'vnPay';

function thongBaoLoi(err: unknown): string {
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
    return "Đã xảy ra lỗi. Vui lòng thử lại.";
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
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
    } catch { return `${n}$`; }
}

function formatDateVN(dateString?: string | null): string {
    if (!dateString) return "—";
    try {
        // If the date string doesn't have timezone info, treat it as UTC and convert to local
        const date = new Date(dateString);

        // Format using Vietnamese locale with explicit timezone
        return new Intl.DateTimeFormat("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh"
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
        if (Array.isArray(o.organizations)) return o.organizations as MyOrganizationDto[];
        if (Array.isArray(o.items)) return o.items as MyOrganizationDto[];
        if ("orgId" in o && "orgName" in o) return [o as unknown as MyOrganizationDto];
    }
    return [];
}

function HinhTronChuCai({ ten }: { ten?: string }) {
    const ini = (ten ?? "?").split(/\s+/).filter(Boolean).map(s => s[0]?.toUpperCase()).slice(0, 2).join("") || "?";
    return (
        <span className="inline-grid h-6 w-6 place-items-center rounded bg-emerald-600/15 text-emerald-700 text-[11px] font-semibold ring-1 ring-emerald-500/20 dark:text-emerald-300">
            {ini}
        </span>
    );
}
type ToChuc = { orgId: string; orgName: string };
function ChonToChuc({
    orgs, value, onChange, className = "", themeClasses, isDark
}: { orgs: ToChuc[]; value?: string; onChange: (id: string) => void; className?: string; themeClasses: ReturnType<typeof getThemeClasses>; isDark: boolean }) {
    const current = orgs.find(o => o.orgId === value);
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <span className={`text-xs font-medium ${themeClasses.textMuted}`}>Tổ chức</span>
            <div className="relative">
                <div className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${themeClasses.textMuted}`}>▾</div>
                <select
                    className={`min-w-64 appearance-none rounded-md border px-3 py-2 pr-7 text-sm outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 ${themeClasses.select}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {orgs.length === 0 ? <option value="" disabled>(Chưa có tổ chức)</option> : null}
                    {orgs.map(o => (<option key={o.orgId} value={o.orgId}>{o.orgName}</option>))}
                </select>
            </div>
            {current && (
                <div className={`hidden md:flex items-center gap-2 text-sm ${isDark ? "text-zinc-200" : "text-gray-700"}`}>
                    <HinhTronChuCai ten={current.orgName} />
                    <span className="font-medium">{current.orgName}</span>
                </div>
            )}
        </div>
    );
}

function layVaiTro(orgs: MyOrganizationDto[], orgId: string): string {
    const o = orgs.find(x => (x as { orgId?: string }).orgId === orgId);
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
    if (name.includes('enterprise')) return 4;
    if (name.includes('pro')) return 3;
    if (name.includes('basic')) return 2;
    if (name.includes('free')) return 1;
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
    isDark
}) => {
    const { t } = useI18n();
    const [selectedMethod, setSelectedMethod] = React.useState<PaymentMethod | null>(null);

    if (!isOpen) return null;

    const handleMethodSelect = (method: PaymentMethod) => {
        if (method === 'vnPay') return;
        setSelectedMethod(method);
    };

    const handleConfirm = () => {
        if (selectedMethod && selectedMethod !== 'vnPay') {
            onSelectMethod(selectedMethod);
            onClose();
        }
    };

    const formatUSD = (price: number) => `$${price.toFixed(2)}`;

    const paymentMethods = [
        {
            id: 'payOS' as PaymentMethod,
            name: 'PayOS',
            description: 'PayOS – Fast & Secure',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M16.25 4A4.25 4.25 0 0 0 12 8.25v31.5A4.25 4.25 0 0 0 16.25 44h15.5A4.25 4.25 0 0 0 36 39.75V8.25A4.25 4.25 0 0 0 31.75 4zM14.5 8.25c0-.966.784-1.75 1.75-1.75h15.5c.967 0 1.75.784 1.75 1.75v31.5a1.75 1.75 0 0 1-1.75 1.75h-15.5a1.75 1.75 0 0 1-1.75-1.75zm6.75 27.25a1.25 1.25 0 1 0 0 2.5h5.5a1.25 1.25 0 1 0 0-2.5z"/></svg>,
            available: true,
            popular: true
        },
        {
            id: 'stripe' as PaymentMethod,
            name: 'Stripe',
            description: 'Credit Card (International)',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M21 6.616v10.769q0 .69-.462 1.153T19.385 19H4.615q-.69 0-1.152-.462T3 17.384V6.616q0-.691.463-1.153T4.615 5h14.77q.69 0 1.152.463T21 6.616M4 8.808h16V6.616q0-.231-.192-.424T19.385 6H4.615q-.23 0-.423.192T4 6.616zm0 2.384v6.193q0 .23.192.423t.423.192h14.77q.23 0 .423-.192t.192-.423v-6.193zM4 18V6z"/></svg>,
            available: true,
            popular: false
        },
        {
            id: 'vnPay' as PaymentMethod,
            name: 'VNPay',
            description: 'Under maintenance – Available soon',
            icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="none" stroke="currentColor" strokeLinejoin="round" d="m28.622 37.722l14.445-14.444c.577-.578.577-1.733 0-2.311L34.4 12.3c-.578-.578-1.733-.578-2.311 0l-6.356 6.356L16.49 9.41c-.578-.578-1.734-.578-2.311 0l-9.245 9.245c-.578.577-.578 1.733 0 2.31L21.69 37.723c1.733 1.734 5.2 1.734 6.933 0Z" strokeWidth="1"/><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="m25.733 18.656l-8.089 8.089q-3.466 3.465-6.933 0" strokeWidth="1.5"/><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"><path d="M18.222 30.789q-1.732 1.734-3.467 0m22.534-15.6c-1.262-1.156-2.89-.578-4.045.578L18.222 30.789m0-15.022c-4.622-4.622-10.4 1.155-5.778 5.778l5.2 5.2l-5.2-5.2m10.978-.578l-4.044-4.045"/><path d="m21.689 22.7l-4.622-4.622c-.578-.578-1.445-1.445-2.311-1.156m0 3.467c-.578-.578-1.445-1.444-1.156-2.311m5.778 6.933l-4.622-4.622"/></g></svg>,
            available: false,
            popular: false
        }
    ];

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
            <div className={`${isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-200"} border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl`}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className={`text-xl font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                            {t("plans.select_payment_method")}
                        </h2>
                        <p className={`text-sm mt-1 ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
                            {planName} - {formatUSD(planPrice)}/tháng
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-zinc-800" : "hover:bg-gray-100"}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M6 16h2v2c0 .55.45 1 1 1s1-.45 1-1v-3c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1m2-8H6c-.55 0-1 .45-1 1s.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1s-1 .45-1 1zm7 11c.55 0 1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-3c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1m1-11V6c0-.55-.45-1-1-1s-1 .45-1 1v3c0 .55.45 1 1 1h3c.55 0 1-.45 1-1s-.45-1-1-1z"/>
                        </svg>
                    </button>
                </div>

                <div className="space-y-3 mb-6">
                    {paymentMethods.map((method) => (
                        <div
                            key={method.id}
                            className={`
                                relative rounded-xl border p-4 cursor-pointer transition-all
                                ${!method.available
                                    ? `opacity-60 cursor-not-allowed ${isDark ? "border-zinc-700 bg-zinc-800/30" : "border-gray-300 bg-gray-100"}`
                                    : selectedMethod === method.id
                                        ? "border-emerald-400/60 bg-emerald-500/10 ring-1 ring-emerald-400/40"
                                        : isDark ? "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800/70" : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                                }
                            `}
                            onClick={() => method.available && handleMethodSelect(method.id)}
                        >
                            {method.popular && method.available && (
                                <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                                    Popular
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <div className={`
                                    p-2 rounded-lg
                                    ${!method.available
                                        ? isDark ? "bg-zinc-700 text-zinc-500" : "bg-gray-200 text-gray-400"
                                        : selectedMethod === method.id
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : isDark ? "bg-zinc-700 text-zinc-300" : "bg-gray-200 text-gray-700"
                                    }
                                `}>
                                    {method.icon}
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-medium ${
                                            !method.available ? isDark ? "text-zinc-500" : "text-gray-400" : isDark ? "text-zinc-100" : "text-gray-900"
                                        }`}>
                                            {method.name}
                                        </h3>
                                        {!method.available && (
                                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                                                Under maintenance
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-sm ${
                                        !method.available ? isDark ? "text-zinc-600" : "text-gray-400" : isDark ? "text-zinc-400" : "text-gray-600"
                                    }`}>
                                        {method.description}
                                    </p>
                                </div>

                                {method.available && (
                                    <div className={`
                                        w-4 h-4 rounded-full border-2 transition-colors
                                        ${selectedMethod === method.id
                                            ? "border-emerald-400 bg-emerald-400"
                                            : isDark ? "border-zinc-600" : "border-gray-300"
                                        }
                                    `}>
                                        {selectedMethod === method.id && (
                                            <div className="w-full h-full rounded-full bg-emerald-400 scale-50"></div>
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
                            isDark ? "border-zinc-600 text-zinc-300 hover:bg-zinc-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                        {t("plans.cancel")}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedMethod || selectedMethod === 'vnPay'}
                        className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                    >
                        {t("plans.continue")}
                    </button>
                </div>

                <p className={`text-xs text-center mt-4 ${isDark ? "text-zinc-500" : "text-gray-500"}`}>
                    {t("plans.security_note")}
                </p>
            </div>
        </div>
    );
};

export default function TrangGoiThanhVien() {
    const { resolvedTheme, theme } = useTheme();
    const { t } = useI18n();
    const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
    const isDark = currentTheme === "dark";
    const themeClasses = getThemeClasses(isDark);
    const [me, setMe] = useState<Me | null>(null);
    const [orgs, setOrgs] = useState<MyOrganizationDto[]>([]);
    const [orgId, setOrgId] = useState<string>("");
    const [plans, setPlans] = useState<Plan[]>([]);
    const [membership, setMembership] = useState<CurrentMembershipDto | null>(null);
    const [dangLoadTrang, setDangLoadTrang] = useState(true);
    const [dangLoadMem, setDangLoadMem] = useState(false);
    const [dangXuLy, setDangXuLy] = useState(false);
    const [banner, setBanner] = useState<Banner>(null);
    const [showPaymentPopup, setShowPaymentPopup] = useState(false);
    const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<{ planId: number; planName: string; price: number; isUpgrade: boolean } | null>(null);
    const paymentHandledRef = React.useRef(false);

    useEffect(() => {
        Promise.all([getMe(), getMyOrganizations(), getPlans()])
            .then(([meRes, orgResRaw, planRes]) => {
                setMe(meRes);
                const orgList = veMang(orgResRaw);
                setOrgs(orgList);
                setPlans(Array.isArray(planRes) ? planRes : []);
                if (orgList.length > 0) setOrgId((orgList[0].orgId ?? "").toString());
            })
            .catch((e) => setBanner({ type: "error", text: thongBaoLoi(e) }))
            .finally(() => setDangLoadTrang(false));
    }, []);

    const vaiTro = useMemo(() => layVaiTro(orgs, orgId), [orgs, orgId]);
    const laOwner = vaiTro.toLowerCase() === "owner";

    useEffect(() => {
        if (!orgId) { setMembership(null); return; }
        setDangLoadMem(true);
        setBanner(null);
        getMyMembership(orgId)
            .then((m) => {
                setMembership(m);
                // Show info banner for non-owners
                if (!laOwner) {
                    setBanner({
                        type: "info",
                        text: "Bạn không phải Owner nên không thể thực hiện các thao tác thay đổi gói. Chỉ có thể xem thông tin.",
                    });
                }
            })
            .catch((e) => {
                if (la404(e)) {
                    setMembership(null);
                    if (!laOwner) {
                        setBanner({
                            type: "info",
                            text: "Bạn không phải Owner nên không thể xem hoặc thay đổi gói của tổ chức này.",
                        });
                    } else {
                        setBanner({
                            type: "info",
                            text: "Chưa có gói cho tổ chức này. Hãy chọn một gói bên dưới.",
                        });
                    }
                } else {
                    setBanner({ type: "error", text: thongBaoLoi(e) });
                }
            })
            .finally(() => setDangLoadMem(false));
    }, [orgId, laOwner]);

    // Handle payment redirect
    useEffect(() => {
        if (typeof window === "undefined" || paymentHandledRef.current) return;
        const params = new URLSearchParams(window.location.search);
        const status = params.get("status");

        if (status) {
            paymentHandledRef.current = true;

            if (status === "success") {
                setBanner({ type: "success", text: "Thanh toán thành công! Gói của bạn đã được kích hoạt." });
                // Reload membership
                if (orgId) {
                    getMyMembership(orgId).then(setMembership).catch(() => {});
                }
            } else if (status === "failed") {
                setBanner({ type: "error", text: "Thanh toán thất bại. Vui lòng thử lại." });
            } else if (status === "cancelled") {
                setBanner({ type: "info", text: "Bạn đã hủy thanh toán." });
            }

            // Clean URL after showing message
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, [orgId]);

    const planHienTaiId = membership?.planId;
    const planHienTaiTen = membership?.planName ?? "—";
    const currentPlanTier = getPlanTier(membership?.planName);
    const danhSachPlan = useMemo(
        () => [...(Array.isArray(plans) ? plans : [])].sort((a, b) => (a.priceMonthly ?? 0) - (b.priceMonthly ?? 0)),
        [plans]
    );

    async function handleRenew() {
        if (!membership || !planHienTaiId || !orgId) return;
        setDangXuLy(true); setBanner(null);
        try {
            await createOrRenewMembership({
                membershipId: membership.membershipId,
                orgId,
                planId: membership.planId,
                autoRenew: membership.autoRenew ?? false,
            });

            setBanner({ type: "success", text: "Gia hạn gói thành công." });
            const m = await getMyMembership(orgId);
            setMembership(m);
        } catch (e) {
            if (la404(e)) {
                setBanner({ type: "info", text: "Không tìm thấy gói để gia hạn. Vui lòng chọn gói bên dưới để đăng ký mới." });
            } else {
                setBanner({ type: "error", text: thongBaoLoi(e) });
            }
        } finally { setDangXuLy(false); }
    }
    function openPaymentPopup(planId: number, planName: string, price: number, isUpgrade: boolean) {
        setSelectedPlanForPayment({ planId, planName, price, isUpgrade });
        setShowPaymentPopup(true);
    }

    async function handlePaymentMethodSelected(method: PaymentMethod) {
        if (!me || !orgId || !selectedPlanForPayment) return;
        setDangXuLy(true);
        setBanner(null);
        setShowPaymentPopup(false);

        try {
            let res;
            if (selectedPlanForPayment.isUpgrade && membership) {
                res = await upgradePlan({
                    userId: me.userId,
                    orgId,
                    newPlanId: selectedPlanForPayment.planId,
                    paymentMethod: method,
                    autoRenew: true
                });
            } else {
                res = await subscribeToPlan({
                    userId: me.userId,
                    orgId,
                    planId: selectedPlanForPayment.planId,
                    paymentMethod: method,
                    autoRenew: true
                });
            }

            if (res.paymentUrl) {
                window.location.href = res.paymentUrl;
                return;
            }

            setBanner({
                type: "success",
                text: selectedPlanForPayment.isUpgrade ? "Nâng cấp gói thành công." : "Đăng ký gói thành công."
            });
            const m = await getMyMembership(orgId);
            setMembership(m);
        } catch (e) {
            setBanner({ type: "error", text: thongBaoLoi(e) });
        } finally {
            setDangXuLy(false);
            setSelectedPlanForPayment(null);
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
            <h1 className="text-2xl font-semibold">Gói & Thành viên</h1>
            <p className={`mt-1 text-sm ${themeClasses.textMuted}`}>Quản lý gói thành viên cho tổ chức.</p>

            <div className="mt-3">
                <ChonToChuc orgs={orgs} value={orgId} onChange={setOrgId} themeClasses={themeClasses} isDark={isDark} />
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

            {orgs.length === 0 ? (
                <div className={`mt-4 rounded-xl border p-6 text-sm ${themeClasses.panel} ${themeClasses.textMuted}`}>
                    Bạn chưa có tổ chức nào. Hãy tạo một tổ chức để quản lý gói thành viên.
                </div>
            ) : (
                <div className={`mt-4 rounded-xl border shadow-sm backdrop-blur ${themeClasses.panel}`}>
                    <div className={`px-6 py-5 rounded-t-xl bg-gradient-to-r ${isDark ? "from-emerald-500/10" : "from-emerald-50"} to-transparent`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className={`text-xs ${themeClasses.textMuted}`}>Gói hiện tại</div>
                                <div className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{planHienTaiTen}</div>
                                {dangLoadMem ? (
                                    <div className={`text-sm ${themeClasses.textMuted}`}>Đang tải gói…</div>
                                ) : !membership ? (
                                    <div className={`text-sm ${themeClasses.textMuted}`}>
                                        {laOwner ? "Chưa có gói cho tổ chức này. Hãy chọn một gói bên dưới." : "Tổ chức này chưa có gói. Liên hệ Owner để chọn gói."}
                                    </div>
                                ) : (
                                    <div className={`mt-1 grid grid-cols-1 gap-1 text-sm ${isDark ? "text-zinc-300" : "text-gray-700"}`}>
                                        <div>
                                            Trạng thái: <span className="font-medium">{membership.status}</span>
                                        </div>
                                        {membership.endDate && (
                                            <div>
                                                Hết hạn:{" "}
                                                <span className="font-medium">
                                                    {formatDateVN(membership.endDate)}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            Tự gia hạn:{" "}
                                            <span className="font-medium">{membership.autoRenew ? "Bật" : "Tắt"}</span>
                                        </div>
                                    </div>
                                )}

                            </div>
                            {currentPlanTier !== 1 && laOwner && (
                                <div className="flex gap-2">
                                    <button
                                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                                        onClick={handleRenew}
                                        disabled={!membership || !planHienTaiId || dangXuLy}
                                    >
                                        {dangXuLy ? "Đang xử lý…" : "Gia hạn"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {danhSachPlan.map((p) => {
                                const laHienTai = p.planId === planHienTaiId;
                                const currentPlanTier = getPlanTier(membership?.planName);
                                const thisPlanTier = getPlanTier(p.planName);
                                const isLowerTier = thisPlanTier < currentPlanTier;
                                const isHigherTier = thisPlanTier > currentPlanTier;
                                const isCurrentFree = currentPlanTier === 1; // Check if current plan is Free

                                const feats = parsePlanFeatures(p);
                                const features = (feats.length ? feats : [
                                    `Số tổ chức tối đa: ${p.maxOrganizations < 0 ? "Không giới hạn" : p.maxOrganizations}`,
                                    `Người dùng/tổ chức: ${p.maxUsersPerOrg < 0 ? "Không giới hạn" : p.maxUsersPerOrg}`,
                                    `Bản đồ/tháng: ${p.maxMapsPerMonth < 0 ? "Không giới hạn" : p.maxMapsPerMonth}`,
                                ]);

                                return (
                                    <div
                                        key={p.planId}
                                        className={`rounded-lg border p-4 ${laHienTai
                                            ? (isDark ? "border-emerald-500/30 bg-emerald-500/10" : "border-emerald-300 bg-emerald-50/60")
                                            : themeClasses.tableBorder
                                            } ${isDark ? "bg-zinc-900/50" : "bg-white"}`}
                                    >
                                        <div className="flex items-baseline justify-between">
                                            <div className={`text-base font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{p.planName}</div>
                                            <div className={`text-sm font-semibold ${isDark ? "text-zinc-100" : "text-gray-800"}`}>
                                                {dinhDangTien(p.priceMonthly)}/tháng
                                            </div>
                                        </div>
                                        <ul className={`mt-3 space-y-1 text-sm ${themeClasses.textMuted}`}>
                                            {features.slice(0, 6).map((f, i) => <li key={i}>• {f}</li>)}
                                        </ul>
                                        {laOwner && (
                                            <>
                                                {laHienTai ? (
                                                    <button
                                                        className="mt-4 w-full rounded-md border border-emerald-300 bg-transparent px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                                                        disabled
                                                    >
                                                        {t("plans.current_plan")}
                                                    </button>
                                                ) : isLowerTier ? (
                                                    <button
                                                        className={`mt-4 w-full rounded-md border px-3 py-2 text-xs font-medium ${isDark ? "border-zinc-700 bg-zinc-800 text-zinc-500" : "border-gray-300 bg-gray-100 text-gray-400"}`}
                                                        disabled
                                                    >
                                                        {t("plans.downgrade_disabled")}
                                                    </button>
                                                ) : isCurrentFree && isHigherTier ? (
                                                    <button
                                                        className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() => openPaymentPopup(p.planId, p.planName, p.priceMonthly ?? 0, false)}
                                                        disabled={!orgId || dangXuLy}
                                                    >
                                                        {dangXuLy ? "Đang xử lý…" : t("plans.choose_plan")}
                                                    </button>
                                                ) : isHigherTier ? (
                                                    <button
                                                        className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() => openPaymentPopup(p.planId, p.planName, p.priceMonthly ?? 0, true)}
                                                        disabled={!orgId || dangXuLy}
                                                    >
                                                        {dangXuLy ? "Đang xử lý…" : t("plans.upgrade_plan")}
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="mt-4 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        onClick={() => openPaymentPopup(p.planId, p.planName, p.priceMonthly ?? 0, false)}
                                                        disabled={!orgId || dangXuLy}
                                                    >
                                                        {dangXuLy ? "Đang xử lý…" : t("plans.choose_plan")}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className={`mt-8 rounded-lg border p-4 text-xs ${themeClasses.tableBorder} ${isDark ? "bg-white/5" : "bg-gray-50"} ${themeClasses.textMuted}`}>
                            Lưu ý: Có thể chuyển hướng sang cổng PayOS để thanh toán. Sau khi hoàn tất, hệ thống sẽ tự cập nhật trạng thái gói.
                        </div>
                    </div>
                </div>
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
        </div>
    );
}
