"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

type Connector = { cat: string; items: string[] };
type SyncMode = [string, string];
type Reliability = [string, string];

export default function CloudSourcesClient({
  connectors,
  syncModes,
  reliability,
  security,
}: {
  connectors: Connector[];
  syncModes: SyncMode[];
  reliability: Reliability[];
  security: string[];
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
    return () => ctx.revert();
  }, []);

  const chips = (list: string[]) =>
    list.map((t) => (
      <span key={t} className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300" data-reveal-item>
        {t}
      </span>
    ));

  return (
    <>
      <header className="mb-12 grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
        <div className="lg:col-span-3" data-reveal>
          <div
            data-reveal
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-white/10 bg-white/5 text-emerald-300"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connect once — map everywhere
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-white" data-reveal>Cloud Sources</h1>
          <p className="mt-2 max-w-2xl text-zinc-400" data-reveal>
            Kết nối PostGIS, GeoServer, S3/MinIO, Google Drive, OGC/ArcGIS hoặc nguồn HTTPS. Chọn live proxy, cron sync, hay webhook — tất cả đều có CDN cache, giám sát, và bảo mật mặc định.
          </p>
          <div className="mt-5 flex gap-3" data-reveal>
            <a href="/register" className="rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-white hover:bg-emerald-400">
              Connect a source
            </a>
            <a href="/resources/developer-docs" className="rounded-lg ring-1 ring-white/10 px-5 py-2.5 font-semibold hover:bg-white/5">
              Read developer docs
            </a>
          </div>
        </div>
        <div className="lg:col-span-2 rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30">
              <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20Zm-1 14l-4-4 1.4-1.4L11 12.2l5.6-5.6L18 8l-7 8z" />
              </svg>
            </span>
            <div>
              <div className="font-semibold text-white">Sample connection</div>
              <p className="text-sm text-zinc-400">PostGIS → Vector tiles → Styled map</p>
            </div>
          </div>
          <pre className="mt-4 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">{`POST /api/sources/postgis
{
  "host": "db.example.com",
  "database": "city",
  "user": "readonly",
  "ssl": true,
  "schemas": ["public"],
  "rls": true
}`}</pre>
          <p className="mt-2 text-xs text-zinc-400">Tạo nguồn kết nối, map sẽ đọc qua vector tiles + cache. Chế độ RLS giữ nguyên quyền tại DB.</p>
        </div>
      </header>

      <section data-reveal>
        <h2 className="text-xl font-semibold text-white">Supported connectors</h2>
        <p className="mt-1 text-sm text-zinc-400">Các nhóm nguồn phổ biến, chọn là chạy.</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-reveal-stagger>
          {connectors.map((c) => (
            <div key={c.cat} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
              <div className="mb-2 font-semibold text-white">{c.cat}</div>
              <div className="flex flex-wrap gap-2" data-reveal-stagger>{chips(c.items)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12" data-reveal>
        <h2 className="text-xl font-semibold text-white">Sync modes</h2>
        <p className="mt-1 text-sm text-zinc-400">Chọn chiến lược phù hợp với tải và ngân sách của bạn.</p>
        <ol className="relative mt-6 border-l border-white/10" data-reveal-stagger>
          {syncModes.map(([t, d], i) => (
            <li key={t} className="ml-4 mb-8" data-reveal-item>
              <div className="absolute -left-2.5 mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
                <div className="font-semibold text-white">{i + 1}. {t}</div>
                <p className="mt-1 text-sm text-zinc-400">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5" data-reveal-stagger>
        <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
          <h3 className="font-semibold text-white">Reliability</h3>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            {reliability.map(([t, d]) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <div>
                  <div className="font-medium text-white">{t}</div>
                  <div className="text-zinc-400">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
          <h3 className="font-semibold text-white">Security</h3>
          <p className="mt-1 text-sm text-zinc-400">Bảo mật đầu/cuối, khoá bí mật, và kiểm toán đầy đủ.</p>
          <div className="mt-3 flex flex-wrap gap-2" data-reveal-stagger>
            {security.map((s) => (
              <span key={s} className="rounded-full bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10 text-zinc-300" data-reveal-item>
                {s}
              </span>
            ))}
          </div>
          <pre className="mt-4 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">{`# S3 signed URL (Node)
const url = s3.getSignedUrl("getObject", {
  Bucket: "maps-bucket",
  Key: "tiles/city/{z}/{x}/{y}.pbf",
  Expires: 300
});`}</pre>
        </div>
      </section>

      <section className="mt-12" data-reveal>
        <h2 className="text-xl font-semibold text-white">Cost & performance</h2>
        <p className="mt-1 text-sm text-zinc-400">Tối ưu truy cập bằng cache đa tầng, gom request, và generalization theo zoom.</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5" data-reveal-stagger>
          {[
            ["Median tile latency", "≤ 120 ms", "from global PoPs"],
            ["Cache hit ratio", "85–97%", "depending on churn"],
            ["Data egress saved", "60–90%", "vs. direct origin"],
          ].map(([k, v, s]) => (
            <div key={k} className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
              <div className="text-sm text-zinc-400">{k}</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{v}</div>
              <div className="text-xs text-zinc-500">{s}</div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-5" data-reveal-stagger>
        <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
          <h3 className="font-semibold text-white">Query PostGIS lazily</h3>
          <p className="mt-1 text-sm text-zinc-400">Chỉ đọc phần hiển thị và tự sinh vector-tiles.</p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">{`SELECT id, name, geom
FROM roads
WHERE class IN ('primary','secondary')
AND   ST_Intersects(geom, :viewport_bbox)`}</pre>
        </div>
        <div className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-5" data-reveal-item>
          <h3 className="font-semibold text-white">Mirror from Drive</h3>
          <p className="mt-1 text-sm text-zinc-400">Đồng bộ CSV/GeoJSON từ Google Drive làm lớp dữ liệu.</p>
          <pre className="mt-3 rounded-lg bg-black/60 p-4 text-[12px] leading-5 ring-1 ring-white/10 text-zinc-200">{`POST /api/sync-jobs
{
  "type": "google-drive",
  "fileId": "1AbCdEf...",
  "targetLayer": "schools",
  "schedule": "0 * * * *"
}`}</pre>
        </div>
      </section>

      <section className="mt-12" data-reveal>
        <div className="rounded-3xl p-6 md:p-8 ring-1 ring-white/10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-center">
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight">Bring your own data. Effortlessly.</h3>
          <p className="mt-1 opacity-90">PostGIS • GeoServer • S3 • Google Drive • OGC • ArcGIS</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <a href="/register" className="rounded-lg bg-white text-emerald-700 px-5 py-2.5 font-semibold hover:bg-gray-100">Start free</a>
            <a href="/pricing" className="rounded-lg ring-1 ring-white/60 px-5 py-2.5 font-semibold hover:bg-white/10">View pricing</a>
          </div>
        </div>
      </section>
    </>
  );
}
