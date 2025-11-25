"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { LifeBuoy, MessageCircle, Plus, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/i18n/I18nProvider";
import {
    SupportTicket,
    SupportTicketMessage,
    getMySupportTickets,
    createSupportTicket,
    getSupportTicket,
    getSupportTicketMessages,
    addSupportTicketMessage,
    closeSupportTicket,
    type SupportTicketStatus,
} from "@/lib/api-support";

function formatDateTime(iso?: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso ?? "";
    return d.toLocaleString();
}

function statusBadgeClass(status?: string | null): string {
    const s = (status ?? "").toLowerCase();

    if (!s) {
        return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/40";
    }
    if (s === "open") {
        return "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40";
    }
    if (s === "pending") {
        return "bg-amber-500/15 text-amber-200 border border-amber-400/40";
    }
    if (s === "closed") {
        return "bg-zinc-700/60 text-zinc-200 border border-zinc-500/60";
    }
    return "bg-sky-500/15 text-sky-200 border border-sky-400/40";
}


export default function HelpPage() {
    const { t } = useI18n();
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;

        const update = () => {
            setIsDark(root.classList.contains("dark"));
        };

        update();

        const observer = new MutationObserver(update);
        observer.observe(root, { attributes: true, attributeFilter: ["class"] });

        return () => observer.disconnect();
    }, []);

    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
        null,
    );
    const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const [creating, setCreating] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [closing, setClosing] = useState(false);

    const [createOpen, setCreateOpen] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const [newSubject, setNewSubject] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newPriority, setNewPriority] = useState("");
    const [newMessage, setNewMessage] = useState("");

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
                const data = await getMySupportTickets();
                if (!cancelled) {
                    setTickets(data);
                    if (data.length > 0 && !selectedId) {
                        setSelectedId(data[0].ticketId);
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
    }, []);

    useEffect(() => {
        if (!selectedId) {
            setSelectedTicket(null);
            setMessages([]);
            return;
        }

        let cancelled = false;

        async function loadDetail() {
            setLoadingDetail(true);
            setError(null);
            try {
                const [ticket, msgs] = await Promise.all([
                    getSupportTicket(selectedId ?? ""),
                    getSupportTicketMessages(selectedId ?? ""),
                ]);
                if (!cancelled) {
                    setSelectedTicket(ticket);
                    setMessages(msgs);
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
                const da = new Date(a.updatedAt ?? a.createdAt ?? "").getTime();
                const db = new Date(b.updatedAt ?? b.createdAt ?? "").getTime();
                return db - da;
            }),
        [tickets],
    );

    const canSendMessage =
        selectedTicket && selectedTicket.status.toLowerCase() !== "closed";

    const statusLabel = (status?: SupportTicketStatus | string | null): string => {
        const raw =
            status == null || status === ""
                ? "Open"
                : String(status);

        const s = raw.toLowerCase();

        if (s === "open" || s === "1") return t("support.statusOpen");
        if (s === "pending" || s === "2") return t("support.statusPending");
        if (s === "closed" || s === "3") return t("support.statusClosed");

        return raw;
    };

    async function handleCreateTicket(e: FormEvent) {
        e.preventDefault();
        if (!newSubject.trim() || !newDescription.trim()) return;

        setCreating(true);
        setError(null);
        try {
            const ticket = await createSupportTicket({
                subject: newSubject.trim(),
                description: newDescription.trim(),
                priority: newPriority || undefined,
            });
            setTickets((old) => [ticket, ...old]);
            setNewSubject("");
            setNewDescription("");
            setNewPriority("");
            setSelectedId(ticket.ticketId);
            setCreateOpen(false);
        } catch (err) {
            setError(safeMessage(err));
        } finally {
            setCreating(false);
        }
    }

    async function handleSendMessage(e: FormEvent) {
        e.preventDefault();
        if (!selectedId || !newMessage.trim() || !canSendMessage) return;

        setSendingMessage(true);
        setError(null);
        try {
            const msg = await addSupportTicketMessage(selectedId, {
                content: newMessage.trim(),
            });
            setMessages((old) => [...old, msg]);
            setNewMessage("");
        } catch (err) {
            setError(safeMessage(err));
        } finally {
            setSendingMessage(false);
        }
    }

    async function handleCloseTicket() {
        if (!selectedId || !selectedTicket) return;
        setClosing(true);
        setError(null);

        try {
            await closeSupportTicket(selectedId);
            const updated: SupportTicket = {
                ...selectedTicket,
                status: "Closed",
            };
            setSelectedTicket(updated);
            setTickets((old) =>
                old.map((t) =>
                    t.ticketId === selectedId ? { ...t, status: "Closed" } : t,
                ),
            );
        } catch (err) {
            setError(safeMessage(err));
        } finally {
            setClosing(false);
        }
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-0">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400 bg-emerald-100/95 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm shadow-emerald-200/80 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                        <LifeBuoy className="h-3 w-3" />
                        <span>{t("support.badgeLabel")}</span>
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            <span style={{ color: isDark ? "#ffffff" : "#000000" }}>
                                {t("support.title")}
                            </span>
                        </h1>

                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {t("support.subtitle")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className="hidden items-center gap-1 rounded-full border border-emerald-400 bg-emerald-100/95 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm shadow-emerald-200/80 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200 sm:inline-flex"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        {loadingTickets
                            ? t("support.ticketListLoading")
                            : t("support.ticketListCount", { count: tickets.length })}
                    </Badge>
                    <Button
                        size="sm"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-zinc-950 shadow-md hover:bg-emerald-500 sm:text-sm"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="h-4 w-4" />
                        <span>{t("support.createButtonHeader")}</span>
                    </Button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
                <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-xl dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-50">
                    <header className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className="space-y-0.5">
                            <h2 className="text-sm font-semibold">
                                {t("support.ticketListTitle")}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {t("support.ticketListSubtitle")}
                            </p>
                        </div>
                        <Badge
                            variant="outline"
                            className="border-emerald-400/60 bg-emerald-50 text-[11px] text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                        >
                            {loadingTickets
                                ? t("support.ticketListLoading")
                                : t("support.ticketListCount", { count: tickets.length })}
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
                                                    {ticket.subject}
                                                </p>
                                                <span
                                                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                                                        ticket.status,
                                                    )}`}
                                                >
                                                    {statusLabel(ticket.status)}
                                                </span>
                                            </div>
                                            <p className="line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
                                                {ticket.description}
                                            </p>
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                                                {t("support.ticketCreatedAt", {
                                                    createdAt: formatDateTime(ticket.createdAt),
                                                })}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}

                            {!loadingTickets && tickets.length === 0 && (
                                <div className="px-4 py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                                    {t("support.ticketListEmpty")}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </section>

                <section className="flex min-h-[420px] flex-col rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-xl dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-50">
                    <header className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h2 className="text-base font-semibold">
                                    {selectedTicket
                                        ? selectedTicket.subject
                                        : t("support.detailPlaceholder")}
                                </h2>
                                {selectedTicket && (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {t("support.detailMeta", {
                                            ticketId: selectedTicket.ticketId,
                                            createdAt: formatDateTime(selectedTicket.createdAt),
                                        })}
                                    </p>
                                )}
                            </div>
                            {selectedTicket && (
                                <div className="flex flex-col items-end gap-2">
                                    <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                                            selectedTicket.status,
                                        )}`}
                                    >
                                        {statusLabel(selectedTicket.status)}
                                    </span>
                                    {selectedTicket.status.toLowerCase() !== "closed" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCloseTicket}
                                            disabled={closing}
                                            className="h-8 border border-zinc-200 bg-zinc-50 text-xs text-zinc-800 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                                        >
                                            {closing
                                                ? t("support.detailClosing")
                                                : t("support.detailCloseButton")}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="flex flex-1 flex-col">
                        <div className="flex-1">
                            {loadingDetail && selectedId && (
                                <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                                    {t("support.detailLoading")}
                                </div>
                            )}

                            {!loadingDetail && !selectedTicket && (
                                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                    {t("support.detailEmpty")}
                                </div>
                            )}

                            {!loadingDetail && selectedTicket && (
                                <div className="flex h-full flex-col">
                                    <div className="space-y-2 px-6 pb-2 pt-4 text-sm">
                                        {selectedTicket.description && (
                                            <>
                                                <p className="font-medium">
                                                    {t("support.detailInitialDescriptionTitle")}
                                                </p>
                                                <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-800 dark:bg-white/5 dark:text-zinc-100">
                                                    {selectedTicket.description}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                    <Separator className="bg-zinc-100 dark:bg-white/10" />
                                    <ScrollArea className="flex-1 px-4 py-3">
                                        <div className="space-y-3">
                                            {messages.map((m) => {
                                                const fromSupport = Boolean(m.isFromSupport);
                                                return (
                                                    <div
                                                        key={m.messageId}
                                                        className={`flex w-full ${fromSupport ? "justify-start" : "justify-end"
                                                            }`}
                                                    >
                                                        <div
                                                            className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${fromSupport
                                                                ? "bg-zinc-100 text-zinc-900 dark:bg-white/5 dark:text-zinc-50"
                                                                : "bg-emerald-600 text-zinc-950"
                                                                }`}
                                                        >
                                                            {m.senderName && (
                                                                <p className="mb-1 text-[10px] font-semibold opacity-80">
                                                                    {m.senderName}
                                                                </p>
                                                            )}
                                                            <p>{m.content}</p>
                                                            <p className="mt-1 text-[10px] opacity-70">
                                                                {formatDateTime(m.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {messages.length === 0 && (
                                                <p className="px-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                                                    {t("support.messagesEmpty")}
                                                </p>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}
                        </div>

                        <Separator className="bg-zinc-100 dark:bg-white/10" />

                        <div className="px-4 pb-4 pt-2">
                            <form onSubmit={handleSendMessage} className="space-y-2">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={
                                        !selectedTicket
                                            ? t("support.messagesPlaceholderNoTicket")
                                            : selectedTicket.status.toLowerCase() === "closed"
                                                ? t("support.messagesPlaceholderClosed")
                                                : t("support.messagesPlaceholder")
                                    }
                                    rows={3}
                                    disabled={!canSendMessage || sendingMessage}
                                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100 dark:focus:ring-emerald-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-900/40"
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {t("support.messagesNotice")}
                                    </p>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={!canSendMessage || sendingMessage}
                                        className="bg-emerald-600 text-xs font-semibold text-zinc-950 hover:bg-emerald-500"
                                    >
                                        {sendingMessage
                                            ? t("support.messagesSending")
                                            : t("support.messagesSend")}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </section>
            </div>

            {createOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-white/95 p-6 text-zinc-900 shadow-2xl shadow-emerald-500/20 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold">
                                    {t("support.createTitle")}
                                </h2>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {t("support.createDescription")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-50"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateTicket} className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                    {t("support.createSubjectLabel")}
                                </label>
                                <input
                                    value={newSubject}
                                    onChange={(e) => setNewSubject(e.target.value)}
                                    placeholder={t("support.createSubjectPlaceholder")}
                                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                    {t("support.createPriorityLabel")}
                                </label>
                                <input
                                    value={newPriority}
                                    onChange={(e) => setNewPriority(e.target.value)}
                                    placeholder={t("support.createPriorityPlaceholder")}
                                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                                    {t("support.createDescriptionLabel")}
                                </label>
                                <textarea
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder={t("support.createDescriptionPlaceholder")}
                                    rows={4}
                                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-100"
                                />
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-2">
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCreateOpen(false)}
                                        className="border border-zinc-200 bg-zinc-50 text-xs text-zinc-800 hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                                        disabled={creating}
                                    >
                                        {t("support.createCancel")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={creating}
                                        className="bg-emerald-600 text-xs font-semibold text-zinc-950 hover:bg-emerald-500"
                                    >
                                        {creating
                                            ? t("support.createSubmitting")
                                            : t("support.createSubmit")}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
