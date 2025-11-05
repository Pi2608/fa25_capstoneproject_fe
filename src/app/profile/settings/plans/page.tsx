"use client";

import { useEffect, useMemo, useState } from "react";
import { getMe, type Me } from "@/lib/api-auth";
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
    return "Đã xảy ra lỗi. Vui lòng thử lại.";
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
    orgs, value, onChange, className = ""
}: { orgs: ToChuc[]; value?: string; onChange: (id: string) => void; className?: string }) {
    const current = orgs.find(o => o.orgId === value);
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Tổ chức</span>
            <div className="relative">
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500">▾</div>
                <select
                    className="min-w-64 appearance-none rounded-md border border-zinc-200 bg-white px-3 py-2 pr-7 text-sm text-zinc-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {orgs.length === 0 ? <option value="" disabled>(Chưa có tổ chức)</option> : null}
                    {orgs.map(o => (<option key={o.orgId} value={o.orgId}>{o.orgName}</option>))}
                </select>
            </div>
            {current && (
                <div className="hidden md:flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
                    <HinhTronChuCai ten={current.orgName} />
                    <span className="font-medium">{current.orgName}</span>
                </div>
            )}
        </div>
    );
}

export default function TrangGoiThanhVien() {
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

    useEffect(() => {
        if (!orgId) { setMembership(null); return; }
        setDangLoadMem(true);
        setBanner(null);
        getMyMembership(orgId)
            .then((m) => setMembership(m))
            .catch((e) => setBanner({ type: "error", text: thongBaoLoi(e) }))
            .finally(() => setDangLoadMem(false));
    }, [orgId]);

    const planHienTaiId = membership?.planId;
    const planHienTaiTen = membership?.planName ?? "—";
    const danhSachPlan = useMemo(
        () => [...(Array.isArray(plans) ? plans : [])].sort((a, b) => (a.priceMonthly ?? 0) - (b.priceMonthly ?? 0)),
        [plans]
    );

    async function nhanGiaHan() {
        if (!planHienTaiId) return;
        setDangXuLy(true); setBanner(null);
        try {
            await createOrRenewMembership({ planId: planHienTaiId });
            setBanner({ type: "success", text: "Gia hạn gói thành công." });
            const m = await getMyMembership(orgId);
            setMembership(m);
        } catch (e) { setBanner({ type: "error", text: thongBaoLoi(e) }); }
        finally { setDangXuLy(false); }
    }
    async function nhanChon(planId: number) {
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
    async function nhanNangCap(planId: number) {
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
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Quản lý gói thành viên cho tổ chức.</p>

            <div className="mt-3">
                <ChonToChuc orgs={orgs} value={orgId} onChange={setOrgId} />
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
                <div className="mt-4 rounded-xl border border-zinc-200 bg-white/70 p-6 text-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-300">
                    Bạn chưa có tổ chức nào. Hãy tạo một tổ chức để quản lý gói thành viên.
                </div>
            ) : (
                <div className="mt-4 rounded-xl border border-zinc-200/70 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/60">
                    <div className="px-6 py-5 rounded-t-xl bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-500/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-zinc-500">Gói hiện tại</div>
                                <div className="text-lg font-semibold">{planHienTaiTen}</div>
                                {dangLoadMem ? (
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400">Đang tải gói…</div>
                                ) : !membership ? (
                                    <div className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có gói cho tổ chức này.</div>
                                ) : (
                                    <div className="mt-1 grid grid-cols-1 gap-1 text-sm text-zinc-700 dark:text-zinc-300">
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
                                    onClick={nhanGiaHan}
                                    disabled={!planHienTaiId || dangXuLy}
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
                                        className={`rounded-lg border p-4 dark:bg-zinc-900/50 ${laHienTai
                                            ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                                            : "border-zinc-200/70 bg-white dark:border-white/10"
                                            }`}
                                    >
                                        <div className="flex items-baseline justify-between">
                                            <div className="text-base font-semibold">{p.planName}</div>
                                            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                                {dinhDangTien(p.priceMonthly)}/tháng
                                            </div>

                                        </div>
                                        <ul className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
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
                                                    onClick={() => nhanChon(p.planId)}
                                                    disabled={!orgId || dangXuLy}
                                                >
                                                    Chọn gói
                                                </button>
                                                <button
                                                    className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                                                    onClick={() => nhanNangCap(p.planId)}
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

                        <div className="mt-8 rounded-lg border border-zinc-200/70 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                            Lưu ý: Có thể chuyển hướng sang cổng PayOS để thanh toán. Sau khi hoàn tất, hệ thống sẽ tự cập nhật trạng thái gói.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
