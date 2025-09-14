"use client";

import { useEffect, useRef, useState } from "react";
import { searchFaqs, getFaqSuggestions, type FaqItem } from "@/lib/api";
import Link from "next/link";

export default function HelpCenterClient() {
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FaqItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounced = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getFaqSuggestions(8).then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    if (!touched) return;
    setLoading(true);
    searchFaqs(debounced).then(setResults).finally(() => setLoading(false));
  }, [debounced, touched]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="relative mx-auto max-w-7xl px-4 md:px-6 py-6 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_0%,rgba(16,185,129,0.12),transparent),radial-gradient(900px_400px_at_80%_0%,rgba(16,185,129,0.08),transparent)]" />
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-3">
          <nav className="sticky top-20 space-y-6">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400 mb-2">GETTING STARTED</div>
              <ul className="space-y-1">
                <li><a href="#welcome" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Welcome</a></li>
                <li><a href="#what-is" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">What is CustomMapOSM?</a></li>
                <li><a href="#create-map" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Create your first map</a></li>
                <li><a href="#tour-interface" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Tour the interface</a></li>
                <li><a href="#workspace" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Your workspace</a></li>
                <li><a href="#shortcuts" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Keyboard shortcuts</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-400 mb-2">UPLOAD ANYTHING</div>
              <ul className="space-y-1">
                <li><a href="#files" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Files</a></li>
                <li><a href="#urls" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">URLs</a></li>
                <li><a href="#sheets" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Spreadsheets</a></li>
                <li><a href="#raster" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Raster & imagery</a></li>
                <li><a href="#cloud" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Cloud sources</a></li>
                <li><a href="#sql" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">SQL queries</a></li>
                <li><a href="#refresh" className="block rounded-md px-3 py-2 text-sm hover:bg-white/5 hover:text-white text-zinc-300">Refreshing data</a></li>
              </ul>
            </div>
          </nav>
        </aside>

        <section className="col-span-12 md:col-span-6 lg:col-span-6">
          <div className="mb-5">
            <div className="relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setTouched(true); }}
                placeholder="Ask or search…   Ctrl + K"
                className="w-full rounded-xl bg-zinc-900/70 ring-1 ring-white/10 px-4 py-3 pr-24 text-zinc-100 placeholder-zinc-500 outline-none focus:ring-emerald-400/50"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400">Ctrl K</span>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); setTouched(true); }}
                    className="rounded-full bg-white/5 hover:bg-white/10 text-sm px-3 py-1.5 ring-1 ring-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {touched ? (
            <div className="space-y-3">
              {loading && <div className="h-16 animate-pulse rounded-xl bg-white/5 ring-1 ring-white/10" />}
              {!loading && results.length === 0 && <p className="text-zinc-400">Không có kết quả. Thử từ khóa khác.</p>}
              {results.map((item) => (
                <details key={item.faqId} className="group rounded-xl ring-1 ring-white/10 bg-white/5 px-5 py-4 open:bg-white/10">
                  <summary className="cursor-pointer list-none select-none">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400"><path fill="currentColor" d="M11 7h2v6h-2zm0 8h2v2h-2z"/></svg>
                      </span>
                      <h3 className="text-base font-semibold text-white">{item.question}</h3>
                    </div>
                  </summary>
                  <div className="mt-3 pl-9 text-sm leading-6 text-zinc-300">
                    <div className="mb-2">
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide ring-1 ring-white/10">{item.category}</span>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: item.answer ?? "" }} />
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <article className="prose prose-invert max-w-none">
              <h1 id="welcome" className="scroll-mt-24">Welcome</h1>
              <p>Find guides, best practices, and tips to maximize your CustomMapOSM experience.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose mt-6">
                <a href="#what-is" className="rounded-xl ring-1 ring-white/10 bg-white/5 hover:bg-white/10 p-4">
                  <div className="font-semibold">What is CustomMapOSM?</div>
                  <p className="text-sm text-zinc-400 mt-1">Start here to learn the basics.</p>
                </a>
                <a href="#create-map" className="rounded-xl ring-1 ring-white/10 bg-white/5 hover:bg-white/10 p-4">
                  <div className="font-semibold">Create your first map</div>
                  <p className="text-sm text-zinc-400 mt-1">Uploading data, styling layers, collaborating.</p>
                </a>
                <a href="#tour-interface" className="rounded-xl ring-1 ring-white/10 bg-white/5 hover:bg-white/10 p-4">
                  <div className="font-semibold">Tour the interface</div>
                  <p className="text-sm text-zinc-400 mt-1">Key panels and tools you’ll use.</p>
                </a>
              </div>
              <h2 id="what-is" className="mt-10 scroll-mt-24">What is CustomMapOSM?</h2>
              <p>CustomMapOSM là nền tảng tạo bản đồ web nhanh, kết nối dữ liệu linh hoạt và dễ chia sẻ.</p>
              <h2 id="create-map" className="mt-10 scroll-mt-24">Create your first map</h2>
              <ol>
                <li>Chọn mẫu hoặc trang trắng.</li>
                <li>Tải GeoJSON/CSV/shapefile hoặc kết nối PostGIS.</li>
                <li>Tùy chỉnh style lớp, thêm chú giải, xuất/nhúng.</li>
              </ol>
              <h2 id="tour-interface" className="mt-10 scroll-mt-24">Tour the interface</h2>
              <p>Thanh công cụ, bảng layer, bảng thuộc tính, và khu vực xem bản đồ.</p>
              <h2 id="workspace" className="mt-10 scroll-mt-24">Your workspace</h2>
              <p>Quản lý dự án, thành viên và quyền truy cập.</p>
              <h2 id="shortcuts" className="mt-10 scroll-mt-24">Keyboard shortcuts</h2>
              <ul>
                <li><kbd>Ctrl</kbd> + <kbd>K</kbd>: Mở tìm kiếm</li>
                <li><kbd>?</kbd>: Trợ giúp nhanh</li>
              </ul>
              <h2 id="files" className="mt-10 scroll-mt-24">Files</h2>
              <p>Hỗ trợ GeoJSON, CSV, Shapefile (zip), TIFF…</p>
              <h2 id="urls" className="mt-10 scroll-mt-24">URLs</h2>
              <p>Nhúng tile/services: XYZ, WMS, WMTS…</p>
              <h2 id="sheets" className="mt-10 scroll-mt-24">Spreadsheets</h2>
              <p>Kết nối Google Sheets để đồng bộ dữ liệu.</p>
              <h2 id="raster" className="mt-10 scroll-mt-24">Raster & imagery</h2>
              <p>Hiển thị ảnh vệ tinh, DEM, hillshade.</p>
              <h2 id="cloud" className="mt-10 scroll-mt-24">Cloud sources</h2>
              <p>PostGIS, GeoServer, S3, Google Drive…</p>
              <h2 id="sql" className="mt-10 scroll-mt-24">SQL queries</h2>
              <p>Truy vấn lớp PostGIS để lọc/ghép dữ liệu.</p>
              <h2 id="refresh" className="mt-10 scroll-mt-24">Refreshing data</h2>
              <p>Lên lịch đồng bộ định kỳ cho nguồn dữ liệu.</p>
            </article>
          )}
        </section>

        <aside className="col-span-12 md:col-span-3 lg:col-span-3">
          <div className="sticky top-20 space-y-6">
            <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold mb-2">Getting started</div>
              <ul className="space-y-1 text-sm">
                <li><a href="#what-is" className="text-emerald-400 hover:underline">Discover CustomMapOSM</a></li>
                <li><a href="#create-map" className="hover:underline">Create your first map</a></li>
                <li><a href="#tour-interface" className="hover:underline">More resources</a></li>
              </ul>
            </div>
            <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold mb-3">Was this helpful?</div>
              <div className="flex gap-2">
                <button className="rounded-lg px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm">🙂 Yes</button>
                <button className="rounded-lg px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm">😐 Neutral</button>
                <button className="rounded-lg px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm">🙁 No</button>
              </div>
            </div>
            <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold mb-2">Quick links</div>
              <ul className="space-y-1 text-sm">
                <li><Link href="/resources/developer-docs" className="hover:underline">Developer Docs</Link></li>
                <li><Link href="/resources/map-gallery" className="hover:underline">Map Gallery</Link></li>
                <li><Link href="/pricing" className="hover:underline">Pricing</Link></li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function useDebounce<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
