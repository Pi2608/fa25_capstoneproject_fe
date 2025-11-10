'use client';
import {useI18n} from '@/i18n/I18nProvider';
import type {Lang} from '@/i18n/messages';

export default function LocaleSwitch() {
  const {lang, setLang} = useI18n();
  const Button = ({l}: {l: Lang}) => (
    <button
      onClick={() => setLang(l)}
      className={`px-2 py-1 rounded border ${lang === l ? 'font-semibold' : ''}`}
      aria-pressed={lang === l}
    >
      {l.toUpperCase()}
    </button>
  );
  return (
    <div className="flex gap-2">
      <Button l="vi" />
      <Button l="en" />
    </div>
  );
}
