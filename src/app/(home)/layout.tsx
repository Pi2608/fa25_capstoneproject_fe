import ChatAIWidget from "@/components/chat/ChatAIWidget";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CustomMapOSM",
  description: "Shared layout without duplicate header",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={[
        "min-h-screen text-zinc-100",
        "bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(16,185,129,0.22),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(16,185,129,0.14),transparent)]",
        "bg-gradient-to-b from-zinc-950 via-emerald-950/25 to-zinc-950",
      ].join(" ")}
    >
      {children}
      <ChatAIWidget />
    </main>
  );
}
