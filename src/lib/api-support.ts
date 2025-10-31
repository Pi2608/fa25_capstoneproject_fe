/**
 * FAQ & AI Assistant API
 */

import { getJson, apiFetch } from "./api-core";

// ===== FAQ =====
export type FaqItem = {
  faqId: number;
  question: string;
  answer: string;
  category: string;
  createdAt: string;
};

export async function searchFaqs(q: string): Promise<FaqItem[]> {
  const res = await getJson<FaqItem[] | { items: FaqItem[] }>(`/faqs/search?q=${encodeURIComponent(q)}`);
  return Array.isArray(res) ? res : (res.items ?? []);
}

export async function getFaqSuggestions(limit = 8): Promise<string[]> {
  try {
    const res = await getJson<FaqItem[] | { items: FaqItem[] }>(`/faqs?limit=${limit}`);
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
