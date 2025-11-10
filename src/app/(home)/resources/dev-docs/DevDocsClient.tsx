"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

function Code({
    children,
    filename,
    lang = "bash",
}: {
    children: string;
    filename?: string;
    lang?: string;
}) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="group relative overflow-hidden rounded-xl ring-1 ring-white/10 bg-black/60">
            {filename && (
                <div className="flex items-center justify-between px-3 py-2 text-[11px] text-zinc-400 bg-white/5">
                    <span className="font-mono">{filename}</span>
                    <span className="uppercase tracking-wider">{lang}</span>
                </div>
            )}
            <pre className="overflow-x-auto p-4 text-sm text-zinc-200">
                <code>{children}</code>
            </pre>
            <button
                onClick={() => {
                    navigator.clipboard.writeText(children);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                }}
                className="absolute right-2 top-2 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/20"
                aria-label="Copy to clipboard"
            >
                {copied ? "Đã sao chép" : "Sao chép"}
            </button>
        </div>
    );
}

function Card({
    title,
    children,
    icon,
}: {
    title: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-white/5">
            <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                    {icon ?? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400">
                            <path fill="currentColor" d="M3 4h18v2H3V4m0 6h18v2H3v-2m0 6h18v2H3v-2Z" />
                        </svg>
                    )}
                </span>
                <h3 className="font-semibold">{title}</h3>
            </div>
            <div className="text-sm text-zinc-300">{children}</div>
        </div>
    );
}

export default function DevDocsClient() {
    const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    useLayoutEffect(() => {
        const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;
        const ctx = gsap.context(() => {
            gsap.set(
                [".dd-hero-eyebrow", ".dd-hero-title", ".dd-hero-sub", ".dd-hero-cta"],
                { autoAlpha: 0, y: 18 }
            );
            gsap
                .timeline()
                .to(".dd-hero-eyebrow", { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.45 })
                .to(".dd-hero-title", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
                .to(".dd-hero-sub", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06")
                .to(".dd-hero-cta", { autoAlpha: 1, y: 0, ...baseIn }, "<0.06");

            ScrollTrigger.batch(".dd-section h2", {
                start: "top 88%",
                onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.05, ...baseIn }),
                onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 12 }),
            });
            ScrollTrigger.batch(".dd-card", {
                start: "top 92%",
                onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.08, ...baseIn }),
                onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 12 }),
            });
            ScrollTrigger.batch(".dd-code", {
                start: "top 92%",
                onEnter: (els) =>
                    gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
                onLeaveBack: (els) => gsap.set(els, { autoAlpha: 0, y: 12 }),
            });
        });
        return () => ctx.revert();
    }, [reduce]);

    return (
        <main className="relative mx-auto max-w-7xl px-6 py-10 text-zinc-100">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_15%_0%,rgba(16,185,129,0.10),transparent),radial-gradient(900px_420px_at_85%_0%,rgba(16,185,129,0.08),transparent)]"
            />

            <header className="mb-8">
                <div className="dd-hero-eyebrow text-xs font-semibold tracking-wide text-zinc-400">
                    NHÀ PHÁT TRIỂN
                </div>
                <h1 className="dd-hero-title text-3xl md:text-4xl font-semibold">
                    Tài liệu dành cho Nhà phát triển
                </h1>
                <p className="dd-hero-sub mt-2 max-w-2xl text-zinc-400">
                    API, SDK và hướng dẫn tích hợp để xây dựng trên IMOS.
                </p>
                <div className="dd-hero-cta mt-4 flex flex-wrap gap-3">
                    <Link
                        href="/profile"
                        className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-400"
                    >
                        Lấy API key
                    </Link>
                    <a
                        href="#quickstart"
                        className="rounded-lg px-4 py-2 ring-1 ring-white/15 hover:bg-white/10"
                    >
                        Bắt đầu nhanh
                    </a>
                    <a
                        href="#sdks"
                        className="rounded-lg px-4 py-2 ring-1 ring-white/15 hover:bg-white/10"
                    >
                        SDKs
                    </a>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-6">
                <aside className="col-span-12 md:col-span-3">
                    <nav className="sticky top-20 space-y-2 text-sm">
                        {[
                            ["#quickstart", "Bắt đầu nhanh"],
                            ["#auth", "Xác thực"],
                            ["#rest", "REST API"],
                            ["#sdks", "SDKs"],
                            ["#webhooks", "Webhooks"],
                            ["#errors", "Lỗi & giới hạn"],
                        ].map(([href, label]) => (
                            <a
                                key={href}
                                href={href}
                                className="block rounded-md px-3 py-2 text-zinc-300 hover:bg-white/5 hover:text-white"
                            >
                                {label}
                            </a>
                        ))}
                    </nav>
                </aside>

                <article className="dd-section prose prose-invert col-span-12 md:col-span-9 max-w-none">
                    <h2 id="quickstart" className="scroll-mt-24 opacity-0 translate-y-[12px]">
                        Bắt đầu nhanh
                    </h2>
                    <p className="lead">
                        Tạo một bản đồ trong vài phút bằng REST API hoặc JavaScript SDK.
                    </p>

                    <div className="not-prose grid grid-cols-1 lg:grid-cols-3 gap-4 my-4">
                        <Card title="1) Cài SDK">
                            <p>Dùng npm/pnpm/yarn:</p>
                            <Code lang="bash" filename="Terminal">
                                {`npm i @imos/sdk
# hoặc
pnpm add @imos/sdk
yarn add @imos/sdk`}
                            </Code>
                        </Card>

                        <Card title="2) Lấy API key">
                            <p>
                                Vào <Link className="text-emerald-400" href="/profile">Hồ sơ → API Keys</Link> và
                                tạo key mới. Giữ bí mật.
                            </p>
                        </Card>

                        <Card title="3) Gọi request đầu tiên">
                            <p>Tạo bản đồ qua REST:</p>
                            <Code lang="bash" filename="curl">
                                {`curl -X POST https://api.imos.app/v1/maps \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Field Survey 2025", "visibility": "private" }'`}
                            </Code>
                        </Card>
                    </div>

                    <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-4 my-4">
                        <Card title="Ví dụ JS SDK">
                            <Code lang="ts" filename="example.ts">
                                {`import { Imos } from "@imos/sdk";

const imos = new Imos({ apiKey: process.env.IMOS_API_KEY! });

// 1) Tạo bản đồ
const map = await imos.maps.create({ name: "Urban Audit", visibility: "private" });

// 2) Thêm lớp dữ liệu
await imos.layers.create(map.id, {
  type: "Point",
  data: [{ geometry: [106.7, 10.8], properties: { label: "Site A" } }],
  style: { color: "#10b981", size: 10 }
});

// 3) Xuất ảnh
const file = await imos.exports.png(map.id, { width: 1920, height: 1080 });`}
                            </Code>
                        </Card>

                        <Card title="Fetch với Bearer token">
                            <Code lang="ts" filename="fetch.ts">
                                {`const res = await fetch("https://api.imos.app/v1/maps", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.IMOS_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ name: "My Map", visibility: "public" })
});

const json = await res.json();`}
                            </Code>
                        </Card>
                    </div>

                    <h2 id="auth" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">
                        Xác thực
                    </h2>
                    <p>
                        Dùng token <strong>Bearer</strong> trong header <code>Authorization</code>. API key có
                        thể xoay vòng bất cứ lúc nào trong Hồ sơ. Với client-side, ưu tiên{" "}
                        <strong>token phạm vi hẹp, sống ngắn</strong> (sắp ra mắt).
                    </p>

                    <h2 id="rest" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">
                        Tổng quan REST API
                    </h2>
                    <ul>
                        <li>
                            <code>POST /v1/maps</code> – tạo bản đồ
                        </li>
                        <li>
                            <code>POST /v1/maps/:mapId/layers</code> – thêm lớp (Point/LineString/Polygon/Raster)
                        </li>
                        <li>
                            <code>GET /v1/maps/:mapId/export.png</code> – xuất PNG
                        </li>
                        <li>
                            <code>GET /v1/maps/:mapId/export.pdf</code> – xuất PDF
                        </li>
                        <li>
                            <code>GET /v1/query</code> – truy vấn không gian (PostGIS)
                        </li>
                    </ul>

                    <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-4 my-4">
                        <Card title="Tạo lớp (GeoJSON)">
                            <Code lang="bash" filename="curl">
                                {`curl -X POST https://api.imos.app/v1/maps/123/layers \
  -H "Authorization: Bearer $IMOS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ 
        "type":"Polygon",
        "data":[{"geometry":[[[106.7,10.8],[106.71,10.8],[106.71,10.82],[106.7,10.82],[106.7,10.8]]],
                 "properties":{"zone":"A"}}],
        "style":{"stroke":"#22c55e","fill":"#22c55e22","width":2}
      }'`}
                            </Code>
                        </Card>
                        <Card title="Ví dụ truy vấn không gian">
                            <Code lang="bash" filename="curl">
                                {`curl "https://api.imos.app/v1/query?sql=SELECT%20count(*)%20FROM%20sites%20WHERE%20ST_Intersects(geom,%20ST_GeomFromText('POLYGON((...))',4326))" \
  -H "Authorization: Bearer $IMOS_KEY"`}
                            </Code>
                        </Card>
                    </div>

                    <h2 id="sdks" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">
                        SDKs
                    </h2>
                    <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card title="JavaScript / TypeScript">
                            <p className="mb-2">Dùng cho Browser & Node.</p>
                            <Code lang="bash" filename="Install">
                                {`npm i @imos/sdk
# Docs: import { Imos } from "@imos/sdk"`}
                            </Code>
                        </Card>
                        <Card title="Python (beta)">
                            <p className="mb-2">Phù hợp luồng dữ liệu & notebooks.</p>
                            <Code lang="bash" filename="Install">
                                {`pip install imos-sdk`}
                            </Code>
                        </Card>
                        <Card title="QGIS Plugin">
                            <p className="mb-2">Đồng bộ dự án QGIS lên IMOS.</p>
                            <Link href="/resources/qgis-plugin" className="text-emerald-400">
                                Xem hướng dẫn →
                            </Link>
                        </Card>
                    </div>

                    <h2 id="webhooks" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">
                        Webhooks
                    </h2>
                    <p>
                        Nhận sự kiện khi xuất file xong, lớp dữ liệu thay đổi, hoặc cộng tác viên cập nhật bản
                        đồ. Cấu hình tại <em>Hồ sơ → Webhooks</em>.
                    </p>
                    <Code lang="json" filename="payload.json">
                        {`{
  "type": "export.completed",
  "timestamp": "2025-06-20T09:14:21Z",
  "data": {
    "mapId": "map_123",
    "format": "png",
    "url": "https://cdn.imos.app/exports/map_123_2025-06-20.png"
  },
  "signature": "t=...;v1=..."
}`}
                    </Code>

                    <h2 id="errors" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">
                        Lỗi & giới hạn
                    </h2>
                    <ul>
                        <li>Mã lỗi HTTP tiêu chuẩn kèm JSON body.</li>
                        <li>
                            Giới hạn mặc định: <code>120 req/min</code> cho mỗi API key (liên hệ để nâng hạn mức).
                        </li>
                        <li>
                            Dùng header <code>Retry-After</code> và backoff luỹ thừa khi gặp <code>429</code>.
                        </li>
                    </ul>
                    <Code lang="json" filename="error.json">
                        {`{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Try again later."
  }
}`}
                    </Code>
                </article>
            </div>
        </main>
    );
}
