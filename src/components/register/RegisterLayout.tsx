"use client";

import Link from "next/link";

interface RegisterLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showBackButton?: boolean;
  onBack?: () => void;
  currentStep?: number;
  totalSteps?: number;
}

export default function RegisterLayout({ 
  children, 
  title, 
  subtitle, 
}: RegisterLayoutProps) {
  return (
    <main className="relative min-h-screen text-gray-900 dark:text-white transition-colors">
      <div className="absolute inset-0 -z-20 bg-white dark:bg-[#070b0b]" aria-hidden />
      <div
        className="absolute inset-0 -z-10
                   bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.18),transparent_60%)]
                   dark:bg-[radial-gradient(1000px_520px_at_50%_-120px,rgba(16,185,129,0.12),transparent_60%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10
                   bg-[linear-gradient(to_bottom,rgba(16,185,129,0.08),transparent_35%)]
                   dark:bg-[linear-gradient(to_bottom,rgba(16,185,129,0.06),transparent_35%)]"
        aria-hidden
      />

      <header className="sticky top-0 z-40">
        <div
          className="pointer-events-none absolute inset-x-0 h-20 -z-10
                     bg-[linear-gradient(to_bottom,rgba(255,255,255,0.85),transparent)]
                     dark:bg-[linear-gradient(to_bottom,rgba(7,11,11,0.65),transparent)]"
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-500 shadow" />
            <span className="text-lg md:text-xl font-bold tracking-tight">IMOS</span>
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <section className="min-h-[60vh] md:min-h-[70vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-full max-w-4xl">

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
                {title}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                {subtitle}
              </p>
            </div>

            {/* Form Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-8 md:p-10">
                {children}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Already have an account? <Link href="/login" className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 font-medium hover:underline">Sign in</Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
