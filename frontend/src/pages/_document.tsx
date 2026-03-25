import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="ar">
      <Head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#2D6A4F" />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Freelance.JO" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="canonical" href="https://freelance.jo" />
        {/* Bilingual alternate links */}
        <link rel="alternate" hrefLang="ar" href="https://freelance.jo/ar" />
        <link rel="alternate" hrefLang="en" href="https://freelance.jo/en" />
        <link rel="alternate" hrefLang="x-default" href="https://freelance.jo" />
        {/* XML sitemap */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
