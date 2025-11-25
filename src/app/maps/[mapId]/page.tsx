"use client";

import { Suspense } from "react";
import EditMapClient from "./EditMapPage";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading map...</p>
        </div>
      </div>
    }>
      <EditMapClient />
    </Suspense>
  );
}