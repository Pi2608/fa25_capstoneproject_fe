"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearAllAuthData } from "@/utils/authUtils";
import { useToast } from "@/contexts/ToastContext";

export default function AccountTypePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<"personal" | "organization" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) {
      showToast("error", "Please select an account type.");
      return;
    }

    setLoading(true);
    try {
      // Save account type choice
      localStorage.setItem("account_type", selectedType);
      
      if (selectedType === "personal") {
        showToast("success", "Welcome to your personal dashboard! 🎉");
        setTimeout(() => {
          // Clear first-time user flag
          clearAllAuthData();
          router.push("/profile");
        }, 1000);
      } else {
        showToast("success", "Setting up organization 🏢");
        setTimeout(() => {
          // Clear first-time user flag
          clearAllAuthData();
          router.push("/register/organization");
        }, 1000);
      }
    } catch (e: unknown) {
      showToast("error", "Could not complete setup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome to IMOS!</h1>
      <p className="text-gray-600 dark:text-gray-300 mb-8">Choose your account type to get started</p>
      
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Account */}
          <div
            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
              selectedType === "personal"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedType("personal")}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Personal</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Perfect for individual users who want to create and manage their own maps.
              </p>
            </div>
          </div>

          {/* Organization Account */}
          <div
            className={`p-6 border-2 rounded-xl cursor-pointer transition-all ${
              selectedType === "organization"
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={() => setSelectedType("organization")}
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Organization</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Ideal for teams and businesses that need collaborative mapping features.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !selectedType}
          className="w-full bg-emerald-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Setting up..." : "Continue"}
        </button>
      </form>
    </div>
  );
}
