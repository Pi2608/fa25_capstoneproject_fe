'use client';

import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { messages, type Lang, type Namespaces, type KeysOf } from './messages';

type Vars = Record<string, string | number>;

type TFunc = {
  <N extends Namespaces>(ns: N, key: KeysOf<N>, vars?: Vars): string;
  (path: `${Namespaces}.${string}`, vars?: Vars): string;
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
};

const I18nCtx = createContext<Ctx | null>(null);
const LS_KEY = 'lang';

function isVars(v: unknown): v is Vars {
  if (!v || typeof v !== 'object') return false;
  return Object.values(v as Record<string, unknown>).every(
    (x) => typeof x === 'string' || typeof x === 'number'
  );
}

function formatWithVars(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
  );
}

export function I18nProvider({
  initialLang,
  children
}: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as Lang | null;
    if (saved === 'vi' || saved === 'en') {
      setLangState(saved);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LS_KEY, l);
    document.cookie = `lang=${l}; Path=/; Max-Age=${60 * 60 * 24 * 365}`;
  };

  const t = useMemo<TFunc>(() => {
    const warned = new Set<string>();

    const getMsg = (ns: Namespaces, key: string): string | undefined => {
      const pack = messages[lang]?.[ns] as Record<string, unknown> | undefined;
      const raw = pack ? (pack[key] as unknown) : undefined;
      return typeof raw === 'string' ? raw : undefined;
    };

    const impl = (...args: unknown[]): string => {
      let ns: Namespaces | undefined;
      let key: string | undefined;
      let vars: Vars | undefined;

      if (typeof args[0] === 'string' && (args.length === 1 || isVars(args[1]))) {
        const path = args[0] as string;
        const dot = path.indexOf('.');
        if (dot > 0) {
          ns = path.slice(0, dot) as Namespaces;
          key = path.slice(dot + 1);
        } else {
          ns = 'common' as Namespaces;
          key = path;
        }
        vars = (args[1] as Vars) ?? undefined;
      }
      else if (typeof args[0] === 'string' && typeof args[1] === 'string') {
        ns = args[0] as Namespaces;
        key = args[1];
        vars = (args[2] as Vars) ?? undefined;
      }

      if (!ns || !key) return '';

      const msg = getMsg(ns, key);
      if (msg === undefined) {
        const id = `${String(ns)}.${String(key)}`;
        if (!warned.has(id)) {
          console.warn(`[i18n] Missing message: ${id} (lang=${lang})`);
          warned.add(id);
        }
        return id;
      }
      return formatWithVars(msg, vars);
    };

    return impl as TFunc;
  }, [lang]);

  const value = useMemo<Ctx>(() => ({ lang, setLang, t }), [lang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('I18nProvider is missing');
  return ctx;
}
