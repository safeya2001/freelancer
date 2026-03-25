import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { NextSeo } from 'next-seo';
import { useRouter } from 'next/router';

interface Props {
  children: ReactNode;
  title?: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  noFooter?: boolean;
  fullWidth?: boolean;
}

export default function Layout({ children, title, titleAr, description, descriptionAr, noFooter, fullWidth }: Props) {
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const pageTitle = (isAr ? titleAr : title) || 'Dopa Work';
  const pageDesc =
    (isAr ? descriptionAr : description) ||
    (isAr
      ? 'منصة العمل الحر الأولى في الأردن — احصل على خدمات احترافية أو ابدأ كمستقل'
      : 'Jordan\'s leading freelance marketplace — hire professionals or start freelancing today');

  const { asPath } = useRouter();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || '';
  const languageAlternates = [
    { hrefLang: 'ar', href: `${baseUrl}/ar${asPath === '/' ? '' : asPath}` },
    { hrefLang: 'en', href: `${baseUrl}/en${asPath === '/' ? '' : asPath}` },
  ];

  return (
    <>
      <NextSeo
        title={pageTitle}
        titleTemplate="%s | Dopa Work"
        description={pageDesc}
        canonical={`${baseUrl}${asPath}`}
        languageAlternates={languageAlternates}
        additionalMetaTags={[
          { name: 'viewport', content: 'width=device-width, initial-scale=1' },
          { name: 'theme-color', content: '#1e3a5f' },
        ]}
        openGraph={{
          title: pageTitle,
          description: pageDesc,
          locale: isAr ? 'ar_JO' : 'en_JO',
          url: `${baseUrl}${asPath}`,
          type: 'website',
          siteName: 'Dopa Work',
          images: [{ url: `${baseUrl}/og-image.png`, width: 1200, height: 630, alt: 'Dopa Work' }],
        }}
        twitter={{
          handle: '@DopaWorkJO',
          site: '@DopaWorkJO',
          cardType: 'summary_large_image',
        }}
      />
      <div className="min-h-screen flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
        <Navbar />
        <main className={`flex-1 ${fullWidth ? '' : 'max-w-7xl mx-auto w-full px-4 sm:px-6 py-8'}`}>
          {children}
        </main>
        {!noFooter && <Footer />}
      </div>
    </>
  );
}
