"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { askAI, getFaqSuggestions, searchFaqs, type FaqItem, type AIMessage } from "@/lib/api";

type Role = "user" | "assistant";
type ChatMsg = { id: string; role: Role; content: string; meta?: { source?: "faq" | "ai"; faqId?: number; question?: string } };

const uid = () => Math.random().toString(36).slice(2, 10);

export default function ChatAIWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: uid(), role: "assistant", content: "Chào bạn! Hãy hỏi bất cứ điều gì về CustomMapOSM." },
  ]);
  const [quick, setQuick] = useState<string[]>([]);
  const [typeahead, setTypeahead] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    getFaqSuggestions(8).then((qs) => setQuick(qs));
  }, []);

  useEffect(() => {
    const q = input.trim();
    if (!q) {
      setTypeahead([]);
      return;
    }
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(async () => {
      const r = await searchFaqs(q);
      setTypeahead(r.slice(0, 6).map((x) => x.question));
    }, 220);
  }, [input]);

  const historyForAI: AIMessage[] = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })) as AIMessage[],
    [messages]
  );

  async function ask(text: string) {
    const userMsg: ChatMsg = { id: uid(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    try {
      const faqs: FaqItem[] = await searchFaqs(text);
      if (faqs.length > 0) {
        const best = faqs[0];
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: best.answer,
            meta: { source: "faq", faqId: best.faqId, question: best.question },
          },
        ]);
      }
      const aiAns = await askAI([...historyForAI, { role: "user", content: text }]);
      if (aiAns) {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: aiAns,
            meta: { source: "ai" },
          },
        ]);
      } else if (faqs.length === 0) {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: "Mình chưa tìm thấy câu trả lời. Bạn có thể hỏi theo cách khác hoặc chi tiết hơn.",
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { id: uid(), role: "assistant", content: "Không thể xử lý yêu cầu lúc này." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setTypeahead([]);
    ask(text);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-400 transition"
          aria-label="Open chat"
        >
          💬
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,400px)] rounded-2xl bg-zinc-900/95 text-zinc-100 backdrop-blur-md shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-semibold">Trợ lý CustomMapOSM</div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-zinc-300 hover:text-white hover:bg-white/10"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {quick.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs hover:bg-white/15"
                  type="button"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {typeahead.length > 0 && (
            <div className="px-4 pt-2">
              <div className="text-xs text-zinc-400 mb-1">Gợi ý</div>
              <div className="flex flex-col gap-1">
                {typeahead.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput("");
                      setTypeahead([]);
                      ask(s);
                    }}
                    className="text-left rounded-md px-3 py-2 text-sm bg-white/5 hover:bg-white/10"
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={viewportRef} className="max-h-[48vh] overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={[
                    "inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line",
                    m.role === "user" ? "bg-emerald-600 text-white" : "bg-white/10 text-white",
                  ].join(" ")}
                >
                  {m.content}
                  {m.meta?.source === "faq" && (
                    <div className="mt-1 text-xs text-emerald-300/80">
                      FAQ #{m.meta.faqId} — {m.meta.question}
                    </div>
                  )}
                  {m.meta?.source === "ai" && (
                    <div className="mt-1 text-xs text-emerald-300/80">AI</div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-zinc-300">Đang xử lý…</div>}
          </div>

          <form onSubmit={onSubmit} className="p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi của bạn…"
                className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500/60"
              />
              <button
                disabled={loading}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-60"
              >
                Gửi
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
