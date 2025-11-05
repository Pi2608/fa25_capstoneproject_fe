"use client";

import { useEffect, useMemo, useState } from "react";

type TokenScope = "read" | "write" | "admin";
type ApiToken = {
  id: string;
  name: string;
  scope: TokenScope;
  value: string;
  createdAt: string;
  lastUsedAt?: string | null;
  active: boolean;
};

type WebhookEvent =
  | "map.created"
  | "map.updated"
  | "layer.created"
  | "membership.invited"
  | "organization.usage.exceeded";

type Webhook = {
  id: string;
  name: string;
  url: string;
  secret: string;
  isActive: boolean;
  events: WebhookEvent[];
  createdAt: string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function nowIso() {
  return new Date().toISOString();
}
function randomId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
function genTokenValue() {
  const rand = crypto.getRandomValues(new Uint8Array(24));
  const base = btoa(String.fromCharCode(...Array.from(rand)));
  return `cmk_${base.replace(/[^A-Za-z0-9]/g, "").slice(0, 40)}`;
}
function genSecret() {
  const rand = crypto.getRandomValues(new Uint8Array(32));
  const base = btoa(String.fromCharCode(...Array.from(rand)));
  return `whs_${base.replace(/[^A-Za-z0-9]/g, "").slice(0, 48)}`;
}
function maskMiddle(s: string, keepStart = 6, keepEnd = 4) {
  if (s.length <= keepStart + keepEnd) return s;
  return `${s.slice(0, keepStart)}••••••••${s.slice(-keepEnd)}`;
}

const TOKENS_KEY = "cmosm:dev:tokens";
const WHS_KEY = "cmosm:dev:webhooks";

export default function DevelopersPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [showNewToken, setShowNewToken] = useState(false);
  const [showNewWebhook, setShowNewWebhook] = useState(false);

  const [tokName, setTokName] = useState("");
  const [tokScope, setTokScope] = useState<TokenScope>("read");
  const [tokReveal, setTokReveal] = useState<Record<string, boolean>>({});

  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whSecret, setWhSecret] = useState<string>(genSecret());
  const [whEvents, setWhEvents] = useState<Record<WebhookEvent, boolean>>({
    "map.created": true,
    "map.updated": true,
    "layer.created": false,
    "membership.invited": false,
    "organization.usage.exceeded": true,
  });

  useEffect(() => {
    try {
      const tRaw = localStorage.getItem(TOKENS_KEY);
      const wRaw = localStorage.getItem(WHS_KEY);
      if (tRaw) setTokens(JSON.parse(tRaw) as ApiToken[]);
      if (wRaw) setWebhooks(JSON.parse(wRaw) as Webhook[]);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    localStorage.setItem(WHS_KEY, JSON.stringify(webhooks));
  }, [webhooks]);

  const activeTokens = useMemo(() => tokens.filter((t) => t.active), [tokens]);
  const activeWebhooks = useMemo(() => webhooks.filter((w) => w.isActive), [webhooks]);

  function createToken() {
    const t: ApiToken = {
      id: randomId("tok"),
      name: tokName.trim() || "Untitled token",
      scope: tokScope,
      value: genTokenValue(),
      createdAt: nowIso(),
      lastUsedAt: null,
      active: true,
    };
    setTokens((xs) => [t, ...xs]);
    setShowNewToken(false);
    setTokName("");
    setTokScope("read");
  }

  function revokeToken(id: string) {
    if (!confirm("Revoke this token? Apps using it will stop working.")) return;
    setTokens((xs) => xs.map((t) => (t.id === id ? { ...t, active: false } : t)));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard");
    } catch {
      alert("Copy failed");
    }
  }

  function toggleEvent(ev: WebhookEvent) {
    setWhEvents((s) => ({ ...s, [ev]: !s[ev] }));
  }

  function createWebhook() {
    const selected = (Object.keys(whEvents) as WebhookEvent[]).filter((k) => whEvents[k]);
    if (!whUrl.trim()) {
      alert("Please enter a webhook URL");
      return;
    }
    const w: Webhook = {
      id: randomId("wh"),
      name: whName.trim() || "New webhook",
      url: whUrl.trim(),
      secret: whSecret.trim() || genSecret(),
      events: selected.length ? selected : ["organization.usage.exceeded"],
      isActive: true,
      createdAt: nowIso(),
    };
    setWebhooks((xs) => [w, ...xs]);
    setShowNewWebhook(false);
    setWhName("");
    setWhUrl("");
    setWhSecret(genSecret());
  }

  function disableWebhook(id: string) {
    setWebhooks((xs) => xs.map((w) => (w.id === id ? { ...w, isActive: false } : w)));
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Developers</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Kết nối dữ liệu và workflow của bạn với IMOS qua API keys, webhooks và SDK.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewToken(true)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Generate new token
          </button>
          <button
            onClick={() => setShowNewWebhook(true)}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50 dark:bg-transparent dark:text-emerald-300 dark:ring-emerald-400/40 dark:hover:bg-emerald-500/10"
          >
            Create webhook
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950 lg:col-span-2">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="space-y-0.5">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">API tokens</h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Chia sẻ token cẩn thận — token có toàn quyền trong phạm vi bạn chọn.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
              {activeTokens.length} active
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-zinc-200 bg-zinc-50 text-left text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Scope</th>
                  <th className="px-4 py-2 font-medium">Token</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-400" colSpan={6}>
                      Chưa có token nào. Nhấn <span className="font-medium">Generate new token</span> để tạo.
                    </td>
                  </tr>
                )}
                {tokens.map((t) => {
                  const revealed = !!tokReveal[t.id];
                  return (
                    <tr key={t.id} className="border-t border-zinc-200 dark:border-white/5">
                      <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{t.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-md px-2 py-0.5 text-xs ring-1",
                            t.scope === "admin" &&
                              "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
                            t.scope === "write" &&
                              "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30",
                            t.scope === "read" &&
                              "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10"
                          )}
                        >
                          {t.scope}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                        {revealed ? t.value : maskMiddle(t.value)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-full px-2 py-0.5 text-xs ring-1",
                            t.active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
                              : "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10"
                          )}
                        >
                          {t.active ? "Active" : "Revoked"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setTokReveal((s) => ({ ...s, [t.id]: !s[t.id] }))
                            }
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
                          >
                            {revealed ? "Hide" : "Reveal"}
                          </button>
                          <button
                            onClick={() => copy(t.value)}
                            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
                          >
                            Copy
                          </button>
                          <button
                            disabled={!t.active}
                            onClick={() => revokeToken(t.id)}
                            className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          <div className="px-4 py-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Quick start</h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Gọi API bằng cURL và xác minh chữ ký webhook.
            </p>
          </div>
          <div className="px-4 pb-4">
            <div className="rounded-lg bg-zinc-900/95 p-3 text-xs text-zinc-100 ring-1 ring-white/10">
              <pre className="whitespace-pre-wrap leading-relaxed">
{`# Replace with your token
export IMOS_TOKEN=cmk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
curl -H "Authorization: Bearer $IMOS_TOKEN" \\
     https://api.imos.app/v1/me`}
              </pre>
            </div>
            <div className="mt-3 rounded-lg bg-zinc-900/95 p-3 text-xs text-zinc-100 ring-1 ring-white/10">
              <pre className="whitespace-pre-wrap leading-relaxed">
{`// Verify webhook (Node/TypeScript)
import crypto from "crypto";
function verify(body: string, signature: string, secret: string) {
  const h = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(signature));
}
// Header: X-IMOS-Signature: <hex> (HMAC-SHA256)`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Webhooks</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Nhận sự kiện theo thời gian thực để đồng bộ hệ thống của bạn.
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
            {activeWebhooks.length} active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-zinc-200 bg-zinc-50 text-left text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">URL</th>
                <th className="px-4 py-2 font-medium">Events</th>
                <th className="px-4 py-2 font-medium">Secret</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-400" colSpan={6}>
                    Chưa có webhook nào. Nhấn <span className="font-medium">Create webhook</span> để tạo.
                  </td>
                </tr>
              )}
              {webhooks.map((w) => (
                <tr key={w.id} className="border-t border-zinc-200 dark:border-white/5">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{w.name}</td>
                  <td className="px-4 py-3">
                    <a
                      href={w.url}
                      target="_blank"
                      className="text-sky-600 hover:underline dark:text-sky-300"
                    >
                      {w.url}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <span
                          key={e}
                          className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                    {maskMiddle(w.secret, 4, 3)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cls(
                        "rounded-full px-2 py-0.5 text-xs ring-1",
                        w.isActive
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
                          : "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10"
                      )}
                    >
                      {w.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copy(w.secret)}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
                      >
                        Copy secret
                      </button>
                      <button
                        disabled={!w.isActive}
                        onClick={() => disableWebhook(w.id)}
                        className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <div className="mt-3 rounded-lg bg-zinc-900/95 p-3 text-xs text-zinc-100 ring-1 ring-white/10">
            <pre className="whitespace-pre-wrap leading-relaxed">
{`POST ${"<your-webhook-url>"}
Headers:
  Content-Type: application/json
  X-IMOS-Event: map.created
  X-IMOS-Signature: <hex of HMAC-SHA256(body, secret)>

Body:
  { "id": "map_123", "name": "My Map", "orgId": "org_456" }`}
            </pre>
          </div>
        </div>
      </section>

      {showNewToken && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Generate new token</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Name</label>
                <input
                  value={tokName}
                  onChange={(e) => setTokName(e.target.value)}
                  placeholder="e.g. CI pipeline"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Scope</label>
                <select
                  value={tokScope}
                  onChange={(e) => setTokScope(e.target.value as TokenScope)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="read">read</option>
                  <option value="write">write</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewToken(false)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={createToken}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Create token
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewWebhook && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create webhook</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Name</label>
                <input
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="e.g. Supabase sync"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">URL</label>
                <input
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://your-app.com/webhooks/imos"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Signing secret</label>
                <div className="flex gap-2">
                  <input
                    value={whSecret}
                    onChange={(e) => setWhSecret(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => setWhSecret(genSecret())}
                    className="whitespace-nowrap rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">Events</label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "map.created",
                      "map.updated",
                      "layer.created",
                      "membership.invited",
                      "organization.usage.exceeded",
                    ] as WebhookEvent[]
                  ).map((ev) => (
                    <label
                      key={ev}
                      className={cls(
                        "cursor-pointer select-none rounded-md px-2 py-1 text-xs ring-1",
                        whEvents[ev]
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
                          : "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10"
                      )}
                      onClick={() => toggleEvent(ev)}
                    >
                      {ev}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewWebhook(false)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={createWebhook}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Create webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
