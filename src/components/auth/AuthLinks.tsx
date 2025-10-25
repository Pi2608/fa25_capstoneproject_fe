"use client";

import { AuthLinksProps } from "@/types/auth";

export default function AuthLinks({ links, className = "" }: AuthLinksProps) {
  return (
    <div className={`mt-6 text-center ${className}`}>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {links.map((link, index) => (
          <span key={link.href}>
            {index > 0 && " · "}
            <a 
              href={link.href} 
              className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
            >
              {link.text}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
