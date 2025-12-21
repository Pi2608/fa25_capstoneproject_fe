/**
 * FAQ & AI Assistant API
 */

import { getJson, apiFetch, postJson } from "./api-core";

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

export type SupportTicketStatus = "open" | "inprogress" | "waitingforcustomer" | "resolved" | "closed";

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

export type ReplySupportTicketRequest = {
  reply: string;
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

export type ReplySupportTicketResponse = {
  ticketId: number;
  message: string;
};

export type CloseSupportTicketResponse = {
  ticketId: number;
  message: string;
};
// User create support ticket
export async function createSupportTicket(request: CreateSupportTicketRequest): Promise<CreateSupportTicketResponse> {
  const res = await postJson<CreateSupportTicketRequest, CreateSupportTicketResponse>(SUPPORT_TICKET_API_BASE, request);
  return res;
}
//User get support tickets
export async function getSupportTickets(page: number = 1, pageSize: number = 20): Promise<SupportTicketListResponse> {
  const res = await getJson<SupportTicketListResponse>(`${SUPPORT_TICKET_API_BASE}?page=${page}&pageSize=${pageSize}`);
  return res;
}
//User get support ticket by id
export async function getSupportTicketById(ticketId: number): Promise<SupportTicket> {
  const res = await getJson<SupportTicket>(`${SUPPORT_TICKET_API_BASE}/${ticketId}`);
  return res;
}
//User response to support ticket
export async function responseToSupportTicket(ticketId: number, request: ResponseSupportTicketRequest): Promise<ResponseSupportTicketResponse> {
  const res = await postJson<ResponseSupportTicketRequest, ResponseSupportTicketResponse>(`${SUPPORT_TICKET_API_BASE}/${ticketId}/response`, request);
  return res;
}
//Admin get support tickets
export async function getSupportTicketsByAdmin(page: number, pageSize: number): Promise<SupportTicketListResponse> {
  const res = await getJson<SupportTicketListResponse>(`${SUPPORT_TICKET_API_BASE}/admin?page=${page}&pageSize=${pageSize}`);
  return res;
}
//Admin get support ticket by id
export async function getSupportTicketByIdByAdmin(ticketId: number): Promise<SupportTicket> {
  const res = await getJson<SupportTicket>(`${SUPPORT_TICKET_API_BASE}/admin/${ticketId}`);
  return res;
}
//Admin reply to support ticket
export async function replyToSupportTicket(ticketId: number, request: ReplySupportTicketRequest): Promise<ReplySupportTicketResponse> {
  const res = await postJson<ReplySupportTicketRequest, ReplySupportTicketResponse>(`${SUPPORT_TICKET_API_BASE}/admin/${ticketId}/reply`, request);
  return res;
}
//Admin close support ticket
export async function closeSupportTicket(ticketId: number): Promise<CloseSupportTicketResponse> {
  const res = await postJson<void, CloseSupportTicketResponse>(`${SUPPORT_TICKET_API_BASE}/admin/${ticketId}/close`, undefined);
  return res;
}