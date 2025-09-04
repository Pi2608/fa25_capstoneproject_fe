"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStatus } from "@/contexts/useAuthStatus";
import { useMemo, useState, useEffect, useRef } from "react";

export default function HomePage() {
  const router = useRouter();
  const { isLoggedIn, clear } = useAuthStatus();

  const onLogout = () => {
    clear();
    router.push("/login");
    router.refresh();
  };

  const NAV = [
    { label: "Dịch vụ", href: "/service" },
    { label: "Hướng dẫn", href: "/tutorial" },
    { label: "Mẫu", href: "/templates" },
    { label: "Bảng giá", href: "/pricing" },
    { label: "Cộng đồng", href: "/community" },
  ] as const;

  const DICH_VU: { label: string; desc: string; href: string }[] = [
    {
      label: "Trình tạo bản đồ",
      desc: "Tạo bản đồ web tương tác nhanh, không cần cài đặt.",
      href: "/service/map-builder",
    },
    {
      label: "Lớp dữ liệu",
      desc: "Quản lý lớp vector & raster, style linh hoạt.",
      href: "/service/data-layers",
    },
    {
      label: "Nguồn đám mây",
      desc: "Kết nối PostGIS, GeoServer, S3, Google Drive…",
      href: "/service/cloud-sources",
    },
    {
      label: "Bảng điều khiển",
      desc: "Ghép bản đồ với biểu đồ & số liệu thành dashboard.",
      href: "/service/dashboards",
    },
    {
      label: "Cộng tác",
      desc: "Chia sẻ & chỉnh sửa nhóm theo thời gian thực.",
      href: "/service/collaboration",
    },
    {
      label: "Xuất & Nhúng",
      desc: "Xuất PNG/PDF, nhúng vào website hoặc ứng dụng.",
      href: "/service/export-embed",
    },
  ];

  const CATEGORIES = [
    "Địa lý không gian",
    "Quy hoạch",
    "Báo cáo",
    "Giáo dục",
    "Kỹ thuật",
    "Nghiên cứu",
    "Vận hành",
    "Thực địa",
  ] as const;

  const categoryLinks = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        label: c,
        href: `/danh-muc/${c.toLowerCase().replace(/\s+/g, "-")}`,
      })),
    []
  );

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <main className="relative min-h-screen text-white">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/bg.avif"
          alt="Nền bản đồ"
          fill
          priority
          unoptimized
          quality={100}
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <header className="sticky top-0 z-40">
        <div className="pointer-events-none absolute inset-x-0 -z-10 h-20 bg-gradient-to-b from-black/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-400 shadow" />
            <span className="text-lg md:text-xl font-bold tracking-tight text-white">
              CustomMapOSM
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="mega-menu"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition"
              >
                Dịch vụ
                <svg
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                >
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
                </svg>
              </button>

              {open && (
                <div
                  id="mega-menu"
                  role="menu"
                  tabIndex={-1}
                  className="absolute left-1/2 -translate-x-1/2 mt-4 w-[640px] max-w-[90vw] rounded-2xl bg-zinc-900/90 backdrop-blur-md ring-1 ring-white/10 shadow-2xl p-4 md:p-5"
                  onMouseEnter={() => setOpen(true)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {DICH_VU.map((it) => (
                      <Link
                        key={it.label}
                        href={it.href}
                        className="group flex items-start gap-3 rounded-xl p-3 md:p-4 hover:bg-white/10 focus:bg-white/10 outline-none transition"
                      >
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-400">
                            <path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20Zm1 5v5l4 2-.7 1.2L11 13V7h2Z" />
                          </svg>
                        </span>
                        <div className="leading-tight">
                          <div className="text-[15px] md:text-[16px] font-semibold text-white group-hover:text-emerald-400">{it.label}</div>
                          <p className="text-sm text-white/70 mt-1">{it.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-white/10 pt-3 flex justify-end">
                    <Link href="/service" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300" onClick={() => setOpen(false)}>
                      Xem thêm →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {NAV.slice(1).map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="text-white/90 text-base md:text-lg font-semibold hover:text-emerald-400 transition"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {!isLoggedIn ? (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-base font-semibold text-white/90 hover:text-white">Đăng nhập</Link>
                <Link href="/register" className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold text-zinc-950 shadow hover:bg-emerald-400 transition">Bắt đầu</Link>
              </>
            ) : (
              <>
                <Link href="/profile" className="rounded-lg bg-emerald-500 px-4 py-2 text-base font-bold text-zinc-950 shadow hover:bg-emerald-400 transition">Hồ sơ</Link>
                <button onClick={onLogout} className="rounded-lg px-3 py-2 text-base font-semibold text-white/90 hover:text-red-400">Đăng xuất</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO giữa trang */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <section className="min-h-[60vh] md:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">
            Tạo bản đồ. Tuỳ chỉnh dễ dàng.
          </h1>
          <p className="text-lg text-gray-200 max-w-xl leading-relaxed">
            Xây dựng bản đồ tương tác, chất lượng cao trong vài phút — phù hợp cho lập kế hoạch, báo cáo và khám phá.
          </p>
          <Link
            href="/service"
            className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors"
          >
            Bắt đầu ngay
          </Link>
        </section>
      </div>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 space-y-24 text-white">
        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold">Mẫu nổi bật</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Chọn từ nhiều mẫu bản đồ sẵn sàng sử dụng cho các lĩnh vực khác nhau.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
            <Link href="/templates/urban-planning" className="bg-white/10 rounded-xl p-6 h-40 hover:bg-white/20 transition flex items-center justify-center font-bold text-lg">
              Quy hoạch đô thị
            </Link>
            <Link href="/templates/field-survey" className="bg-white/10 rounded-xl p-6 h-40 hover:bg-white/20 transition flex items-center justify-center font-bold text-lg">
              Khảo sát thực địa
            </Link>
            <Link href="/templates/research-report" className="bg-white/10 rounded-xl p-6 h-40 hover:bg-white/20 transition flex items-center justify-center font-bold text-lg">
              Báo cáo nghiên cứu
            </Link>
          </div>
        </div>

        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold">Cách hoạt động</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Chỉ với 3 bước để có bản đồ hoàn chỉnh.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-6">
            <div className="bg-white/10 rounded-xl p-6 hover:bg-white/20 transition">
              <h4 className="font-semibold mb-2">1. Chọn mẫu</h4>
              <p className="text-sm text-gray-300">Bắt đầu từ mẫu có sẵn hoặc một trang trắng.</p>
            </div>
            <div className="bg-white/10 rounded-xl p-6 hover:bg-white/20 transition">
              <h4 className="font-semibold mb-2">2. Tuỳ chỉnh bản đồ</h4>
              <p className="text-sm text-gray-300">Thêm dữ liệu, điểm đánh dấu, lớp và cá nhân hoá giao diện.</p>
            </div>
            <div className="bg-white/10 rounded-xl p-6 hover:bg-white/20 transition">
              <h4 className="font-semibold mb-2">3. Xuất & chia sẻ</h4>
              <p className="text-sm text-gray-300">Tải xuống hoặc nhúng bản đồ để dùng ở bất cứ đâu.</p>
            </div>
          </div>
        </div>

        <div className="text-center space-y-6">
          <h2 className="text-3xl font-bold">Được tin dùng bởi chuyên gia</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Được sử dụng bởi các đội ngũ kỹ sư, giáo dục, NGO và chính phủ.
          </p>
        </div>
      </section>
    </main>
  );
}
