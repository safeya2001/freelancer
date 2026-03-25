import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import Cookies from 'js-cookie';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const isAr = router.locale === 'ar';

  function switchLanguage() {
    const newLocale = isAr ? 'en' : 'ar';
    Cookies.set('NEXT_LOCALE', newLocale, { expires: 365 });
    router.push(router.asPath, router.asPath, { locale: newLocale });
  }

  return (
    <button
      onClick={switchLanguage}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
        border border-gray-200 hover:border-primary-400 hover:text-primary-700 transition ${className}`}
      aria-label="Switch language"
    >
      <span className="text-base">{isAr ? '🇬🇧' : '🇯🇴'}</span>
      <span>{t('common.language')}</span>
    </button>
  );
}
