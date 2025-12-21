"use client";

import { useEffect, useMemo, useState, FormEvent, useCallback } from "react";
import { LifeBuoy, MessageCircle, Plus, AlertCircle, X, CheckCircle, Send, Clock, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";
import {
    SupportTicket,
    SupportTicketMessage,
    getSupportTickets,
    createSupportTicket,
    getSupportTicketById,
    responseToSupportTicket,
    type SupportTicketStatus,
} from "@/lib/api-support";
import { useSupportTicketHub } from "@/lib/hubs/support-tickets";
import type {
    SupportTicketMessage as SignalRMessage,
    TicketReplyEvent,
    TicketStatusChangedEvent,
    TicketClosedEvent
} from "@/lib/hubs/support-tickets";

function formatDateTime(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso ?? "";
    return d.toLocaleString("vi-VN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function statusBadgeClass(status?: string | null): string {
    const s = (status ?? "").toLowerCase();

    if (!s) {
        return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/40";
    }
    if (s === "open") {
        return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40";
    }
    if (s === "inprogress") {
        return "bg-blue-500/15 text-blue-300 border border-blue-400/40";
    }
    if (s === "waitingforcustomer") {
        return "bg-amber-500/15 text-amber-200 border border-amber-400/40";
    }
    if (s === "resolved") {
        return "bg-green-500/15 text-green-300 border border-green-400/40";
    }
    if (s === "closed") {
        return "bg-zinc-700/60 text-zinc-200 border border-zinc-500/60";
    }
    return "bg-sky-500/15 text-sky-200 border border-sky-400/40";
}

const PRIORITY_OPTIONS = [
    { value: "low", label: "Thấp" },
    { value: "medium", label: "Trung bình" },
    { value: "high", label: "Cao" },
    { value: "urgent", label: "Khẩn cấp" },
];

const CATEGORY_OPTIONS = [
    { value: "technical", label: "Kỹ thuật" },
    { value: "billing", label: "Thanh toán" },
    { value: "feature", label: "Tính năng" },
    { value: "bug", label: "Lỗi" },
    { value: "other", label: "Khác" },
];

export default function HelpPage() {
    const { t } = useI18n();
    const { resolvedTheme, theme } = useTheme();
    const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
    const isDark = currentTheme === "dark";
    const themeClasses = getThemeClasses(isDark);

    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [creating, setCreating] = useState(false);
    const [responding, setResponding] = useState(false);

    const [createOpen, setCreateOpen] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [newSubject, setNewSubject] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [newPriority, setNewPriority] = useState("medium");
    const [newCategory, setNewCategory] = useState("other");

    const [responseText, setResponseText] = useState("");
    const [realtimeEnabled, setRealtimeEnabled] = useState(true);

    const handleNewMessage = useCallback((message: SignalRMessage) => {
        setTickets(prev =>
            prev.map(t =>
                t.ticketId === message.ticketId ? { ...t, message: message.message } : t
            )
        );

        if (message.ticketId !== selectedId) return;

        setSelectedTicket(prev => {
            if (!prev) return prev;

            const existed = (prev.messages || []).some(m => m.messageId === message.messageId);
            if (existed) return prev;

            const newMessage: SupportTicketMessage = {
                messageId: message.messageId,
                message: message.message,
                isFromUser: message.isFromUser,
                createdAt: message.createdAt,
            };

            return {
                ...prev,
                messages: [...(prev.messages || []), newMessage],
            };
        });
    }, [selectedId]);


    const handleTicketReply = useCallback((event: TicketReplyEvent) => {
        setTickets(prev =>
            prev.map(t =>
                t.ticketId === event.ticketId
                    ? { ...t, message: event.message }
                    : t
            )
        );

        // IMPORTANT: update detail conversation
        if (event.ticketId === selectedId) {
            setSelectedTicket(prev => {
                if (!prev) return prev;

                const replyKey = `admin|${event.createdAt}|${event.message}`;

                const existed = (prev.messages || []).some(m => {
                    const key = `${m.isFromUser ? "user" : "admin"}|${m.createdAt}|${m.message}`;
                    return key === replyKey;
                });
                if (existed) return prev;

                const newMsg: SupportTicketMessage = {
                    messageId: -Math.abs(`${replyKey}`.split("").reduce((a, c) => a + c.charCodeAt(0), 0)),
                    message: event.message,
                    isFromUser: false,
                    createdAt: event.createdAt,
                };

                return {
                    ...prev,
                    messages: [...(prev.messages || []), newMsg],
                };
            });
        }
    }, [selectedId]);

    const handleTicketStatusChanged = useCallback((event: TicketStatusChangedEvent) => {
        if (event.ticketId === selectedId) {
            setSelectedTicket(prev =>
                prev ? { ...prev, status: event.status as SupportTicketStatus } : prev
            );
        }
        setTickets(prev =>
            prev.map(t =>
                t.ticketId === event.ticketId
                    ? { ...t, status: event.status as SupportTicketStatus }
                    : t
            )
        );
    }, [selectedId]);

    const handleTicketClosed = useCallback((event: TicketClosedEvent) => {
        if (event.ticketId === selectedId) {
            setSelectedTicket(prev =>
                prev ? { ...prev, status: "closed" } : prev
            );
        }
        setTickets(prev =>
            prev.map(t =>
                t.ticketId === event.ticketId
                    ? { ...t, status: "closed" }
                    : t
            )
        );
    }, [selectedId]);

    const { isConnected } = useSupportTicketHub(
        {
            onNewMessage: handleNewMessage,
            onTicketReply: handleTicketReply,
            onTicketStatusChanged: handleTicketStatusChanged,
            onTicketClosed: handleTicketClosed,
        },
        {
            enabled: realtimeEnabled,
            ticketId: selectedId,
        }
    );

    const safeMessage = (err: unknown): string => {
        if (err instanceof Error && err.message) return err.message;
        if (err && typeof err === "object" && "message" in err) {
            const m = (err as { message?: unknown }).message;
            if (typeof m === "string" && m.trim()) return m;
        }
        return t("support.errorRequestFailed");
    };

    useEffect(() => {
        let cancelled = false;

        async function loadTickets() {
            setLoadingTickets(true);
            setError(null);
            try {
                const data = await getSupportTickets(page, 20);
                if (!cancelled) {
                    setTickets(data.tickets);
                    setTotalPages(data.totalPages);
                    if (data.tickets.length > 0 && !selectedId) {
                        setSelectedId(data.tickets[0].ticketId);
                    }
                }
            } catch (err) {
                if (!cancelled) setError(safeMessage(err));
            } finally {
                if (!cancelled) setLoadingTickets(false);
            }
        }

        loadTickets();
        return () => {
            cancelled = true;
        };
    }, [page]);

    useEffect(() => {
        if (!selectedId) {
            setSelectedTicket(null);
            return;
        }

        let cancelled = false;

        async function loadDetail() {
            setLoadingDetail(true);
            setError(null);
            try {
                const ticket = await getSupportTicketById(selectedId ?? 0);
                if (!cancelled) {
                    setSelectedTicket(ticket);
                }
            } catch (err) {
                if (!cancelled) setError(safeMessage(err));
            } finally {
                if (!cancelled) setLoadingDetail(false);
            }
        }

        loadDetail();
        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    const orderedTickets = useMemo(
        () =>
            [...tickets].sort((a, b) => {
                const da = new Date(a.createdAt ?? "").getTime();
                const db = new Date(b.createdAt ?? "").getTime();
                return db - da;
            }),
        [tickets],
    );

    const statusLabel = (status?: SupportTicketStatus | string | null): string => {
        const raw =
            status == null || status === ""
                ? "open"
                : String(status);

        const s = raw.toLowerCase();

        if (s === "open") return "Mở";
        if (s === "inprogress") return "Đang xử lý";
        if (s === "waitingforcustomer") return "Chờ phản hồi";
        if (s === "resolved") return "Đã giải quyết";
        if (s === "closed") return "Đã đóng";

        return raw;
    };

    async function handleCreateTicket(e: FormEvent) {
        e.preventDefault();
        if (!newSubject.trim() || !newMessage.trim()) return;

        setCreating(true);
        setError(null);
        try {
            const result = await createSupportTicket({
                subject: newSubject.trim(),
                message: newMessage.trim(),
                priority: newPriority,
            });
            // Reload tickets to get the full ticket data
            const data = await getSupportTickets(1, 20);
            setTickets(data.tickets);
            setSelectedId(result.ticketId);
            setNewSubject("");
            setNewMessage("");
            setNewPriority("medium");
            setNewCategory("other");
            setSelectedId(result.ticketId);
            setCreateOpen(false);
        } catch (err) {
            setError(safeMessage(err));
        } finally {
            setCreating(false);
        }
    }

    async function handleSendResponse() {
        if (!selectedId || !responseText.trim()) return;
        const content = responseText.trim();

        setResponding(true);
        setError(null);

        const optimisticId = Date.now();
        const optimistic: SupportTicketMessage = {
            messageId: optimisticId,
            message: content,
            isFromUser: true,
            createdAt: new Date().toISOString(),
        };

        setSelectedTicket(prev => {
            if (!prev) return prev;
            const existed = (prev.messages || []).some(m => m.messageId === optimisticId);
            if (existed) return prev;
            return { ...prev, messages: [...(prev.messages || []), optimistic] };
        });

        setTickets(prev =>
            prev.map(t => (t.ticketId === selectedId ? { ...t, message: content } : t))
        );

        try {
            await responseToSupportTicket(selectedId, { response: content });
            setResponseText("");
        } catch (err) {
            setError(safeMessage(err));
            setSelectedTicket(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    messages: (prev.messages || []).filter(m => m.messageId !== optimisticId),
                };
            });
        } finally {
            setResponding(false);
        }
    }

    const canRespond = selectedTicket &&
        selectedTicket.status !== "closed" &&
        selectedTicket.status !== "resolved";

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-0">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400 bg-emerald-100/95 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm shadow-emerald-200/80 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <LifeBuoy className="h-3.5 w-3.5" />
                        {t("support.eyebrow")}
                    </div>
                    <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
                        {t("support.headline")}
                    </h1>
                    <p className={`max-w-xl text-sm ${themeClasses.textMuted}`}>
                        {t("support.subheadline")}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        size="sm"
                        onClick={() => setCreateOpen(true)}
                        className="gap-1.5 bg-emerald-600 font-semibold text-zinc-950 shadow-md shadow-emerald-700/20 hover:bg-emerald-500"
                    >
                        <Plus className="h-4 w-4" />
                        <span>{t("support.createButtonHeader")}</span>
                    </Button>
                </div>
            </div>

            {error && (
                <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${isDark
                    ? "border-red-400/40 bg-red-500/10 text-red-200"
                    : "border-red-400/40 bg-red-50 text-red-700"
                    }`}>
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
                {/* Ticket List */}
                <section className={`flex min-h-[420px] flex-col rounded-2xl border shadow-xl ${themeClasses.panel} ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
                    <header className={`flex items-center justify-between border-b px-4 py-3 ${themeClasses.tableBorder} ${isDark ? "bg-white/5" : "bg-zinc-50/80"}`}>
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-semibold">
                                {t("support.ticketListTitle")}
                            </h2>
                            <p className={`text-xs ${themeClasses.textMuted}`}>
                                {t("support.ticketListSubtitle")}
                            </p>
                        </div>
                        <Badge
                            variant="outline"
                            className="border-emerald-400/60 bg-emerald-50 text-[11px] text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                        >
                            {loadingTickets
                                ? t("support.ticketListLoading")
                                : `${tickets.length} tickets`}
                        </Badge>
                    </header>
                    <ScrollArea className="flex-1 px-3 py-3">
                        <div className="space-y-1">
                            {orderedTickets.map((ticket) => {
                                const isActive = ticket.ticketId === selectedId;
                                return (
                                    <button
                                        key={ticket.ticketId}
                                        type="button"
                                        onClick={() => setSelectedId(ticket.ticketId)}
                                        className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors ${isActive
                                            ? "bg-emerald-50 ring-1 ring-emerald-400/70 dark:bg-emerald-500/10 dark:ring-emerald-400/60"
                                            : "hover:bg-zinc-50 dark:hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="mt-0.5">
                                            <MessageCircle className="h-4 w-4 text-zinc-400" />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="line-clamp-1 font-medium">
                                                    {ticket.subject || "Không có tiêu đề"}
                                                </p>
                                                <span
                                                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                                                        ticket.status,
                                                    )}`}
                                                >
                                                    {statusLabel(ticket.status)}
                                                </span>
                                            </div>
                                            <p className={`line-clamp-2 text-xs ${isDark ? "text-zinc-300" : "text-zinc-600"}`}>
                                                {ticket.message || "Không có mô tả"}
                                            </p>
                                            <p className={`text-[11px] ${themeClasses.textMuted}`}>
                                                {formatDateTime(ticket.createdAt)}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                            {!loadingTickets && tickets.length === 0 && (
                                <div className={`py-8 text-center text-xs ${themeClasses.textMuted}`}>
                                    {t("support.ticketListEmpty")}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 border-t px-4 py-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                Trước
                            </Button>
                            <span className="text-xs text-zinc-500">
                                Trang {page}/{totalPages}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Sau
                            </Button>
                        </div>
                    )}
                </section>

                {/* Ticket Detail */}
                <section className={`flex min-h-[420px] flex-col rounded-2xl border shadow-xl ${themeClasses.panel} ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
                    <header className={`border-b px-4 py-3 ${themeClasses.tableBorder} ${isDark ? "bg-white/5" : "bg-zinc-50/80"}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h2 className="text-base font-semibold">
                                    {selectedTicket
                                        ? selectedTicket.subject || "Không có tiêu đề"
                                        : t("support.detailPlaceholder")}
                                </h2>
                                {selectedTicket && (
                                    <p className={`text-xs ${themeClasses.textMuted}`}>
                                        #{selectedTicket.ticketId} · {formatDateTime(selectedTicket.createdAt)}
                                    </p>
                                )}
                            </div>
                            {selectedTicket && (
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                                        selectedTicket.status,
                                    )}`}
                                >
                                    {statusLabel(selectedTicket.status)}
                                </span>
                            )}
                        </div>
                    </header>

                    <div className="flex flex-1 flex-col overflow-hidden">
                        {loadingDetail && selectedId && (
                            <div className={`flex h-full items-center justify-center text-sm ${themeClasses.textMuted}`}>
                                {t("support.detailLoading")}
                            </div>
                        )}

                        {!loadingDetail && !selectedTicket && (
                            <div className={`flex h-full items-center justify-center px-6 text-center text-sm ${themeClasses.textMuted}`}>
                                {t("support.detailEmpty")}
                            </div>
                        )}

                        {!loadingDetail && selectedTicket && (
                            <div className="flex flex-1 flex-col overflow-hidden">
                                <ScrollArea className="flex-1 p-4">
                                    <div className="space-y-4">
                                        {/* Initial Message */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <MessageCircle className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                                                <p className={`text-xs font-medium ${themeClasses.textMuted}`}>
                                                    Yêu cầu ban đầu
                                                </p>
                                            </div>
                                            <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${isDark ? "bg-white/5 text-zinc-100" : "bg-zinc-50 text-zinc-800"}`}>
                                                {selectedTicket.message || "—"}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-zinc-500">
                                                <span>Độ ưu tiên: {selectedTicket.priority}</span>
                                                <span>{formatDateTime(selectedTicket.createdAt)}</span>
                                            </div>
                                        </div>

                                        <Separator className={isDark ? "bg-white/10" : "bg-zinc-100"} />

                                        {/* Messages/Conversation */}
                                        <div className="space-y-3">
                                            <p className={`text-xs font-medium ${themeClasses.textMuted}`}>
                                                Cuộc trò chuyện ({selectedTicket.messages?.length || 0})
                                            </p>

                                            {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedTicket.messages.map((msg: SupportTicketMessage) => (
                                                        <div
                                                            key={msg.messageId}
                                                            className={`rounded-xl px-4 py-3 text-sm ${msg.isFromUser
                                                                ? isDark
                                                                    ? "bg-blue-500/10 text-blue-200 border border-blue-400/30 ml-8"
                                                                    : "bg-blue-50 text-blue-900 border border-blue-200 ml-8"
                                                                : isDark
                                                                    ? "bg-white/5 text-zinc-100 mr-8"
                                                                    : "bg-zinc-50 text-zinc-800 mr-8"
                                                                }`}
                                                        >
                                                            <p className="leading-relaxed">{msg.message || "—"}</p>
                                                            <p className={`text-xs mt-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                                                                {formatDateTime(msg.createdAt)}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className={`rounded-xl px-4 py-6 text-center text-sm ${isDark ? "bg-white/5 text-zinc-400" : "bg-zinc-50 text-zinc-500"}`}>
                                                    Chưa có tin nhắn nào trong cuộc trò chuyện này.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </ScrollArea>

                                {/* Response Input */}
                                {canRespond && (
                                    <>
                                        <Separator className={isDark ? "bg-white/10" : "bg-zinc-100"} />
                                        <div className="p-4 space-y-2">
                                            <textarea
                                                value={responseText}
                                                onChange={(e) => setResponseText(e.target.value)}
                                                placeholder="Nhập phản hồi của bạn..."
                                                rows={3}
                                                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${themeClasses.input}`}
                                            />
                                            <Button
                                                onClick={handleSendResponse}
                                                disabled={!responseText.trim() || responding}
                                                className="w-full bg-emerald-600 text-zinc-950 hover:bg-emerald-500"
                                                size="sm"
                                            >
                                                <Send className="h-4 w-4 mr-2" />
                                                {responding ? "Đang gửi..." : "Gửi phản hồi"}
                                            </Button>
                                        </div>
                                    </>
                                )}

                                {!canRespond && selectedTicket.status === "resolved" && (
                                    <div className={`p-4 border-t ${isDark ? "border-white/10 bg-green-500/10" : "border-zinc-200 bg-green-50"}`}>
                                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                                            <CheckCircle className="h-4 w-4" />
                                            <span>Ticket này đã được giải quyết.</span>
                                        </div>
                                    </div>
                                )}

                                {selectedTicket.status === "closed" && (
                                    <div className={`p-4 border-t ${isDark ? "border-white/10 bg-zinc-800/50" : "border-zinc-200 bg-zinc-100"}`}>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                                            <X className="h-4 w-4" />
                                            <span>Ticket này đã được đóng.</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Create Ticket Modal */}
            {createOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
                    <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl shadow-emerald-500/20 ${themeClasses.panel} ${isDark ? "text-zinc-50" : "text-zinc-900"}`}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold">
                                    {t("support.createTitle")}
                                </h2>
                                <p className={`text-xs ${themeClasses.textMuted}`}>
                                    {t("support.createDescription")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className={`rounded-full p-1 ${isDark ? "text-zinc-400 hover:bg-white/10 hover:text-zinc-50" : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTicket} className="space-y-3">
                            <div className="space-y-1">
                                <label className={`text-xs font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                                    Tiêu đề *
                                </label>
                                <input
                                    value={newSubject}
                                    onChange={(e) => setNewSubject(e.target.value)}
                                    placeholder="Nhập tiêu đề yêu cầu..."
                                    required
                                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className={`text-xs font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                                        Danh mục
                                    </label>
                                    <select
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                                    >
                                        {CATEGORY_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className={`text-xs font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                                        Độ ưu tiên *
                                    </label>
                                    <select
                                        value={newPriority}
                                        onChange={(e) => setNewPriority(e.target.value)}
                                        required
                                        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${themeClasses.input}`}
                                    >
                                        {PRIORITY_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className={`text-xs font-medium ${isDark ? "text-zinc-200" : "text-zinc-700"}`}>
                                    Mô tả chi tiết *
                                </label>
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Mô tả chi tiết vấn đề của bạn..."
                                    rows={5}
                                    required
                                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 resize-none ${themeClasses.input}`}
                                />
                            </div>

                            <div className="mt-4 flex items-center justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCreateOpen(false)}
                                    className={`text-xs ${themeClasses.button}`}
                                    disabled={creating}
                                >
                                    {t("support.createCancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={creating || !newSubject.trim() || !newMessage.trim()}
                                    className="bg-emerald-600 text-xs font-semibold text-zinc-950 hover:bg-emerald-500"
                                >
                                    {creating
                                        ? t("support.createSubmitting")
                                        : t("support.createSubmit")}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
