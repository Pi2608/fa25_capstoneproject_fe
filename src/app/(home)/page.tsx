import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CustomMapOSM — Map your world, fast & simple",
  description: "Felt-style landing page in dark green tone with category bar and sections.",
};

const NAV = [
  { label: "Service", href: "#service" },
  { label: "Tutorial", href: "#tutorial" },
  { label: "Templates", href: "#templates" },
  { label: "Pricing", href: "#pricing" },
  { label: "Community", href: "#community" },
] as const;

const CATEGORIES = [
  "Geospatial",
  "Planning",
  "Reports",
  "Education",
  "Engineering",
  "Research",
  "Operations",
  "Fieldwork",
] as const;

const FEATURES = [
  {
    title: "Real‑time collaboration",
    body: "Edit maps together, add notes, and review changes instantly with your team.",
  },
  {
    title: "Import anything",
    body: "Bring in GeoJSON, CSV, KML, and tiles — they just work.",
  },
  {
    title: "Share securely",
    body: "Public links or invite‑only workspaces with granular roles.",
  },
  {
    title: "Beautiful by default",
    body: "Clean styles, smart labeling, and export‑ready visuals.",
  },
] as const;

const TEMPLATES = [
  { title: "Store locations", tag: "Business" },
  { title: "City zoning plan", tag: "Planning" },
  { title: "Delivery routes", tag: "Logistics" },
  { title: "Field survey", tag: "Research" },
  { title: "Incident report", tag: "Operations" },
  { title: "Campus map", tag: "Education" },
] as const;

const GRID_SVG = encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' opacity='0.2'><defs><pattern id='g' width='10' height='10' patternUnits='userSpaceOnUse'><path d='M 10 0 L 0 0 0 10' fill='none' stroke='white' stroke-width='0.5'/></pattern></defs><rect width='100%' height='100%' fill='black'/><rect width='100%' height='100%' fill='url(#g)'/></svg>");

export default function Page() {
  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_600px_at_70%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(800px_400px_at_0%_20%,rgba(16,185,129,0.18),transparent)] bg-gradient-to-b from-zinc-950 via-emerald-950/30 to-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/40 border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-emerald-400/90 shadow" />
              <span className="text-lg font-semibold tracking-tight">CustomMapOSM</span>
            </Link>
            <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
              {NAV.map((n) => (
                <Link key={n.label} href={n.href} className="hover:text-white transition">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/login" className="rounded-xl px-3 py-2 text-sm text-zinc-300 hover:text-white">
                Sign in
              </Link>
              <Link
                href="#get-started"
                className="rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-medium text-zinc-950 shadow hover:bg-emerald-400 transition"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex items-center gap-2 overflow-x-auto py-2 text-sm text-zinc-300 [scrollbar-width:none] [-ms-overflow-style:none]">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:border-emerald-400/70 hover:text-white transition"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 py-20 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold leading-tight md:text-6xl">
              Map your world
              <span className="block bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">fast & simple</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-zinc-300 md:text-lg">
              Plan, analyze, and present on an elegant, collaborative map canvas. Import data, sketch ideas, and share instantly.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="#get-started"
                className="rounded-2xl bg-emerald-500/90 px-5 py-3 text-sm font-medium text-zinc-950 shadow-lg shadow-emerald-500/10 hover:bg-emerald-400"
              >
                Start for free
              </Link>
              <Link
                href="#templates"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Explore templates
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-6 opacity-80">
              <div className="text-xs uppercase tracking-wide text-zinc-400">Trusted by teams</div>
              <div className="h-6 w-20 rounded bg-white/10" />
              <div className="h-6 w-20 rounded bg-white/10" />
              <div className="h-6 w-20 rounded bg-white/10" />
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-3xl bg-emerald-500/10 blur-2xl" />
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/60 to-zinc-800/60 p-3 shadow-2xl backdrop-blur">
              <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <div className="h-2 w-2 rounded-full bg-emerald-300/80" />
                  <div className="h-2 w-2 rounded-full bg-emerald-200/70" />
                </div>
                <div className="aspect-[16/10] w-full rounded-xl bg-[linear-gradient(120deg,rgba(16,185,129,0.25),transparent),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="border-t border-white/10 bg-zinc-950/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="text-2xl font-semibold md:text-3xl">Why teams choose us</h2>
            <Link href="#" className="text-sm text-emerald-300 hover:text-emerald-200">
              Learn more →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow">
                <div className="mb-3 h-10 w-10 rounded-xl bg-emerald-400/20" />
                <div className="text-lg font-medium">{f.title}</div>
                <p className="mt-2 text-sm text-zinc-300">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="templates" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Template gallery</h2>
              <p className="mt-1 text-sm text-zinc-300">Jump‑start your next map with ready‑to‑use layouts.</p>
            </div>
            <Link href="#" className="text-sm text-emerald-300 hover:text-emerald-200">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((t) => (
              <div key={t.title} className="group rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="aspect-[16/10] w-full rounded-xl border border-white/10 bg-[linear-gradient(140deg,rgba(16,185,129,0.22),transparent),linear-gradient(0deg,rgba(255,255,255,0.04),transparent)]" />
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-400">{t.tag}</div>
                  </div>
                  <Link href="#" className="rounded-lg border border-white/15 px-3 py-1 text-xs text-zinc-200 group-hover:border-emerald-300/60 group-hover:text-white">
                    Use template
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-white/10 bg-zinc-950/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold md:text-3xl">Simple pricing</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-300">
            Start free. Upgrade when you need more collaboration, storage, and advanced export options.
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-zinc-400">Free</div>
              <div className="mt-2 text-3xl font-semibold">$0</div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                <li>Unlimited viewers</li>
                <li>3 active maps</li>
                <li>Community support</li>
              </ul>
              <Link href="#" className="mt-6 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm">
                Get started
              </Link>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-6 ring-1 ring-emerald-400/30">
              <div className="text-sm text-emerald-200">Pro</div>
              <div className="mt-2 text-3xl font-semibold">$12</div>
              <ul className="mt-4 space-y-2 text-sm text-emerald-100/90">
                <li>Unlimited maps</li>
                <li>Advanced import/export</li>
                <li>Private sharing</li>
              </ul>
              <Link href="#" className="mt-6 inline-block rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-medium text-zinc-950">
                Upgrade
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-zinc-400">Team</div>
              <div className="mt-2 text-3xl font-semibold">Custom</div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                <li>SSO and roles</li>
                <li>Shared libraries</li>
                <li>Priority support</li>
              </ul>
              <Link href="#" className="mt-6 inline-block rounded-xl bg-white/10 px-4 py-2 text-sm">
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="community" className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Join the community</h2>
              <p className="mt-2 text-sm text-zinc-300">
                Learn tips, share projects, and get feedback from thousands of mapping enthusiasts.
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="#" className="rounded-xl bg-white/10 px-4 py-2 text-sm">
                  Visit forum
                </Link>
                <Link href="#" className="rounded-xl border border-white/15 px-4 py-2 text-sm">
                  Follow updates
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="aspect-[16/10] w-full rounded-2xl border border-white/10 bg-[linear-gradient(140deg,rgba(16,185,129,0.22),transparent),linear-gradient(0deg,rgba(255,255,255,0.04),transparent)]" />
            </div>
          </div>
        </div>
      </section>

      <section id="get-started" className="border-t border-white/10 bg-zinc-950/30">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="rounded-3xl border border-white/10 bg-[linear-gradient(120deg,rgba(16,185,129,0.15),transparent)] p-8 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">Ready to build your next map?</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-zinc-300">
              Create a space for your team and start mapping in minutes. No credit card required.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/register" className="rounded-xl bg-emerald-500/90 px-5 py-3 text-sm font-medium text-zinc-950">
                Create account
              </Link>
              <Link href="#templates" className="rounded-xl border border-white/15 px-5 py-3 text-sm">
                Try a template
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <div className="font-medium">Product</div>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li><Link href="#">Overview</Link></li>
                <li><Link href="#">Templates</Link></li>
                <li><Link href="#">Changelog</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-medium">Company</div>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li><Link href="#">About</Link></li>
                <li><Link href="#">Careers</Link></li>
                <li><Link href="#">Press</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-medium">Resources</div>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li><Link href="#">Docs</Link></li>
                <li><Link href="#">Community</Link></li>
                <li><Link href="#">Blog</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-medium">Legal</div>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                <li><Link href="#">Privacy</Link></li>
                <li><Link href="#">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6 text-sm text-zinc-400">
            <div>© {new Date().getFullYear()} CustomMapOSM</div>
            <div className="flex items-center gap-6">
              <Link href="#">Twitter</Link>
              <Link href="#">GitHub</Link>
              <Link href="#">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
