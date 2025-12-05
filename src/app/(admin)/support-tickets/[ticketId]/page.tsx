"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminGetSupportTicketById } from "@/lib/admin-api";

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
        return <div className="p-12 text-center text-zinc-400">Đang tải chi tiết yêu cầu…</div>;
    if (err)
        return (
            <div className="grid gap-5">
                <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
                    <div className="p-4 text-center text-red-500 font-semibold text-sm">{err}</div>
                </section>
            </div>
        );
    if (!ticket)
        return (
            <div className="grid gap-5">
                <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
                    <div className="p-4 text-center text-zinc-400">Không có dữ liệu.</div>
                </section>
            </div>
        );

    return (
        <div className="grid gap-5">
            <section className="bg-zinc-900/98 border border-zinc-800 rounded-xl p-4 shadow-sm grid gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="m-0 text-base font-extrabold">Chi tiết yêu cầu</h3>

                    <div className="flex gap-2 items-center">
                        <button
                            className="text-sm font-bold text-[#3f5f36] hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>

                        <button
                            className="text-sm font-bold text-[#3f5f36] hover:opacity-75 transition-opacity bg-transparent border-0 p-0 cursor-pointer"
                            onClick={() =>
                                router.push(`/support-tickets/${ticket.ticketId}/edit`)
                            }
                        >
                            Chỉnh sửa
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-zinc-200">
                        <div>
                            <h2 className="m-0 text-xl font-bold">
                                {ticket.title || `Phiếu hỗ trợ #${ticket.ticketId}`}
                            </h2>
                            <div className="text-sm text-zinc-500 mt-0.5">
                                Mã yêu cầu: #{ticket.ticketId}
                            </div>
                        </div>
                        <div>{renderStatusBadge(ticket.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 lg:gap-8">
                        <Field label="Mô tả">
                            {ticket.description && ticket.description.trim().length > 0
                                ? ticket.description
                                : "—"}
                        </Field>

                        <Field label="Trạng thái hệ thống">{ticket.status}</Field>

                        <Field label="Danh mục">{ticket.category}</Field>

                        <Field label="Độ ưu tiên">
                            {ticket.priority && ticket.priority.trim().length > 0
                                ? ticket.priority
                                : "—"}
                        </Field>

                        <Field label="Người gửi">
                            {ticket.userName ?? "Ẩn danh"}
                        </Field>

                        <Field label="Email">{ticket.userEmail ?? "—"}</Field>

                        <Field label="Người xử lý">
                            {ticket.assignedToName ||
                                ticket.assignedToUserId ||
                                "Chưa gán"}
                        </Field>

                        <Field label="Tạo lúc">{fmtDate(ticket.createdAt)}</Field>

                        <Field label="Cập nhật">{fmtDate(ticket.updatedAt)}</Field>

                        <Field label="Đã giải quyết lúc">
                            {fmtDate(ticket.resolvedAt)}
                        </Field>

                        {ticket.messageCount && ticket.messageCount > 0 && (
                            <Field label="Hoạt động gần đây">
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
                            <Field label="Ghi chú / phản hồi gần nhất">
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
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="text-sm text-zinc-500 mb-1">
                {label}
            </div>
            <div className="text-base font-medium">
                {children}
            </div>
        </div>
    );
}
