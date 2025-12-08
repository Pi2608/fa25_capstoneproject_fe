"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext } from "react";
import { clearAllAuthData } from "@/utils/authUtils";
import { getMe, type Me } from "@/lib/api-auth";
import Loading from "@/app/loading";

const ThemeContext = createContext<{
  isDark: boolean;
  toggleTheme: () => void;
}>({
  isDark: true,
  toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

const NAV = [
  { href: "/dashboard", label: "Tổng quan", icon: <DashIcon /> },
  { href: "/analytics", label: "Phân tích", icon: <ChartIcon /> },
  { href: "/users", label: "Tài khoản", icon: <UsersIcon /> },
  { href: "/organizations", label: "Tổ chức", icon: <OrgIcon /> },
  { href: "/subscription-plans", label: "Gói đăng ký", icon: <PlanIcon /> },
  { href: "/support-tickets", label: "Phiếu hỗ trợ", icon: <TicketIcon /> },
  { href: "/community-admin", label: "Cộng đồng", icon: <FileIcon /> },
  { href: "/map-gallery-admin", label: "Map gallery", icon: <MapIcon /> },
  { href: "/exports", label: "Xuất dữ liệu", icon: <FileIcon /> },
  // { href: "/billing", label: "Lịch sử thanh toán", icon: <CardIcon /> },
  // { href: "/template", label: "Mẫu bản đồ", icon: <MapIcon /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "";
  const [open, setOpen] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const token = typeof window !== "undefined"
          ? (localStorage.getItem("token") || localStorage.getItem("accessToken"))
          : null;

        if (!token) {
          router.replace("/login");
          return;
        }

        const user = await getMe(true);

        const adminRoles = ["Admin", "admin", "Administrator", "administrator"];
        const hasAdminRole = adminRoles.includes(user.role);

        if (!hasAdminRole) {
          router.replace("/not-found");
          return;
        }
        setIsVerified(true);
      } catch (error) {
        console.error("Failed to check admin access:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem("admin-theme", newTheme ? "dark" : "light");
    // Dispatch custom event to notify LoadingContext
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin-theme-change"));
    }
  };


  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
      const token =
        (typeof window !== "undefined" && localStorage.getItem("token")) ||
        (typeof window !== "undefined" && localStorage.getItem("accessToken")) ||
        "";
      if (base) {
        try {
          await fetch(`${base}/api/v1/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
          });
        } catch { }
      }
    } finally {
      clearAllAuthData();
      router.replace("/login");
    }
  };

  if (loading) {
    return (
      <Loading />
    );
  }

  if (!isVerified) {
    return null;
  }

  return (
    <div className={`flex h-screen transition-colors ${isDark
      ? "bg-zinc-950 text-zinc-100"
      : "bg-gray-50 text-gray-900"
      }`}>
      <aside className={`flex flex-col transition-all duration-300 ${open ? "w-64" : "w-20"
        } ${isDark
          ? "bg-zinc-900 border-r border-zinc-800"
          : "bg-white border-r border-gray-200"
        }`}>
        <div className={`flex items-center gap-2 px-4 py-4 border-b ${isDark ? "border-zinc-800" : "border-gray-200"
          }`}>
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className={`font-bold text-lg whitespace-nowrap transition-opacity ${open ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
            }`}>IMOS</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${active
                  ? isDark
                    ? "bg-zinc-800 text-white"
                    : "bg-gray-100 text-gray-900"
                  : isDark
                    ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
                <span className={`whitespace-nowrap transition-opacity ${open ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  }`}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={`border-t p-2 space-y-1 ${isDark ? "border-zinc-800" : "border-gray-200"
          }`}>
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isDark
              ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            onClick={toggleTheme}
          >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {isDark ? <SunIcon /> : <MoonIcon />}
            </span>
            <span className={`whitespace-nowrap transition-opacity ${open ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}>{isDark ? "Sáng" : "Tối"}</span>
          </button>
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors disabled:opacity-50 ${isDark
              ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            onClick={() => router.push("/settings")}
          >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              <SettingsIcon />
            </span>
            <span className={`whitespace-nowrap transition-opacity ${open ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}>Cài đặt</span>
          </button>
          <button
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors disabled:opacity-50 ${isDark
              ? "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            onClick={onSignOut}
            disabled={signingOut}
            aria-busy={signingOut}
          >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              <SignOutIcon />
            </span>
            <span className={`whitespace-nowrap transition-opacity ${open ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              }`}>{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`h-14 border-b flex items-center gap-4 px-4 ${isDark
          ? "bg-zinc-900 border-zinc-800"
          : "bg-white border-gray-200"
          }`}>
          <button
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isDark
              ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Thu gọn/mở rộng menu"
          >
            <BurgerIcon />
          </button>
          <div className="flex-1 max-w-md">
            <input
              className={`w-full h-9 px-3 rounded-lg border outline-none focus:ring-1 ${isDark
                ? "border-zinc-800 bg-zinc-800/50 text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:ring-zinc-700"
                : "border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:ring-gray-400"
                }`}
              placeholder="Tìm kiếm…"
              aria-label="Tìm kiếm"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isDark
                ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                }`}
              aria-label="Thông báo"
            >
              <BellIcon />
            </button>
            <div className={`w-9 h-9 rounded-full border ${isDark
              ? "bg-zinc-700 border-zinc-600"
              : "bg-gray-300 border-gray-400"
              }`} />
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-5 ${isDark ? "bg-zinc-950" : "bg-gray-50"
          }`}>
          <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
          </ThemeContext.Provider>
        </div>
      </div>
    </div>
  );
}

function DashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="10" width="3" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="6" width="3" height="11" rx="1" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="13" width="3" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" />
      <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="2" />
      <path d="M16 3a4 4 0 0 1 0 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7Z" stroke="currentColor" strokeWidth="2" />
      <path d="M14 2v5h5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M2 9h20" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="13" width="6" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.04.05a2 2 0 1 1-2.83 2.83l-.05-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .33l-.05.03a2 2 0 0 1-3.9 0l-.05-.03a1.7 1.7 0 0 0-1-.33 1.7 1.7 0 0 0-1.87.34l-.05.04a2 2 0 1 1-2.83-2.83l.04-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.33-1l-.03-.05a2 2 0 0 1 0-3.9l.03-.05a1.7 1.7 0 0 0 .33-1A1.7 1.7 0 0 0 3.23 6l-.04-.05a2 2 0 1 1 2.83-2.83L6.07 3.1A1.7 1.7 0 0 0 7 3.43c.34 0 .68-.11 1-.33l.05-.03a2 2 0 0 1 3.9 0l.05.03c.32.22.66.33 1 .33.33 0 .67-.11 1-.33l.05-.03a2 2 0 1 1 2.78 2.88l-.04.05c-.22.32-.33.66-.33 1 0 .33.11.67.33 1l.04.05a2 2 0 0 1 0 3.9l-.04.05c-.22.32-.33.66-.33 1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" />
      <path d="M21 12H9" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" stroke="currentColor" strokeWidth="2" />
      <path d="M10 21a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 6l6-3 6 3 6-3v18l-6 3-6-3-6 3V6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 3v18M15 6v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function OrgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 21V7a2 2 0 0 1 2-2h4v16H3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 21h12V5a2 2 0 0 0-2-2h-6v18Z" stroke="currentColor" strokeWidth="2" />
      <path d="M7 9h2M7 13h2M7 17h2M15 7h2M15 11h2M15 15h2M15 19h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PlanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PostIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" stroke="currentColor" strokeWidth="2" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
