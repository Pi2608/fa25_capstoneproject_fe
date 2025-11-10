'use client';

import {createContext, useContext, useMemo, useState, useEffect} from 'react';
import {messages, type Lang, type Namespaces, type KeysOf} from './messages';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: <N extends Namespaces>(ns: N, key: KeysOf<N>) => string;
};

const I18nCtx = createContext<Ctx | null>(null);
const LS_KEY = 'lang';

export function I18nProvider({
  initialLang,
  children
}: {initialLang: Lang; children: React.ReactNode}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const saved = (localStorage.getItem(LS_KEY) as Lang | null);
    if (saved === 'vi' || saved === 'en') {
      setLangState(saved);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LS_KEY, l);
    document.cookie = `lang=${l}; Path=/; Max-Age=${60 * 60 * 24 * 365}`;
  };

  const t: Ctx['t'] = (ns, key) => String(messages[lang][ns][key]);

  const value = useMemo<Ctx>(() => ({lang, setLang, t}), [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('I18nProvider is missing');
  return ctx;
}
