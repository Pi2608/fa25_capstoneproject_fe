"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAdminNotificationHub, type AdminNotification } from "@/lib/hubs/admin-notifications";
import { BellIcon, CheckCheck } from "lucide-react";

interface NotificationDropdownProps {
  isDark: boolean;
}

export default function NotificationDropdown({ isDark }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { isConnected } = useAdminNotificationHub({
    onNotification: (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    },
  }, { enabled: true });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: AdminNotification) => {
    const notificationId = notification.ticketId || notification.reportId || notification.submissionId || "";
    const uniqueKey = `${notification.type}-${notificationId}-${notification.createdAt}`;
    
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) => prev.filter((n) => {
      const nId = n.ticketId || n.reportId || n.submissionId || "";
      const nKey = `${n.type}-${nId}-${n.createdAt}`;
      return nKey !== uniqueKey;
    }));
    
    if (notification.type === "support_ticket" && notification.ticketId) {
      router.push(`/support-tickets/${notification.ticketId}`);
    } else if (notification.type === "map_report" && notification.reportId) {
      router.push(`/map-reports`);
    } else if (notification.type === "gallery_submission" && notification.submissionId) {
      router.push(`/map-gallery-admin`);
    }
    
    setIsOpen(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "support_ticket":
        return "🎫";
      case "map_report":
        return "⚠️";
      case "gallery_submission":
        return "📷";
      default:
        return "🔔";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors relative ${isDark
          ? "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
          }`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Thông báo"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full text-xs flex items-center justify-center font-bold ${isDark ? "bg-red-500 text-white" : "bg-red-500 text-white"} shadow-lg animate-pulse`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div 
          className={`fixed top-14 w-96 rounded-xl shadow-2xl border z-50 animate-in slide-in-from-top-2 fade-in duration-200 ${isDark
            ? "bg-zinc-900 border-zinc-700/50"
            : "bg-white border-gray-200/50"
            }`} 
          style={{ right: '16px' }}
        >
          <div className={`p-5 border-b ${isDark ? "border-zinc-800/50" : "border-gray-200/50"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-lg ${isDark ? "text-zinc-100" : "text-gray-900"}`}>
                  Thông báo
                </h3>
                {unreadCount > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isDark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"}`}>
                    {unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    setUnreadCount(0);
                    setNotifications([]);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${isDark 
                    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

            <div className={`max-h-[500px] overflow-y-auto ${isDark ? "scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900" : "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"}`}>
              {notifications.length === 0 ? (
                <div className={`p-12 text-center ${isDark ? "text-zinc-400" : "text-gray-500"}`}>
                  <BellIcon className={`w-12 h-12 mx-auto mb-3 ${isDark ? "text-zinc-600" : "text-gray-300"}`} />
                  <p className="text-sm font-medium">Không có thông báo</p>
                  <p className="text-xs mt-1">Thông báo mới sẽ xuất hiện ở đây</p>
                </div>
              ) : (
                <div className={`divide-y ${isDark ? "divide-zinc-800/50" : "divide-gray-200/50"}`}>
                  {notifications.map((notification) => {
                    const notificationId = notification.ticketId || notification.reportId || notification.submissionId || "";
                    const uniqueKey = `${notification.type}-${notificationId}-${notification.createdAt}`;
                    const isNewest = notifications.length > 0 && notification.createdAt === notifications[0].createdAt;
                    
                    return (
                      <button
                        key={uniqueKey}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left p-4 transition-all duration-150 group ${isDark
                          ? "hover:bg-zinc-800/50 active:bg-zinc-800"
                          : "hover:bg-gray-50 active:bg-gray-100"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isDark
                            ? notification.type === "support_ticket" ? "bg-blue-500/20" 
                              : notification.type === "map_report" ? "bg-orange-500/20"
                              : "bg-purple-500/20"
                            : notification.type === "support_ticket" ? "bg-blue-100" 
                              : notification.type === "map_report" ? "bg-orange-100"
                              : "bg-purple-100"
                          }`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold mb-1.5 text-sm transition-colors ${isDark ? "text-zinc-100 group-hover:text-white" : "text-gray-900 group-hover:text-gray-950"}`}>
                              {notification.title}
                            </p>
                            <p className={`text-sm mb-2 line-clamp-2 leading-relaxed ${isDark ? "text-zinc-400" : "text-gray-600"}`}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className={`text-xs ${isDark ? "text-zinc-500" : "text-gray-400"}`}>
                                {formatTime(notification.createdAt)}
                              </p>
                              {isNewest && unreadCount > 0 && (
                                <span className={`w-2 h-2 rounded-full ${isDark ? "bg-blue-500" : "bg-blue-600"}`} />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
}

