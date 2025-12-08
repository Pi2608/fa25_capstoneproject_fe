"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupportTicketByIdByAdmin, replyToSupportTicket, closeSupportTicket, SupportTicketStatus } from "@/lib/api-support";
import { useTheme } from "../../layout";
import { getThemeClasses } from "@/utils/theme-utils";
import { SupportTicket } from "@/lib/api-support";


const fmtDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function SupportTicketDetailPage() {
    const router = useRouter();
    const params = useParams<{ ticketId?: string }>();
    const ticketId = params?.ticketId ?? "";
    const { isDark } = useTheme();
    const theme = getThemeClasses(isDark);

    const [ticket, setTicket] = useState<SupportTicket>();
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // Response state
    const [reply, setReply] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        let alive = true;

        (async () => {
            if (!ticketId) {
                setErr("Thiếu ticketId trong URL.");
                return;
            }

            setLoading(true);
            setErr(null);

            try {
                const data = await getSupportTicketByIdByAdmin(Number(ticketId));
                if (!alive) return;
                setTicket(data);
                setReply("");
            } catch (e) {
                if (!alive) return;
                setErr(
                    e instanceof Error
                        ? e.message
                        : "Không thể tải chi tiết phiếu hỗ trợ.",
                );
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
    }, [ticketId]);

    const handleSaveResponse = async (e: FormEvent) => {
        e.preventDefault();
        if (!ticket || saving) return;

        setSaving(true);
        setSaveSuccess(false);
        setErr(null);

        try {
            await replyToSupportTicket(ticket.ticketId, {
                reply: reply.trim(),
            });
            const newMessage = {
                messageId: Date.now(),
                message: reply.trim(),
                isFromUser: false,
                createdAt: new Date().toISOString(),
            };
            setTicket(prev => prev ? { 
                ...prev, 
                messages: [newMessage, ...(prev.messages || [])]
            } : undefined);
            setReply("");
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Không thể lưu phản hồi");
        } finally {
            setSaving(false);
        }
    };

    const handleCloseTicket = async () => {
        if (!ticket || saving) return;

        setSaving(true);
        setErr(null);

        try {
            await closeSupportTicket(ticket.ticketId);
            setTicket(prev => prev ? { ...prev, status: "closed" } : undefined);
            setSaveSuccess(true);
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Không thể đóng ticket");
        } finally {
            setSaving(false);
        }
    };

    const renderStatusBadge = (status: SupportTicketStatus | string) => {
        const statusLower = status?.toLowerCase();
        if (statusLower === "closed") {
            return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">Đã đóng</span>;
        }
        if (statusLower === "inprogress" || statusLower === "inprogress") {
            return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-blue-600 bg-blue-500/16">Đang xử lý</span>;
        }
        if (statusLower === "resolved") {
            return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-green-600 bg-green-500/16">Đã giải quyết</span>;
        }
        if (statusLower === "waitingforcustomer") {
            return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-yellow-600 bg-yellow-500/16">Chờ phản hồi</span>;
        }
        return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">Đang mở</span>;
    };


    const isClosed = ticket?.status?.toLowerCase() === "closed";

    if (loading) {
        return (
            <div className="grid gap-5">
                <section className={`${theme.panel} border rounded-xl p-4 shadow-sm`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className={`m-0 text-base font-extrabold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Chi tiết yêu cầu hỗ trợ</h3>
                        <button
                            className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'} hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer`}
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>
                    </div>
                </section>
                <div className={`${theme.panel} border rounded-xl p-8 shadow-sm text-center`}>
                    <div className={`text-sm ${theme.textMuted}`}>Đang tải...</div>
                </div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="grid gap-5">
                <section className={`${theme.panel} border rounded-xl p-4 shadow-sm`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className={`m-0 text-base font-extrabold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Chi tiết yêu cầu hỗ trợ</h3>
                        <button
                            className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'} hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer`}
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>
                    </div>
                </section>
                <div className={`${theme.panel} border rounded-xl p-8 shadow-sm`}>
                    <div className="text-red-500 text-sm font-semibold mb-4">{err}</div>
                    <button
                        onClick={() => window.location.reload()}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                            isDark
                                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="grid gap-5">
                <section className={`${theme.panel} border rounded-xl p-4 shadow-sm`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className={`m-0 text-base font-extrabold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Chi tiết yêu cầu hỗ trợ</h3>
                        <button
                            className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'} hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer`}
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>
                    </div>
                </section>
                <div className={`${theme.panel} border rounded-xl p-8 shadow-sm text-center`}>
                    <div className={`text-sm ${theme.textMuted}`}>Không tìm thấy phiếu hỗ trợ</div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-5">
            {/* Header */}
            <section className={`${theme.panel} border rounded-xl p-4 shadow-sm`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className={`m-0 text-base font-extrabold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Chi tiết yêu cầu hỗ trợ</h3>

                    <div className="flex gap-2 items-center">
                        <button
                            className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'} hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer`}
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>
                    </div>
                </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
                {/* Ticket Info */}
                <section className={`${theme.panel} border rounded-xl p-6 shadow-sm`}>
                    <div className={`flex justify-between items-center mb-4 pb-3 border-b ${theme.tableBorder}`}>
                        <div>
                            <h2 className={`m-0 text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                                {ticket?.subject || `Phiếu hỗ trợ #${ticketId}`}
                            </h2>
                            <div className={`text-sm ${theme.textMuted} mt-0.5`}>
                                Mã yêu cầu: #{ticket?.ticketId}
                            </div>
                        </div>
                        <div>{renderStatusBadge(ticket?.status as SupportTicketStatus)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Người gửi" theme={theme} isDark={isDark}>
                            {ticket?.userName ?? "Ẩn danh"}
                        </Field>

                        <Field label="Email" theme={theme} isDark={isDark}>
                            {ticket?.userEmail ?? "—"}
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <Field label="Độ ưu tiên" theme={theme} isDark={isDark}>
                            {ticket?.priority ?? "—"}
                        </Field>

                        <Field label="Ngày tạo" theme={theme} isDark={isDark}>
                            {fmtDate(ticket?.createdAt)}
                        </Field>
                    </div>

                    {ticket?.resolvedAt && (
                        <div className="mt-4">
                            <Field label="Ngày giải quyết" theme={theme} isDark={isDark}>
                                {fmtDate(ticket.resolvedAt)}
                            </Field>
                        </div>
                    )}

                    <div className={`mt-4 pt-4 border-t ${theme.tableBorder}`}>
                        <Field label="Nội dung yêu cầu" theme={theme} isDark={isDark}>
                            <div className={`mt-2 p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                                {ticket?.message ?? "Không có mô tả"}
                            </div>
                        </Field>
                    </div>
                </section>

                {/* Response Section */}
                <section className={`${theme.panel} border rounded-xl p-6 shadow-sm`}>
                    <h3 className={`m-0 mb-4 text-base font-extrabold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                        Phản hồi từ Admin
                    </h3>

                    {ticket?.messages && ticket.messages.length > 0 && (
                        <div className={`mb-6 p-4 rounded-lg ${isDark ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
                            <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                Lịch sử trao đổi ({ticket.messages.length} tin nhắn)
                            </h4>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {ticket.messages.map((msg) => (
                                    <div
                                        key={msg.messageId}
                                        className={`p-3 rounded-lg text-sm ${
                                            msg.isFromUser
                                                ? isDark
                                                    ? 'bg-blue-500/20 border border-blue-500/30'
                                                    : 'bg-blue-50 border border-blue-200'
                                                : isDark
                                                    ? 'bg-emerald-500/20 border border-emerald-500/30'
                                                    : 'bg-emerald-50 border border-emerald-200'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <span className={`text-xs font-semibold ${
                                                msg.isFromUser
                                                    ? isDark ? 'text-blue-300' : 'text-blue-700'
                                                    : isDark ? 'text-emerald-300' : 'text-emerald-700'
                                            }`}>
                                                {msg.isFromUser ? ticket.userName : 'Admin'}
                                            </span>
                                            <span className={`text-xs ${theme.textMuted}`}>
                                                {fmtDate(msg.createdAt)}
                                            </span>
                                        </div>
                                        <div className={`text-sm ${isDark ? 'text-zinc-200' : 'text-gray-800'} whitespace-pre-wrap`}>
                                            {msg.message}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSaveResponse} className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme.textMuted}`}>
                                Nội dung phản hồi
                            </label>
                            <textarea
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                placeholder={isClosed ? "Ticket đã đóng" : "Nhập phản hồi cho người dùng..."}
                                rows={6}
                                disabled={isClosed || saving}
                                className={`w-full rounded-lg border px-4 py-3 text-sm outline-none resize-none transition-colors ${
                                    isDark 
                                        ? 'bg-zinc-800 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500' 
                                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-emerald-500'
                                } ${isClosed || saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                        </div>

                        {saveSuccess && (
                            <div className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm">
                                ✓ Đã lưu phản hồi thành công!
                            </div>
                        )}

                        {err && (
                            <div className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm">
                                {err}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <p className={`text-xs ${theme.textMuted}`}>
                                {isClosed 
                                    ? 'Ticket này đã được đóng' 
                                    : 'Phản hồi sẽ được gửi đến người dùng'}
                            </p>
                            
                            {!isClosed && (
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={saving || !reply.trim()}
                                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                            !saving && reply.trim()
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer'
                                                : 'bg-gray-400 text-white cursor-not-allowed'
                                        }`}
                                    >
                                        {saving ? 'Đang lưu...' : 'Lưu phản hồi'}
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={handleCloseTicket}
                                        disabled={saving}
                                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                            !saving
                                                ? 'bg-amber-600 text-white hover:bg-amber-500 cursor-pointer'
                                                : 'bg-gray-400 text-white cursor-not-allowed'
                                        }`}
                                    >
                                        {saving ? 'Đang xử lý...' : 'Đóng ticket'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}

function Field({
    label,
    children,
    theme,
    isDark,
}: {
    label: string;
    children: React.ReactNode;
    theme: ReturnType<typeof getThemeClasses>;
    isDark: boolean;
}) {
    return (
        <div>
            <div className={`text-sm ${theme.textMuted} mb-1`}>
                {label}
            </div>
            <div className={`text-base font-medium ${isDark ? 'text-zinc-200' : 'text-gray-900'}`}>
                {children}
            </div>
        </div>
    );
}
