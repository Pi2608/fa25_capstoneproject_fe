"use client";

import { useEffect, useMemo, useState } from "react";
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

type Banner = { type: "info" | "success" | "error"; text: string } | null;

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
    if (typeof r.role === "string") return r.role;
    if (typeof r.yourRole === "string") return r.yourRole;
    if (typeof r.license === "string") return r.license;
    if (r.isOwner === true) return "Owner";
    return "";
}

export default function TrangGoiThanhVien() {
    const { resolvedTheme, theme } = useTheme();
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
            .then((m) => setMembership(m))
            .catch((e) => {
                if (la404(e)) {
                    setMembership(null);
                    if (!laOwner) {
                        setBanner({
                            type: "info",
                            text: "Bạn không phải Owner của tổ chức này nên không thể xem thông tin gói hiện tại. Bạn vẫn có thể xem danh sách gói bên dưới.",
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

    const planHienTaiId = membership?.planId;
    const planHienTaiTen = membership?.planName ?? "—";
    const danhSachPlan = useMemo(
        () => [...(Array.isArray(plans) ? plans : [])].sort((a, b) => (a.priceMonthly ?? 0) - (b.priceMonthly ?? 0)),
        [plans]
    );

    async function handleRenew() {
        if (!membership || !planHienTaiId || !orgId) return;
        setDangXuLy(true); setBanner(null);
        try {
            const payload = {
                membershipId: membership.membershipId,
                orgId,
                planId: planHienTaiId,
                autoRenew: membership.autoRenew ?? false,
            } as {
                membershipId?: string;
                orgId?: string;
                planId?: number;
                autoRenew?: boolean;
            };
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
    async function handleSelect(planId: number) {
        if (!me || !orgId) return;
        setDangXuLy(true); setBanner(null);
        try {
            const res = await subscribeToPlan({ userId: me.userId, orgId, planId, paymentMethod: "payOS", autoRenew: true });
            if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
            setBanner({ type: "success", text: "Đăng ký gói thành công." });
            const m = await getMyMembership(orgId); setMembership(m);
        } catch (e) { setBanner({ type: "error", text: thongBaoLoi(e) }); }
        finally { setDangXuLy(false); }
    }
    async function handleUpgrade(planId: number) {
        if (!me || !orgId || !membership) return;
        setDangXuLy(true); setBanner(null);
        try {
            const res = await upgradePlan({ userId: me.userId, orgId, newPlanId: planId, paymentMethod: "payOS", autoRenew: true });
            if (res.paymentUrl) { window.location.href = res.paymentUrl; return; }
            setBanner({ type: "success", text: "Nâng cấp gói thành công." });
            const m = await getMyMembership(orgId); setMembership(m);
        } catch (e) { setBanner({ type: "error", text: thongBaoLoi(e) }); }
        finally { setDangXuLy(false); }
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
                                        {laOwner ? "Chưa có gói cho tổ chức này. Hãy chọn một gói bên dưới." : "Bạn không phải Owner nên không xem được gói hiện tại. Vui lòng liên hệ Owner nếu cần thay đổi gói."}
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
                                                    {new Date(membership.endDate).toLocaleDateString("vi-VN")}
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
                            <div className="flex gap-2">
                                <button
                                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                                    onClick={handleRenew}
                                    disabled={!membership || !planHienTaiId || dangXuLy}
                                >
                                    {dangXuLy ? "Đang xử lý…" : "Gia hạn"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {danhSachPlan.map((p) => {
                                const laHienTai = p.planId === planHienTaiId;
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
                                        {laHienTai ? (
                                            <button
                                                className="mt-4 w-full rounded-md border border-emerald-300 bg-transparent px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                                                disabled
                                            >
                                                Đang sử dụng
                                            </button>
                                        ) : (
                                            <div className="mt-4 grid grid-cols-2 gap-2">
                                                <button
                                                    className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                                                    onClick={() => handleSelect(p.planId)}
                                                    disabled={!orgId || dangXuLy}
                                                >
                                                    Chọn gói
                                                </button>
                                                <button
                                                    className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                                                    onClick={() => handleUpgrade(p.planId)}
                                                    disabled={!orgId || !planHienTaiId || dangXuLy}
                                                >
                                                    Nâng cấp
                                                </button>
                                            </div>
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
        </div>
    );
}
