"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminGetSupportTicketById } from "@/lib/admin-api";
import { useTheme } from "../../layout";
import { getThemeClasses } from "@/utils/theme-utils";

type TicketStatus = "Open" | "Pending" | "Closed";
type Priority = string;

type Ticket = {
    ticketId: number;
    title: string;
    description?: string | null;
    status: TicketStatus | string;
    priority: Priority | null;
    category: string;
    userName?: string | null;
    userEmail?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    resolvedAt?: string | null;
    messageCount?: number | null;
    lastMessage?: string | null;
    assignedToUserId?: string | null;
    assignedToName?: string | null;
    response?: string | null;
};

const fmtDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function SupportTicketDetailPage() {
    const router = useRouter();
    const params = useParams<{ ticketId?: string }>();
    const ticketId = params?.ticketId ?? "";
    const { isDark } = useTheme();
    const theme = getThemeClasses(isDark);

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

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
                const data = await adminGetSupportTicketById<Ticket>(ticketId);
                if (!alive) return;
                setTicket(data);
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

    const renderStatusBadge = (status: TicketStatus | string) => {
        if (status === "Closed") return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#b45309] bg-amber-500/18">Đã đóng</span>;
        if (status === "Pending")
            return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-blue-600 bg-blue-500/16">Đang chờ</span>;
        return <span className="px-2 py-1 rounded-full text-xs font-extrabold text-[#166534] bg-green-500/16">Đang mở</span>;
    };

    if (loading)
        return <div className={`p-12 text-center ${theme.textMuted}`}>Đang tải chi tiết yêu cầu…</div>;
    if (err)
        return (
            <div className="grid gap-5">
                <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
                    <div className="p-4 text-center text-red-500 font-semibold text-sm">{err}</div>
                </section>
            </div>
        );
    if (!ticket)
        return (
            <div className="grid gap-5">
                <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
                    <div className={`p-4 text-center ${theme.textMuted}`}>Không có dữ liệu.</div>
                </section>
            </div>
        );

    return (
        <div className="grid gap-5">
            <section className={`${theme.panel} border rounded-xl p-4 shadow-sm grid gap-3`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className={`m-0 text-base font-extrabold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>Chi tiết yêu cầu</h3>

                    <div className="flex gap-2 items-center">
                        <button
                            className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'} hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer`}
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>

                        <button
                            className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'} hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer`}
                            onClick={() =>
                                router.push(`/support-tickets/${ticket.ticketId}/edit`)
                            }
                        >
                            Chỉnh sửa
                        </button>
                    </div>
                </div>

                <div className={`${isDark ? 'bg-zinc-800/50' : 'bg-white'} rounded-xl p-6 shadow-sm`}>
                    <div className={`flex justify-between items-center mb-3 pb-3 border-b ${theme.tableBorder}`}>
                        <div>
                            <h2 className={`m-0 text-xl font-bold ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                                {ticket.title || `Phiếu hỗ trợ #${ticket.ticketId}`}
                            </h2>
                            <div className={`text-sm ${theme.textMuted} mt-0.5`}>
                                Mã yêu cầu: #{ticket.ticketId}
                            </div>
                        </div>
                        <div>{renderStatusBadge(ticket.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 lg:gap-8">
                        <Field label="Mô tả" theme={theme} isDark={isDark}>
                            {ticket.description && ticket.description.trim().length > 0
                                ? ticket.description
                                : "—"}
                        </Field>

                        <Field label="Trạng thái hệ thống" theme={theme} isDark={isDark}>{ticket.status}</Field>

                        <Field label="Danh mục" theme={theme} isDark={isDark}>{ticket.category}</Field>

                        <Field label="Độ ưu tiên" theme={theme} isDark={isDark}>
                            {ticket.priority && ticket.priority.trim().length > 0
                                ? ticket.priority
                                : "—"}
                        </Field>

                        <Field label="Người gửi" theme={theme} isDark={isDark}>
                            {ticket.userName ?? "Ẩn danh"}
                        </Field>

                        <Field label="Email" theme={theme} isDark={isDark}>{ticket.userEmail ?? "—"}</Field>

                        <Field label="Người xử lý" theme={theme} isDark={isDark}>
                            {ticket.assignedToName ||
                                ticket.assignedToUserId ||
                                "Chưa gán"}
                        </Field>

                        <Field label="Tạo lúc" theme={theme} isDark={isDark}>{fmtDate(ticket.createdAt)}</Field>

                        <Field label="Cập nhật" theme={theme} isDark={isDark}>{fmtDate(ticket.updatedAt)}</Field>

                        <Field label="Đã giải quyết lúc" theme={theme} isDark={isDark}>
                            {fmtDate(ticket.resolvedAt)}
                        </Field>

                        {ticket.messageCount && ticket.messageCount > 0 && (
                            <Field label="Hoạt động gần đây" theme={theme} isDark={isDark}>
                                <div>
                                    <div>
                                        <strong>Số tin nhắn:</strong>{" "}
                                        {ticket.messageCount.toLocaleString("vi-VN")}
                                    </div>
                                    {ticket.lastMessage && (
                                        <div style={{ marginTop: 4 }}>
                                            <strong>Tin cuối:</strong> {ticket.lastMessage}
                                        </div>
                                    )}
                                </div>
                            </Field>
                        )}

                        {ticket.response && (
                            <Field label="Ghi chú / phản hồi gần nhất" theme={theme} isDark={isDark}>
                                {ticket.response}
                            </Field>
                        )}
                    </div>
                </div>
            </section>
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
