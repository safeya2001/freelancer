import { GetServerSideProps } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dopawork.jo';

function generateSiteMap() {
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/gigs', priority: '0.9', changefreq: 'hourly' },
    { url: '/projects', priority: '0.9', changefreq: 'hourly' },
    { url: '/search', priority: '0.8', changefreq: 'daily' },
    { url: '/auth/login', priority: '0.5', changefreq: 'monthly' },
    { url: '/auth/register', priority: '0.6', changefreq: 'monthly' },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${BASE_URL}/ar${page.url}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}/en${page.url}"/>
  </url>`,
    )
    .join('')}
</urlset>`;
}

export default function Sitemap() {
  // getServerSideProps handles the response
  return null;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const sitemap = generateSiteMap();
  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(sitemap);
  res.end();
  return { props: {} };
};
