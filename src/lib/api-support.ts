/**
 * FAQ & AI Assistant API
 */

import { getJson, apiFetch, postJson, putJson } from "./api-core";

// ===== FAQ =====
export type FaqItem = {
  faqId: number;
  question: string;
  answer: string;
  category: string;
  createdAt: string;
};

export async function searchFaqs(q: string): Promise<FaqItem[]> {
  const res = await getJson<FaqItem[] | { items: FaqItem[] }>(
    `/faqs/search?q=${encodeURIComponent(q)}`,
  );
  return Array.isArray(res) ? res : (res.items ?? []);
}

export async function getFaqSuggestions(limit = 8): Promise<string[]> {
  try {
    const res = await getJson<FaqItem[] | { items: FaqItem[] }>(
      `/faqs?limit=${limit}`,
    );
    const arr = Array.isArray(res) ? res : (res.items ?? []);
    return arr.slice(0, limit).map((x) => x.question);
  } catch {
    return [];
  }
}

// ===== AI ASSISTANT =====
export type AIMessage = { role: "user" | "assistant" | "system"; content: string };
export type AIAnswer = { answer: string };

export async function askAI(messages: AIMessage[]): Promise<string | null> {
  const aiBase = process.env.NEXT_PUBLIC_AI_ENDPOINT?.replace(/\/+$/, "");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "");
  const url = aiBase ? `${aiBase}/chat` : `${base}/ai/chat`;
  try {
    const res = await apiFetch<AIAnswer>(url.replace(/([^:]\/)\/+/g, "$1"), {
      method: "POST",
      body: JSON.stringify({ messages }),
      headers: { "Content-Type": "application/json" },
    });
    return res?.answer ?? null;
  } catch {
    return null;
  }
}

// ===== SUPPORT TICKET =====

export const SUPPORT_TICKET_API_BASE = "/support-tickets";
const ADMIN_BASE = "/api/admin";

export type SupportTicketStatus =
  | "open"
  | "inprogress"
  | "waitingforcustomer"
  | "resolved"
  | "closed";

export type CreateSupportTicketRequest = {
  subject: string;
  message: string;
  priority: string;
};

export type CreateSupportTicketResponse = {
  ticketId: number;
  message: string;
};

export type ResponseSupportTicketRequest = {
  response: string;
};

export type SupportTicketMessage = {
  messageId: number;
  message: string;
  isFromUser: boolean;
  createdAt: string;
};

export type SupportTicket = {
  ticketId: number;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  messages: SupportTicketMessage[];
};

export type SupportTicketListResponse = {
  tickets: SupportTicket[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ResponseSupportTicketResponse = {
  ticketId: number;
  message: string;
};

export type CloseSupportTicketResponse = {
  ticketId: number;
  message: string;
};

// ===== helpers =====

function normalizeStatus(input: unknown): SupportTicketStatus {
  const s = String(input ?? "").trim().toLowerCase();
  if (!s) return "open";
  if (s === "open") return "open";
  if (s === "closed") return "closed";
  if (s === "resolved") return "resolved";
  if (s === "inprogress" || s === "in_progress" || s === "in-progress") return "inprogress";
  if (
    s === "waitingforcustomer" ||
    s === "waiting_for_customer" ||
    s === "waiting-for-customer"
  ) {
    return "waitingforcustomer";
  }
  return "open";
}

function normalizePriority(input: unknown): string {
  const p = String(input ?? "").trim().toLowerCase();
  if (p === "cao") return "high";
  return p;
}

// ===== USER APIs =====

export async function createSupportTicket(
  request: CreateSupportTicketRequest
): Promise<CreateSupportTicketResponse> {
  return postJson<CreateSupportTicketRequest, CreateSupportTicketResponse>(
    SUPPORT_TICKET_API_BASE,
    request
  );
}

export async function getSupportTickets(
  page: number = 1,
  pageSize: number = 20
): Promise<SupportTicketListResponse> {
  return getJson<SupportTicketListResponse>(
    `${SUPPORT_TICKET_API_BASE}?page=${page}&pageSize=${pageSize}`
  );
}

export async function getSupportTicketById(ticketId: number): Promise<SupportTicket> {
  return getJson<SupportTicket>(`${SUPPORT_TICKET_API_BASE}/${ticketId}`);
}

export async function responseToSupportTicket(
  ticketId: number,
  request: ResponseSupportTicketRequest
): Promise<ResponseSupportTicketResponse> {
  return postJson<ResponseSupportTicketRequest, ResponseSupportTicketResponse>(
    `${SUPPORT_TICKET_API_BASE}/${ticketId}/response`,
    request
  );
}

// ===== ADMIN DTOs (backend) =====

type AdminTicketDto = {
  ticketId: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category?: string;
  userId?: string;
  userName?: string | null;
  userEmail?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  messageCount?: number;
  lastMessage?: string | null;
};

type AdminTicketListDto = {
  tickets: AdminTicketDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ===== ADMIN APIs =====

export async function getSupportTicketsByAdmin(
  page: number = 1,
  pageSize: number = 20
): Promise<SupportTicketListResponse> {
  const res = await getJson<AdminTicketListDto>(
    `${ADMIN_BASE}/support-tickets?page=${page}&pageSize=${pageSize}`
  );

  return {
    tickets: (res.tickets ?? []).map((t) => ({
      ticketId: t.ticketId,
      userEmail: t.userEmail ?? "",
      userName: t.userName ?? "",
      subject: t.title ?? "",
      message: t.description ?? "",
      status: normalizeStatus(t.status),
      priority: normalizePriority(t.priority),
      createdAt: t.createdAt,
      resolvedAt: t.resolvedAt ?? null,
      messages: [],
    })),
    totalCount: Number(res.totalCount ?? 0),
    page: Number(res.page ?? page),
    pageSize: Number(res.pageSize ?? pageSize),
    totalPages: Number(res.totalPages ?? 1),
  };
}

export async function getSupportTicketByIdByAdmin(ticketId: number): Promise<SupportTicket> {
  const t = await getJson<AdminTicketDto>(`${ADMIN_BASE}/support-tickets/${ticketId}`);

  return {
    ticketId: t.ticketId,
    userEmail: t.userEmail ?? "",
    userName: t.userName ?? "",
    subject: t.title ?? "",
    message: t.description ?? "",
    status: normalizeStatus(t.status),
    priority: normalizePriority(t.priority),
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt ?? null,
    messages: [],
  };
}

export type AdminUpdateSupportTicketRequest = {
  ticketId: number;
  status?: string;
  priority?: string;
  assignedToUserId?: string | null;
  response?: string;
};

export type AdminUpdateSupportTicketResponse = {
  ticketId: number;
  message: string;
};

export async function updateSupportTicketByAdmin(
  ticketId: number,
  request: AdminUpdateSupportTicketRequest
): Promise<AdminUpdateSupportTicketResponse> {
  return putJson<AdminUpdateSupportTicketRequest, AdminUpdateSupportTicketResponse>(
    `${ADMIN_BASE}/support-tickets/${ticketId}`,
    request
  );
}

export async function replyToSupportTicket(
  ticketId: number,
  reply: string
): Promise<AdminUpdateSupportTicketResponse> {
  return updateSupportTicketByAdmin(ticketId, { ticketId, response: reply });
}

export async function closeSupportTicket(
  ticketId: number,
  resolution: string
): Promise<CloseSupportTicketResponse> {
  return postJson<{ resolution: string }, CloseSupportTicketResponse>(
    `${ADMIN_BASE}/support-tickets/${ticketId}/close`,
    { resolution }
  );
}

