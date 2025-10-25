"use client";

import { logout } from "@/lib/auth";

interface LogoutButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function LogoutButton({ className = "", children }: LogoutButtonProps) {
  const handleLogout = () => {
    logout();
  };

  return (
    <button
      onClick={handleLogout}
      className={`text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors ${className}`}
    >
      {children || "Logout"}
    </button>
  );
}
