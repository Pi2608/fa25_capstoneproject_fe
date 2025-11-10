"use client";

import Link from "next/link";
import type { SVGProps } from "react";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

type Feature = { title: string; desc: string };
type Step = { k: string; t: string; d: string };
type Kpi = { label: string; value: string; sub: string };
type Preset = { title: string; desc: string; href: string };

function tr(s: string): string {
  const m: Record<string, string> = {
    "Dashboards": "Bảng điều khiển",
    "Maps, charts, and KPIs that move together": "Bản đồ, biểu đồ và KPI liên kết đồng bộ",
    "Compose fast, real-time dashboards with cross-filtering and drill-through. Connect data once, then publish securely.":
      "Lắp ghép dashboard thời gian thực, tải nhanh với cross-filtering và đi sâu dữ liệu. Kết nối dữ liệu một lần rồi xuất bản an toàn.",
    "Start now": "Bắt đầu ngay",
    "Watch webinar": "Xem webinar",
    "Map + Charts": "Bản đồ + Biểu đồ",
    "Link layers with bar/line/pie tables and KPIs for instant context.": "Liên kết lớp bản đồ với bảng cột/đường/tròn và KPI để có ngữ cảnh tức thì.",
    "Cross-filtering": "Lọc chéo",
    "Select on the map to filter every widget, or lasso in a chart to update the map.": "Chọn trên bản đồ để lọc mọi widget, hoặc khoanh vùng trong biểu đồ để cập nhật bản đồ.",
    "Drill-through": "Đi sâu dữ liệu",
    "Open detail panels or navigate to deep-dive views with preserved filters.": "Mở bảng chi tiết hoặc chuyển đến trang phân tích sâu với bộ lọc được giữ nguyên.",
    "Realtime & Alerts": "Thời gian thực & Cảnh báo",
    "Live tiles and streaming data with threshold-based alerts and email digests.": "Ô dữ liệu trực tiếp và luồng dữ liệu cùng cảnh báo theo ngưỡng và email tổng hợp.",
    "Calculated Fields": "Trường tính toán",
    "Create metrics with expressions, groupings, bins, and date windows.": "Tạo chỉ số bằng biểu thức, nhóm, phân loại và cửa sổ thời gian.",
    "Permissions": "Phân quyền",
    "Roles and row-level security inherited from sources with audit trails.": "Vai trò và bảo mật theo dòng kế thừa từ nguồn, kèm nhật ký kiểm toán.",
    "District = All": "Quận = Tất cả",
    "Date: Last 7 days": "Ngày: 7 ngày qua",
    "Type: Incidents": "Loại: Sự cố",
    "Incidents today": "Sự cố hôm nay",
    "+12 vs. yesterday": "+12 so với hôm qua",
    "Avg response": "Thời gian phản hồi TB",
    "P95: 12.1 min": "P95: 12.1 phút",
    "Affected districts": "Số quận bị ảnh hưởng",
    "out of 24": "trong tổng 24",
    "Open tasks": "Công việc đang mở",
    "12 overdue": "12 trễ hạn",
    "Incidents by district": "Sự cố theo quận",
    "Trend last 7 days": "Xu hướng 7 ngày",
    "Live map": "Bản đồ trực tiếp",
    "Filter selection": "Lọc theo lựa chọn",
    "Drill-through button": "Đi sâu dữ liệu",
    "Workflow": "Quy trình",
    "Build in four steps": "Xây trong 4 bước",
    "Kickstart": "Khởi động",
    "Popular dashboard presets": "Mẫu dashboard phổ biến",
    "View all templates": "Xem tất cả mẫu",
    "Use preset": "Dùng mẫu này",
    "Why it’s fast": "Vì sao nhanh",
    "Server-side aggregation, spatial indexes, and overviews with tile-based delivery.":
      "Tổng hợp phía server, chỉ mục không gian và overviews, phân phối theo tile.",
    "Client cache and optimistic interactions for sub-200 ms feedback.":
      "Cache phía client và tương tác lạc quan cho phản hồi < 200 ms.",
    "WebGL rendering for large vector layers and smooth panning.":
      "Kết xuất WebGL cho lớp vector lớn và cuộn mượt.",
    "Median filter": "Thời gian phản hồi bộ lọc",
    "Cache hits": "Tỉ lệ cache hit",
    "Uptime": "Uptime",
    "Integrations": "Tích hợp",
    "Bring your data, keep your stack.": "Mang dữ liệu của bạn, giữ nguyên công nghệ đang dùng.",
    "Ready to build a dashboard?": "Sẵn sàng tạo dashboard?",
    "Start from a preset or an empty canvas. Invite teammates anytime.":
      "Bắt đầu từ mẫu có sẵn hoặc trang trống. Mời đồng đội bất cứ lúc nào.",
    "Start free": "Bắt đầu miễn phí",
    "See pricing": "Xem giá",
    "FAQ": "Câu hỏi thường gặp",
    "Bản đồ trực tiếp": "Bản đồ trực tiếp",
    "Xu hướng 7 ngày": "Xu hướng 7 ngày",
    "Sự cố theo quận": "Sự cố theo quận",
    "Bắt đầu ngay": "Bắt đầu ngay",
    "Xem webinar": "Xem webinar",
    "Dùng mẫu này": "Dùng mẫu này",
    "Xem tất cả mẫu": "Xem tất cả mẫu",
    "Lọc theo lựa chọn": "Lọc theo lựa chọn",
    "Đi sâu dữ liệu": "Đi sâu dữ liệu",
  };
  return m[s] ?? s;
}

function GaugeIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M12 3A10 10 0 0 0 2 13h2a8 8 0 1 1 16 0h2A10 10 0 0 0 12 3Zm-1 7v6h2v-6h-2Z" /></svg>;
}
function GridIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" /></svg>;
}
function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M5 11h11.17l-3.58-3.59L14 6l6 6-6 6-1.41-1.41L16.17 13H5z" /></svg>;
}
function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" aria-hidden {...props}><path fill="currentColor" d="M9.6 16.6 5 12l1.4-1.4 3.2 3.2 8-8L19 7l-9.4 9.6Z" /></svg>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300">{children}</span>;
}

export default function DashboardsClient({
  features,
  steps,
  kpis,
  presets,
  integrations,
  interactions,
  faqs,
}: {
  features: Feature[];
  steps: Step[];
  kpis: Kpi[];
  presets: Preset[];
  integrations: string[];
  interactions: Feature[];
  faqs: [string, string][];
}) {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const base = { duration: reduce ? 0 : 0.6, ease: "power2.out", clearProps: "transform,opacity" } as const;
    const ctx = gsap.context(() => {
      gsap.set("[data-reveal]", { autoAlpha: 0, y: 18 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 90%",
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...base }),
        onLeaveBack: (els) => gsap.to(els, { autoAlpha: 0, y: 18, duration: reduce ? 0 : 0.3 }),
      });
      document.querySelectorAll<HTMLElement>("[data-reveal-stagger]").forEach((parent) => {
        const items = parent.querySelectorAll<HTMLElement>("[data-reveal-item]");
        gsap.set(items, { autoAlpha: 0, y: 14 });
        ScrollTrigger.create({
          trigger: parent,
          start: "top 92%",
          onEnter: () => gsap.to(items, { autoAlpha: 1, y: 0, stagger: 0.06, ...base }),
          onLeaveBack: () => gsap.to(items, { autoAlpha: 0, y: 14, stagger: 0.04, duration: reduce ? 0 : 0.3 }),
        });
      });
    });
    return () => { ctx.revert(); };
  }, []);

  return (
    <main className="relative mx-auto max-w-7xl px-6 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1000px_420px_at_12%_-4%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_380px_at_88%_-6%,rgba(16,185,129,0.08),transparent)]" />
      <section className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-8 ring-1 ring-emerald-500/10" data-reveal>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <GaugeIcon className="h-3.5 w-3.5" />
            {tr("Dashboards")}
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-5xl">{tr("Maps, charts, and KPIs that move together")}</h1>
          <p className="mt-3 max-w-2xl text-zinc-300">
            {tr("Compose fast, real-time dashboards with cross-filtering and drill-through. Connect data once, then publish securely.")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400">
              {tr("Start now")}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link href="/resources/webinars" className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70">
              {tr("Watch webinar")}
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5 hover:bg-white/10 transition" data-reveal-item>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                <GridIcon className="h-4 w-4 text-emerald-400" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white">{tr(f.title)}</h3>
                <p className="mt-1 text-sm text-zinc-400">{tr(f.desc)}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3" data-reveal>
        <div className="rounded-3xl border border-zinc-700/60 bg-zinc-900/60 p-6 lg:col-span-2" data-reveal>
          <div className="flex flex-wrap items-center gap-2" data-reveal-stagger>
            <Pill>{tr("District = All")}</Pill>
            <Pill>{tr("Date: Last 7 days")}</Pill>
            <Pill>{tr("Type: Incidents")}</Pill>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4" data-reveal-stagger>
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-4" data-reveal-item>
                <div className="text-xs text-zinc-400">{tr(k.label)}</div>
                <div className="mt-1 text-2xl font-extrabold text-white">{k.value}</div>
                <div className="text-xs text-zinc-500">{tr(k.sub)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" data-reveal-stagger>
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-3" data-reveal-item>
              <div className="mb-2 text-sm text-zinc-400">{tr("Incidents by district")}</div>
              <div className="aspect-[16/9] rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
            </div>
            <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-3" data-reveal-item>
              <div className="mb-2 text-sm text-zinc-400">{tr("Trend last 7 days")}</div>
              <div className="aspect-[16/9] rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-zinc-700/60 bg-zinc-900/60 p-6" data-reveal>
          <div className="text-sm text-zinc-400">{tr("Live map")}</div>
          <div className="mt-2 aspect-[9/12] w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
            <div className="h-full w-full bg-[radial-gradient(120%_80%_at_50%_0%,rgba(16,185,129,0.15),transparent)]" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-3 py-2 text-xs font-medium text-emerald-300 hover:border-emerald-400/70">{tr("Lọc theo lựa chọn")}</button>
            <button className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-medium text-zinc-950 hover:bg-emerald-400">{tr("Đi sâu dữ liệu")}</button>
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10" data-reveal>
        <p className="text-sm tracking-wide text-emerald-300/90">{tr("Workflow")}</p>
        <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{tr("Build in four steps")}</h2>
        <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" data-reveal-stagger>
          {steps.map((s, i) => (
            <li key={s.k} className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5" data-reveal-item>
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10">{i + 1}</span>
                {tr(s.k)}
              </div>
              <h3 className="mt-2 text-base font-semibold text-white">{tr(s.t)}</h3>
              <p className="mt-1 text-sm text-zinc-400">{tr(s.d)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" data-reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm tracking-wide text-emerald-300/90">{tr("Kickstart")}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{tr("Popular dashboard presets")}</h2>
          </div>
          <Link href="/templates" className="hidden rounded-xl border border-emerald-500/40 bg-zinc-900 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-400/70 sm:inline-flex">
            {tr("View all templates")}
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal-stagger>
          {presets.map((t) => (
            <article key={t.title} className="rounded-2xl border border-zinc-700/60 bg-zinc-900/60 p-5" data-reveal-item>
              <div className="aspect-[16/9] w-full overflow-hidden rounded-xl ring-1 ring-white/5">
                <div className="h-full w-full bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
              </div>
              <h3 className="mt-3 text-base font-semibold leading-snug text-white">{tr(t.title)}</h3>
              <p className="mt-1 text-sm text-zinc-400">{tr(t.desc)}</p>
              <div className="mt-4">
                <Link href={t.href} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400">
                  {tr("Use preset")}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2" data-reveal-stagger>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">{tr("Why it’s fast")}</h3>
          <ul className="mt-3 space-y-3 text-sm text-zinc-300">
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 text-emerald-400" />{tr("Server-side aggregation, spatial indexes, and overviews with tile-based delivery.")}</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 text-emerald-400" />{tr("Client cache and optimistic interactions for sub-200 ms feedback.")}</li>
            <li className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 text-emerald-400" />{tr("WebGL rendering for large vector layers and smooth panning.")}</li>
          </ul>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[
              [tr("Median filter"), "≤ 180 ms"],
              [tr("Cache hits"), "85–97%"],
              [tr("Uptime"), "99.95%"],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-4">
                <div className="text-xs text-zinc-400">{k as string}</div>
                <div className="mt-1 text-xl font-extrabold text-white">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 ring-1 ring-white/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">{tr("Integrations")}</h3>
          <p className="mt-1 text-sm text-zinc-400">{tr("Bring your data, keep your stack.")}</p>
          <div className="mt-3 flex flex-wrap gap-2" data-reveal-stagger>
            {integrations.map((i) => (
              <Pill key={i}>{tr(i)}</Pill>
            ))}
          </div>
          <div className="mt-5">
            <div className="rounded-2xl ring-1 ring-white/10 bg-black/60 p-4 text-[12px] leading-5 text-zinc-200">{`POST /api/dashboards
{
  "title": "Ops Command",
  "widgets": ["map","kpi","bar","line","table"],
  "permissions": {"view": ["team:ops"], "edit": ["role:Admin"]}
}`}</div>
          </div>
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2" data-reveal-stagger>
        {interactions.map((f) => (
          <div key={f.title} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
            <h3 className="text-base font-semibold text-white">{tr(f.title)}</h3>
            <p className="mt-1 text-sm text-zinc-400">{tr(f.desc)}</p>
            <div className="mt-3 aspect-[16/9] rounded-xl ring-1 ring-white/10 bg-gradient-to-br from-emerald-500/15 via-emerald-400/10 to-transparent" />
          </div>
        ))}
      </section>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2" data-reveal-stagger>
        <div className="rounded-3xl border border-emerald-400/20 bg-zinc-900/60 p-6 ring-1 ring-emerald-500/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">{tr("FAQ")}</h3>
          <div className="mt-3 space-y-4 text-sm">
            {faqs.map(([q, a]) => (
              <div key={q}>
                <div className="font-medium text-zinc-100">{tr(q)}</div>
                <p className="mt-1 text-zinc-400">{tr(a)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-b from-emerald-500/10 to-transparent p-6 ring-1 ring-emerald-500/10" data-reveal-item>
          <h3 className="text-lg font-semibold text-white">{tr("Ready to build a dashboard?")}</h3>
          <p className="mt-1 text-sm text-zinc-300">{tr("Start from a preset or an empty canvas. Invite teammates anytime.")}</p>
          <div className="mt-4 flex gap-3">
            <Link href="/signup" className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">{tr("Start free")}</Link>
            <Link href="/pricing" className="rounded-xl border border-emerald-500/40 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:border-emerald-400/70">{tr("See pricing")}</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
