"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useI18n } from "@/i18n/I18nProvider";

gsap.registerPlugin(ScrollTrigger);

function Code({
    children,
    filename,
    lang = "bash",
    copyLabel,
    copiedLabel,
}: {
    children: string;
    filename?: string;
    lang?: string;
    copyLabel: string;
    copiedLabel: string;
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
                aria-label={copyLabel}
            >
                {copied ? copiedLabel : copyLabel}
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
        <div className="dd-card rounded-2xl p-5 ring-1 ring-white/10 bg-white/5">
            <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
                    {icon ?? (
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400" aria-hidden>
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
    const { t } = useI18n();
    const tr = (k: string) => t("devdocs", k);

    const sections = [
        { id: "quickstart", label: tr("nav_quickstart") },
        { id: "auth", label: tr("nav_auth") },
        { id: "rest", label: tr("nav_rest") },
        { id: "sdks", label: tr("nav_sdks") },
        { id: "webhooks", label: tr("nav_webhooks") },
        { id: "errors", label: tr("nav_errors") },
    ] as const;

    const [active, setActive] = useState<string>("quickstart");
    const headingsRef = useRef<Record<string, HTMLElement | null>>({});

    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => (a.boundingClientRect.top > b.boundingClientRect.top ? 1 : -1));
                if (visible[0]?.target.id) setActive(visible[0].target.id);
            },
            { rootMargin: "0px 0px -70% 0px", threshold: [0, 1] }
        );
        sections.forEach((s) => {
            const el = document.getElementById(s.id);
            headingsRef.current[s.id] = el;
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);

    const reduce =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    useLayoutEffect(() => {
        const baseIn = { ease: "power2.out", duration: reduce ? 0 : 0.7 } as const;
        const ctx = gsap.context(() => {
            gsap.set([".dd-hero-eyebrow", ".dd-hero-title", ".dd-hero-sub", ".dd-hero-cta"], {
                autoAlpha: 0,
                y: 18,
            });
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
                onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, stagger: 0.06, ...baseIn }),
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
                    {tr("hero_eyebrow")}
                </div>
                <h1 className="dd-hero-title text-3xl md:text-4xl font-semibold">{tr("hero_title")}</h1>
                <p className="dd-hero-sub mt-2 max-w-2xl text-zinc-400">{tr("hero_sub")}</p>
                <div className="dd-hero-cta mt-4 flex flex-wrap gap-3">
                    <Link
                        href="/profile"
                        className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-400"
                    >
                        {tr("cta_get_key")}
                    </Link>
                    <a href="#quickstart" className="rounded-lg px-4 py-2 ring-1 ring-white/15 hover:bg-white/10">
                        {tr("cta_quickstart")}
                    </a>
                    <a href="#sdks" className="rounded-lg px-4 py-2 ring-1 ring-white/15 hover:bg-white/10">
                        {tr("cta_sdks")}
                    </a>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-6">
                <aside className="col-span-12 md:col-span-3">
                    <nav className="sticky top-20 space-y-2 text-sm">
                        {sections.map((s) => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className={[
                                    "block rounded-md px-3 py-2 hover:bg-white/5 hover:text-white",
                                    active === s.id ? "bg-white/10 text-white" : "text-zinc-300",
                                ].join(" ")}
                                aria-current={active === s.id ? "page" : undefined}
                            >
                                {s.label}
                            </a>
                        ))}
                    </nav>
                </aside>

                <article className="dd-section prose prose-invert col-span-12 md:col-span-9 max-w-none">
                    <h2 id="quickstart" className="scroll-mt-24 opacity-0 translate-y-[12px]">{tr("h_quickstart")}</h2>
                    <p className="lead">{tr("lead_quickstart")}</p>

                    <div className="not-prose grid grid-cols-1 lg:grid-cols-3 gap-4 my-4">
                        <Card title={tr("step1_title")}>
                            <p>{tr("step1_desc")}</p>
                            <Code
                                lang="bash"
                                filename="Terminal"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`npm i @imos/sdk
pnpm add @imos/sdk
yarn add @imos/sdk`}</Code>
                        </Card>

                        <Card title={tr("step2_title")}>
                            <p>
                                {tr("step2_desc_1")}{" "}
                                <Link className="text-emerald-400" href="/profile">
                                    {tr("profile_api")}
                                </Link>{" "}
                                {tr("step2_desc_2")}
                            </p>
                        </Card>

                        <Card title={tr("step3_title")}>
                            <p>{tr("step3_desc")}</p>
                            <Code
                                lang="bash"
                                filename="curl"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`curl -X POST https://api.imos.app/v1/maps \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Field Survey 2025", "visibility": "private" }'`}</Code>
                        </Card>
                    </div>

                    <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-4 my-4">
                        <Card title={tr("example_sdk_title")}>
                            <Code
                                lang="ts"
                                filename="example.ts"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`import { Imos } from "@imos/sdk";

const imos = new Imos({ apiKey: process.env.IMOS_API_KEY! });

const map = await imos.maps.create({ name: "Urban Audit", visibility: "private" });

await imos.layers.create(map.id, {
  type: "Point",
  data: [{ geometry: [106.7, 10.8], properties: { label: "Site A" } }],
  style: { color: "#10b981", size: 10 }
});

const file = await imos.exports.png(map.id, { width: 1920, height: 1080 });`}</Code>
                        </Card>

                        <Card title={tr("example_fetch_title")}>
                            <Code
                                lang="ts"
                                filename="fetch.ts"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`const res = await fetch("https://api.imos.app/v1/maps", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + process.env.IMOS_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ name: "My Map", visibility: "public" })
});

const json = await res.json();`}</Code>
                        </Card>
                    </div>

                    <h2 id="auth" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">{tr("h_auth")}</h2>
                    <p>{tr("p_auth")}</p>

                    <h2 id="rest" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">{tr("h_rest")}</h2>
                    <ul>
                        <li><code>POST /v1/maps</code> — {tr("rest_create_map")}</li>
                        <li><code>POST /v1/maps/:mapId/layers</code> — {tr("rest_add_layer")}</li>
                        <li><code>GET /v1/maps/:mapId/export.png</code> — {tr("rest_export_png")}</li>
                        <li><code>GET /v1/maps/:mapId/export.pdf</code> — {tr("rest_export_pdf")}</li>
                        <li><code>GET /v1/query</code> — {tr("rest_query")}</li>
                    </ul>

                    <div className="not-prose grid grid-cols-1 lg:grid-cols-2 gap-4 my-4">
                        <Card title={tr("rest_geojson_title")}>
                            <Code
                                lang="bash"
                                filename="curl"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`curl -X POST https://api.imos.app/v1/maps/123/layers \
  -H "Authorization: Bearer $IMOS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ 
        "type":"Polygon",
        "data":[{"geometry":[[[106.7,10.8],[106.71,10.8],[106.71,10.82],[106.7,10.82],[106.7,10.8]]],
                 "properties":{"zone":"A"}}],
        "style":{"stroke":"#22c55e","fill":"#22c55e22","width":2}
      }'`}</Code>
                        </Card>
                        <Card title={tr("rest_spatial_query_title")}>
                            <Code
                                lang="bash"
                                filename="curl"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`curl "https://api.imos.app/v1/query?sql=SELECT%20count(*)%20FROM%20sites%20WHERE%20ST_Intersects(geom,%20ST_GeomFromText('POLYGON((...))',4326))" \
  -H "Authorization: Bearer $IMOS_KEY"`}</Code>
                        </Card>
                    </div>

                    <h2 id="sdks" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">{tr("h_sdks")}</h2>
                    <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card title="JavaScript / TypeScript">
                            <p className="mb-2">{tr("sdk_js_desc")}</p>
                            <Code
                                lang="bash"
                                filename="Install"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`npm i @imos/sdk
# import { Imos } from "@imos/sdk"`}</Code>
                        </Card>
                        <Card title={tr("sdk_py_title")}>
                            <p className="mb-2">{tr("sdk_py_desc")}</p>
                            <Code
                                lang="bash"
                                filename="Install"
                                copyLabel={tr("copy")}
                                copiedLabel={tr("copied")}
                            >{`pip install imos-sdk`}</Code>
                        </Card>
                        <Card title="QGIS Plugin">
                            <p className="mb-2">{tr("sdk_qgis_desc")}</p>
                            <Link href="/resources/qgis-plugin" className="text-emerald-400">
                                {tr("view_guide")} →
                            </Link>
                        </Card>
                    </div>

                    <h2 id="webhooks" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">{tr("h_webhooks")}</h2>
                    <p>{tr("p_webhooks")}</p>
                    <div className="dd-code my-3">
                        <Code
                            lang="json"
                            filename="payload.json"
                            copyLabel={tr("copy")}
                            copiedLabel={tr("copied")}
                        >{`{
  "type": "export.completed",
  "timestamp": "2025-06-20T09:14:21Z",
  "data": {
    "mapId": "map_123",
    "format": "png",
    "url": "https://cdn.imos.app/exports/map_123_2025-06-20.png"
  },
  "signature": "t=...;v1=..."
}`}</Code>
                    </div>

                    <h2 id="errors" className="mt-12 scroll-mt-24 opacity-0 translate-y-[12px]">{tr("h_errors")}</h2>
                    <ul>
                        <li>{tr("err_item_http")}</li>
                        <li>{tr("err_item_limits")}</li>
                        <li>{tr("err_item_retry")}</li>
                    </ul>
                    <div className="dd-code my-3">
                        <Code
                            lang="json"
                            filename="error.json"
                            copyLabel={tr("copy")}
                            copiedLabel={tr("copied")}
                        >{`{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests. Try again later."
  }
}`}</Code>
                    </div>
                </article>
            </div>
        </main>
    );
}
