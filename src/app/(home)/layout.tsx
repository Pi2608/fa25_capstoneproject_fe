// import Link from "next/link";
// import type { Metadata } from "next";

// export const metadata: Metadata = {
//   title: "CustomMapOSM",
//   description: "Shared layout with header and categories for all pages",
// };

// const NAV = [
//   { label: "Service", href: "/service" },
//   { label: "Tutorial", href: "/tutorial" },
//   { label: "Templates", href: "/templates" },
//   { label: "Pricing", href: "/pricing" },
//   { label: "Community", href: "/community" },
// ] as const;

// const CATEGORIES = [
//   "Geospatial",
//   "Planning",
//   "Reports",
//   "Education",
//   "Engineering",
//   "Research",
//   "Operations",
//   "Fieldwork",
// ] as const;

// export default function HomeLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(16,185,129,0.18),transparent)] bg-gradient-to-b from-zinc-950 via-emerald-950/30 to-zinc-950 text-zinc-100">
//       <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/40 border-b border-white/10">
//         <div className="mx-auto max-w-7xl px-4">
//           <div className="flex h-16 items-center justify-between">
//             <Link href="/" className="flex items-center gap-2">
//               <div className="h-6 w-6 rounded-lg bg-emerald-400/90 shadow" />
//               <span className="text-lg font-semibold tracking-tight">CustomMapOSM</span>
//             </Link>
//             <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
//               {NAV.map((n) => (
//                 <Link key={n.label} href={n.href} className="hover:text-white transition">
//                   {n.label}
//                 </Link>
//               ))}
//             </nav>
//             <div className="flex items-center gap-3">
//               <Link href="/login" className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:text-white">
//                 Login
//               </Link>
//               <Link
//                 href="/register"
//                 className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-medium text-zinc-950 shadow hover:bg-emerald-400 transition"
//               >
//                 Get started
//               </Link>
//             </div>
//           </div>
//         </div>
//         <div className="border-t border-white/10">
//           <div className="mx-auto max-w-7xl px-4">
//             <div className="flex items-center gap-2 overflow-x-auto py-2 text-sm text-zinc-300 [scrollbar-width:none] [-ms-overflow-style:none]">
//               {CATEGORIES.map((c) => (
//                 <button
//                   key={c}
//                   className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:border-emerald-400/70 hover:text-white transition"
//                 >
//                   {c}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>
//       </header>

//       {children}
//     </main>
//   );
// }


import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CustomMapOSM",
  description: "Shared layout without duplicate header",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(16,185,129,0.18),transparent)] bg-gradient-to-b from-zinc-950 via-emerald-950/30 to-zinc-950 text-zinc-100">
      {children}
    </main>
  );
}
