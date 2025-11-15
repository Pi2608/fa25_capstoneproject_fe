"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import s from "../../admin.module.css";
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
        if (status === "Closed") return <span className={s.badgeWarn}>Đã đóng</span>;
        if (status === "Pending")
            return <span className={s.badgePending}>Đang chờ</span>;
        return <span className={s.badgeSuccess}>Đang mở</span>;
    };

    if (loading)
        return <div className={s.loadingBox}>Đang tải chi tiết yêu cầu…</div>;
    if (err)
        return (
            <div className={s.stack}>
                <section className={s.panel}>
                    <div className={s.errorBox}>{err}</div>
                </section>
            </div>
        );
    if (!ticket)
        return (
            <div className={s.stack}>
                <section className={s.panel}>
                    <div className={s.emptyBox}>Không có dữ liệu.</div>
                </section>
            </div>
        );

    return (
        <div className={s.stack}>
            <section className={s.panel}>
                <div className={s.panelHead}>
                    <h3>Chi tiết yêu cầu</h3>

                    <div
                        className={s.actionsRight}
                        style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                        <button
                            className={s.linkBtn}
                            onClick={() => router.push("/support-tickets")}
                        >
                            ← Quay lại
                        </button>

                        <button
                            className={s.linkBtn}
                            onClick={() =>
                                router.push(`/support-tickets/${ticket.ticketId}/edit`)
                            }
                        >
                            Chỉnh sửa
                        </button>
                    </div>
                </div>

                <div
                    style={{
                        background: "white",
                        borderRadius: 12,
                        padding: 24,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                            borderBottom: "1px solid #eee",
                            paddingBottom: 10,
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    margin: 0,
                                    fontSize: 20,
                                    fontWeight: 700,
                                }}
                            >
                                {ticket.title || `Phiếu hỗ trợ #${ticket.ticketId}`}
                            </h2>
                            <div
                                style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}
                            >
                                Mã yêu cầu: #{ticket.ticketId}
                            </div>
                        </div>
                        <div>{renderStatusBadge(ticket.status)}</div>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                            gap: "18px 32px",
                        }}
                    >
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
            <div
                style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginBottom: 4,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontSize: 15,
                    fontWeight: 500,
                }}
            >
                {children}
            </div>
        </div>
    );
}
