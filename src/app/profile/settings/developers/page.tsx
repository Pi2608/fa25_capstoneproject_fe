"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useTheme } from "next-themes";
import { getThemeClasses } from "@/utils/theme-utils";

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
  const { t } = useI18n();
  const { resolvedTheme, theme } = useTheme();
  const currentTheme = (resolvedTheme ?? theme ?? "light") as "light" | "dark";
  const isDark = currentTheme === "dark";
  const themeClasses = getThemeClasses(isDark);

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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    localStorage.setItem(WHS_KEY, JSON.stringify(webhooks));
  }, [webhooks]);

  const activeTokens = useMemo(() => tokens.filter((t0) => t0.active), [tokens]);
  const activeWebhooks = useMemo(() => webhooks.filter((w) => w.isActive), [webhooks]);

  function createToken() {
    const t0: ApiToken = {
      id: randomId("tok"),
      name: tokName.trim() || t("developers.token_untitled"),
      scope: tokScope,
      value: genTokenValue(),
      createdAt: nowIso(),
      lastUsedAt: null,
      active: true,
    };
    setTokens((xs) => [t0, ...xs]);
    setShowNewToken(false);
    setTokName("");
    setTokScope("read");
  }

  function revokeToken(id: string) {
    if (!confirm(t("developers.confirm_revoke"))) return;
    setTokens((xs) => xs.map((t0) => (t0.id === id ? { ...t0, active: false } : t0)));
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      alert(t("developers.copy_success"));
    } catch {
      alert(t("developers.copy_failed"));
    }
  }

  function toggleEvent(ev: WebhookEvent) {
    setWhEvents((s) => ({ ...s, [ev]: !s[ev] }));
  }

  function createWebhook() {
    const selected = (Object.keys(whEvents) as WebhookEvent[]).filter((k) => whEvents[k]);
    if (!whUrl.trim()) {
      alert(t("developers.enter_webhook_url"));
      return;
    }
    const w: Webhook = {
      id: randomId("wh"),
      name: whName.trim() || t("developers.webhook_new"),
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

  const scopeLabel: Record<TokenScope, string> = {
    read: t("developers.scope_read"),
    write: t("developers.scope_write"),
    admin: t("developers.scope_admin"),
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{t("developers.title")}</h1>
          <p className={`text-sm ${themeClasses.textMuted}`}>
            {t("developers.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewToken(true)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            {t("developers.btn_generate")}
          </button>
          <button
            onClick={() => setShowNewWebhook(true)}
            className={`rounded-lg px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-50 ${isDark ? "bg-transparent text-emerald-300 ring-emerald-400/40 hover:bg-emerald-500/10" : "bg-white"}`}
          >
            {t("developers.btn_create_webhook")}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tokens */}
        <div className={`rounded-2xl border shadow-sm lg:col-span-2 ${themeClasses.panel} ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="space-y-0.5">
              <h2 className={`text-base font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("developers.tokens_title")}</h2>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                {t("developers.tokens_desc")}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
              {activeTokens.length} {t("developers.active_label")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={themeClasses.tableHeader}>
                  <th className="px-4 py-2 font-medium text-left">{t("developers.tokens_th_name")}</th>
                  <th className="px-4 py-2 font-medium text-left">{t("developers.tokens_th_scope")}</th>
                  <th className="px-4 py-2 font-medium text-left">{t("developers.tokens_th_token")}</th>
                  <th className="px-4 py-2 font-medium text-left">{t("developers.tokens_th_created")}</th>
                  <th className="px-4 py-2 font-medium text-left">{t("developers.tokens_th_status")}</th>
                  <th className="px-4 py-2 font-medium text-left">{t("developers.tokens_th_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 && (
                  <tr>
                    <td className={`px-4 py-8 text-center ${themeClasses.textMuted}`} colSpan={6}>
                      {t("developers.tokens_empty")}{" "}
                      <span className="font-medium">{t("developers.btn_generate")}</span>{" "}
                      {t("developers.tokens_empty_after")}
                    </td>
                  </tr>
                )}
                {tokens.map((t0) => {
                  const revealed = !!tokReveal[t0.id];
                  return (
                    <tr key={t0.id} className={`border-t ${themeClasses.tableCell}`}>
                      <td className={`px-4 py-3 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t0.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-md px-2 py-0.5 text-xs ring-1",
                            t0.scope === "admin" &&
                              "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
                            t0.scope === "write" &&
                              "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/30",
                            t0.scope === "read" &&
                              "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10"
                          )}
                        >
                          {scopeLabel[t0.scope]}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-mono text-xs ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
                        {revealed ? t0.value : maskMiddle(t0.value)}
                      </td>
                      <td className={`px-4 py-3 ${themeClasses.textMuted}`}>
                        {new Date(t0.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cls(
                            "rounded-full px-2 py-0.5 text-xs ring-1",
                            t0.active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30"
                              : "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:ring-white/10"
                          )}
                        >
                          {t0.active ? t("developers.status_active") : t("developers.status_revoked")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setTokReveal((s) => ({ ...s, [t0.id]: !s[t0.id] }))}
                            className={`rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 ${themeClasses.button} ${isDark ? "dark:hover:bg-white/5" : ""}`}
                          >
                            {revealed ? t("developers.btn_hide") : t("developers.btn_reveal")}
                          </button>
                          <button
                            onClick={() => copy(t0.value)}
                            className={`rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 ${themeClasses.button} ${isDark ? "dark:hover:bg-white/5" : ""}`}
                          >
                            {t("developers.btn_copy")}
                          </button>
                          <button
                            disabled={!t0.active}
                            className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                            onClick={() => revokeToken(t0.id)}
                          >
                            {t("developers.btn_revoke")}
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

        {/* Quickstart */}
        <div className={`rounded-2xl border shadow-sm ${themeClasses.panel} ${isDark ? "border-white/10" : "border-gray-200"}`}>
          <div className="px-4 py-3">
            <h2 className={`text-base font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("developers.quickstart_title")}</h2>
            <p className={`mt-1 text-xs ${themeClasses.textMuted}`}>{t("developers.quickstart_desc")}</p>
          </div>
          <div className="px-4 pb-4">
            <div className={`rounded-lg p-3 text-xs ring-1 ${isDark ? "bg-zinc-900/95 text-zinc-100 ring-white/10" : "bg-gray-900/95 text-gray-100 ring-gray-700/50"}`}>
              <pre className="whitespace-pre-wrap leading-relaxed">
{`# Replace with your token
export IMOS_TOKEN=cmk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
curl -H "Authorization: Bearer $IMOS_TOKEN" \\
     https://api.imos.app/v1/me`}
              </pre>
            </div>
            <div className={`mt-3 rounded-lg p-3 text-xs ring-1 ${isDark ? "bg-zinc-900/95 text-zinc-100 ring-white/10" : "bg-gray-900/95 text-gray-100 ring-gray-700/50"}`}>
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

      {/* Webhooks */}
      <section className={`rounded-2xl border shadow-sm ${themeClasses.panel} ${isDark ? "border-white/10" : "border-gray-200"}`}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="space-y-0.5">
            <h2 className={`text-base font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("developers.webhooks_title")}</h2>
            <p className={`text-xs ${themeClasses.textMuted}`}>
              {t("developers.webhooks_desc")}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30">
            {activeWebhooks.length} {t("developers.active_label")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={themeClasses.tableHeader}>
                <th className="px-4 py-2 font-medium text-left">{t("developers.webhooks_th_name")}</th>
                <th className="px-4 py-2 font-medium text-left">{t("developers.webhooks_th_url")}</th>
                <th className="px-4 py-2 font-medium text-left">{t("developers.webhooks_th_events")}</th>
                <th className="px-4 py-2 font-medium text-left">{t("developers.webhooks_th_secret")}</th>
                <th className="px-4 py-2 font-medium text-left">{t("developers.webhooks_th_status")}</th>
                <th className="px-4 py-2 font-medium text-left">{t("developers.webhooks_th_actions")}</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 && (
                <tr>
                  <td className={`px-4 py-8 text-center ${themeClasses.textMuted}`} colSpan={6}>
                    {t("developers.webhooks_empty")}{" "}
                    <span className="font-medium">{t("developers.btn_create_webhook")}</span>{" "}
                    {t("developers.webhooks_empty_after")}
                  </td>
                </tr>
              )}
              {webhooks.map((w) => (
                <tr key={w.id} className={`border-t ${themeClasses.tableCell}`}>
                  <td className={`px-4 py-3 ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{w.name}</td>
                  <td className="px-4 py-3">
                    <a href={w.url} target="_blank" className={`${isDark ? "text-sky-300" : "text-sky-600"} hover:underline`}>
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
                  <td className={`px-4 py-3 font-mono text-xs ${isDark ? "text-zinc-200" : "text-gray-800"}`}>
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
                      {w.isActive ? t("developers.status_active") : t("developers.status_disabled")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copy(w.secret)}
                        className={`rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 ${themeClasses.button} ${isDark ? "dark:hover:bg-white/5" : ""}`}
                      >
                        {t("developers.btn_copy_secret")}
                      </button>
                      <button
                        disabled={!w.isActive}
                        onClick={() => disableWebhook(w.id)}
                        className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        {t("developers.btn_disable")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <div className={`mt-3 rounded-lg p-3 text-xs ring-1 ${isDark ? "bg-zinc-900/95 text-zinc-100 ring-white/10" : "bg-gray-900/95 text-gray-100 ring-gray-700/50"}`}>
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

      {/* Modal: New Token */}
      {showNewToken && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-2xl border p-5 shadow-xl ${themeClasses.panel} ${isDark ? "border-white/10" : "border-gray-200"}`}>
            <h3 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("developers.modal_token_title")}</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("developers.label_name")}</label>
                <input
                  value={tokName}
                  onChange={(e) => setTokName(e.target.value)}
                  placeholder={t("developers.ph_token_name")}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.input}`}
                />
              </div>
              <div>
                <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("developers.label_scope")}</label>
                <select
                  value={tokScope}
                  onChange={(e) => setTokScope(e.target.value as TokenScope)}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.select}`}
                >
                  <option value="read">{t("developers.scope_read")}</option>
                  <option value="write">{t("developers.scope_write")}</option>
                  <option value="admin">{t("developers.scope_admin")}</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewToken(false)}
                className={`rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 ${themeClasses.button} ${isDark ? "dark:hover:bg-white/5" : ""}`}
              >
                {t("developers.btn_cancel")}
              </button>
              <button
                onClick={createToken}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {t("developers.btn_create_token")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Webhook */}
      {showNewWebhook && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className={`w-full max-w-xl rounded-2xl border p-5 shadow-xl ${themeClasses.panel} ${isDark ? "border-white/10" : "border-gray-200"}`}>
            <h3 className={`text-lg font-semibold ${isDark ? "text-zinc-100" : "text-gray-900"}`}>{t("developers.modal_webhook_title")}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("developers.label_name")}</label>
                <input
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder={t("developers.ph_webhook_name")}
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.input}`}
                />
              </div>
              <div className="md:col-span-2">
                <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("developers.label_url")}</label>
                <input
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  placeholder="https://your-app.com/webhooks/imos"
                  className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.input}`}
                />
              </div>
              <div className="md:col-span-2">
                <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("developers.label_secret")}</label>
                <div className="flex gap-2">
                  <input
                    value={whSecret}
                    onChange={(e) => setWhSecret(e.target.value)}
                    className={`w-full rounded-md border px-3 py-2 font-mono text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${themeClasses.input}`}
                  />
                  <button
                    onClick={() => setWhSecret(genSecret())}
                    className={`whitespace-nowrap rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 ${themeClasses.button} ${isDark ? "dark:hover:bg-white/5" : ""}`}
                  >
                    {t("developers.btn_regen")}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={`mb-1 block text-xs ${themeClasses.textMuted}`}>{t("developers.label_events")}</label>
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
                className={`rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 ${themeClasses.button} ${isDark ? "dark:hover:bg-white/5" : ""}`}
              >
                {t("developers.btn_cancel")}
              </button>
              <button
                onClick={createWebhook}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {t("developers.btn_create_webhook")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
