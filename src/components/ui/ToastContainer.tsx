"use client";

import { useToast } from "@/contexts/ToastContext";
import { useState, useEffect } from "react";

export default function ToastContainer() {
  const { toasts, hideToast } = useToast();
  const [visibleToasts, setVisibleToasts] = useState<Set<string>>(new Set());

  // Handle toast animations
  useEffect(() => {
    toasts.forEach(toast => {
      if (!visibleToasts.has(toast.id)) {
        setVisibleToasts(prev => new Set([...prev, toast.id]));
      }
    });
  }, [toasts, visibleToasts]);

  const getToastStyles = (type: string) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-green-50 dark:bg-green-900/20",
          border: "border-green-200 dark:border-green-800",
          icon: "text-green-500",
          accent: "border-l-4 border-green-500"
        };
      case "error":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-800",
          icon: "text-red-500",
          accent: "border-l-4 border-red-500"
        };
      case "warning":
        return {
          bg: "bg-yellow-50 dark:bg-yellow-900/20",
          border: "border-yellow-200 dark:border-yellow-800",
          icon: "text-yellow-500",
          accent: "border-l-4 border-yellow-500"
        };
      case "info":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          border: "border-blue-200 dark:border-blue-800",
          icon: "text-blue-500",
          accent: "border-l-4 border-blue-500"
        };
      default:
        return {
          bg: "bg-gray-50 dark:bg-gray-800",
          border: "border-gray-200 dark:border-gray-700",
          icon: "text-gray-500",
          accent: "border-l-4 border-gray-500"
        };
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case "error":
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case "warning":
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case "info":
        return (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[10000] space-y-3 max-w-sm w-full">
      {toasts.map((toast) => {
        const styles = getToastStyles(toast.type);
        const isVisible = visibleToasts.has(toast.id);
        
        return (
          <div
            key={toast.id}
            className={`
              transform transition-all duration-500 ease-out
              ${isVisible 
                ? 'translate-x-0 opacity-100 scale-100' 
                : 'translate-x-full opacity-0 scale-95'
              }
              ${styles.bg} ${styles.border} ${styles.accent}
              rounded-xl shadow-xl border backdrop-blur-sm
              hover:shadow-2xl transition-shadow duration-300
            `}
            style={{
              animation: isVisible 
                ? 'slideInRight 0.5s ease-out' 
                : 'slideOutRight 0.3s ease-in'
            }}
          >
            <div className="p-4">
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className={`flex-shrink-0 ${styles.icon}`}>
                  {getIcon(toast.type)}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
                    {toast.message}
                  </p>
                </div>
                
                {/* Close Button */}
                <button
                  onClick={() => hideToast(toast.id)}
                  className="flex-shrink-0 ml-2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
      
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
