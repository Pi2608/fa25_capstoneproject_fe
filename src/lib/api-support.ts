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
export type SupportTicketStatus = "Open" | "Pending" | "Closed" | string;

export type SupportTicket = {
  ticketId: string;
  subject: string;
  description?: string | null;
  priority?: string | null;
  status: SupportTicketStatus;
  createdAt?: string;
  updatedAt?: string | null;
};

export type SupportTicketMessage = {
  messageId: string;
  ticketId: string;
  content: string;
  senderName?: string | null;
  isFromSupport?: boolean;
  createdAt?: string;
};

const SUPPORT_BASE = "/api/support-tickets";

export type SupportTicketMessageDto = {
  messageId: number;
  ticketId: number;
  message: string;
  isFromUser: boolean;
  createdAt: string;
};

export type SupportTicketMessage = {
  messageId: number;
  ticketId: number;
  content: string;
  isFromSupport: boolean;
  createdAt: string;
  senderName?: string | null;
};

type AddTicketMessageRequest = {
  ticketId: number;
  message: string;
};

function mapSupportTicketMessage(dto: SupportTicketMessageDto): SupportTicketMessage {
  return {
    messageId: dto.messageId,
    ticketId: dto.ticketId,
    content: dto.message,
    isFromSupport: !dto.isFromUser,
    createdAt: dto.createdAt,
    senderName: dto.isFromUser ? "Bạn" : "Support",
  };
}

type SupportTicketListRes = {
  tickets: SupportTicket[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type CreateSupportTicketRequest = {
  subject: string;
  message: string;
  priority?: string | null;
};

export async function getMySupportTickets(): Promise<SupportTicket[]> {
  const res = await getJson<SupportTicketListRes>(
    `${SUPPORT_BASE}?page=1&pageSize=20`,
  );
  return res.tickets ?? [];
}

export async function createSupportTicket(input: {
  subject: string;
  description: string;
  priority?: string;
}): Promise<SupportTicket> {
  const body: CreateSupportTicketRequest = {
    subject: input.subject,
    message: input.description,
    priority: input.priority ?? undefined,
  };
  return postJson<SupportTicket>(SUPPORT_BASE, body);
}

export async function getSupportTicket(ticketId: string): Promise<SupportTicket> {
  return getJson<SupportTicket>(
    `${SUPPORT_BASE}/${encodeURIComponent(ticketId)}`,
  );
}

export async function closeSupportTicket(ticketId: string): Promise<void> {
  await postJson<void>(
    `${SUPPORT_BASE}/${encodeURIComponent(ticketId)}/close`,
    {},
  );
}

export async function getSupportTicketMessages(
  ticketId: number | string,
): Promise<SupportTicketMessage[]> {
  const res = await getJson<SupportTicketMessageDto[]>(
    `${SUPPORT_BASE}/${encodeURIComponent(String(ticketId))}/messages`,
  );

  return res.map(mapSupportTicketMessage);
}

export async function addSupportTicketMessage(
  ticketId: string | number,
  input: { content: string },
): Promise<SupportTicketMessage> {
  const body: AddTicketMessageRequest = {
    ticketId: typeof ticketId === "number" ? ticketId : Number(ticketId),
    message: input.content,
  };

  const dto = await postJson<SupportTicketMessageDto>(
    `${SUPPORT_BASE}/${encodeURIComponent(String(ticketId))}/messages`,
    body,
  );

  return mapSupportTicketMessage(dto);
}
