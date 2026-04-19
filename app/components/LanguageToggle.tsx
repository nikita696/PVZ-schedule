import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';
import { cn } from './ui/utils';

export function LanguageToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { language, toggleLanguage, t } = useLanguage();
  const nextLanguage = language === 'ru' ? 'EN' : 'RU';
  const toggleHint = language === 'ru'
    ? t('Переключить язык на английский', 'Switch language to English')
    : t('Переключить язык на русский', 'Switch language to Russian');

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'rounded-full border border-transparent bg-white/45 font-semibold uppercase text-stone-400 shadow-none transition-colors hover:border-stone-200 hover:bg-white/85 hover:text-stone-900',
        compact
          ? 'h-8 min-w-[3.25rem] px-2.5 text-[11px] tracking-[0.22em]'
          : 'h-9 min-w-[3.5rem] px-3 text-xs tracking-[0.24em]',
        className,
      )}
      onClick={toggleLanguage}
      title={toggleHint}
    >
      <span>{nextLanguage}</span>
      <span className="sr-only">{toggleHint}</span>
    </Button>
  );
}
