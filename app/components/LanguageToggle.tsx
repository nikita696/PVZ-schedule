import { Languages } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';
import { cn } from './ui/utils';

export function LanguageToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/90 p-1 shadow-sm', className)}>
      <div className="inline-flex items-center gap-1 px-2 text-xs font-medium text-stone-500">
        <Languages className="h-3.5 w-3.5" />
        {!compact ? t('Язык', 'Language') : null}
      </div>
      <Button
        type="button"
        variant={language === 'ru' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 rounded-full px-3"
        onClick={() => setLanguage('ru')}
      >
        <span className="text-sm">🇷🇺</span>
        <span>RU</span>
      </Button>
      <Button
        type="button"
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 rounded-full px-3"
        onClick={() => setLanguage('en')}
      >
        <span className="text-sm">🇬🇧</span>
        <span>EN</span>
      </Button>
    </div>
  );
}
