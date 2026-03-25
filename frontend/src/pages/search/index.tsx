import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon, UserGroupIcon, BriefcaseIcon,
  BuildingOffice2Icon, XMarkIcon, MapPinIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '@/components/layout/Layout';
import RatingStars from '@/components/ui/RatingStars';
import Badge from '@/components/ui/Badge';
import { searchApi } from '@/services/api';
import { formatJOD } from '@/utils/currency';
import clsx from 'clsx';

type SearchTab = 'freelancers' | 'gigs' | 'projects';
const CITIES = ['amman', 'irbid', 'zarqa', 'aqaba', 'madaba', 'salt', 'karak', 'jerash'];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export default function SearchPage() {
  const { t } = useTranslation('common');
  const { locale, query: q } = useRouter();
  const isAr = locale === 'ar';

  const [tab, setTab]         = useState<SearchTab>('freelancers');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    keyword: (q.keyword as string) || '',
    city: '', min_rate: '', max_rate: '', min_rating: '', available: false,
  });

  useEffect(() => { doSearch(); }, [tab, filters]);

  async function doSearch() {
    setLoading(true);
    try {
      let res;
      if (tab === 'freelancers') res = await searchApi.freelancers(filters);
      else if (tab === 'gigs') res = await searchApi.gigs(filters);
      else res = await searchApi.projects(filters);
      const d = res.data?.data ?? res.data;
      setResults(Array.isArray(d) ? d : d?.data ?? d?.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFilters({ keyword: '', city: '', min_rate: '', max_rate: '', min_rating: '', available: false });
  }

  const TAB_CONFIG: { id: SearchTab; labelEn: string; labelAr: string; Icon: any }[] = [
    { id: 'freelancers', labelEn: t('search.freelancers'), labelAr: 'المستقلون',  Icon: UserGroupIcon    },
    { id: 'gigs',        labelEn: t('search.gigs'),        labelAr: 'الخدمات',    Icon: BriefcaseIcon   },
    { id: 'projects',    labelEn: t('search.projects'),    labelAr: 'المشاريع',   Icon: BuildingOffice2Icon },
  ];

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v1', '');

  return (
    <Layout title="Search" titleAr="بحث" fullWidth>
      <div className="section-container py-8">

        {/* ── Search header ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900 mb-4">{t('search.title')}</h1>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              placeholder={isAr ? 'ابحث عن مستقلين، خدمات، مشاريع...' : 'Search freelancers, services, projects...'}
              className="w-full ps-12 pe-4 py-4 rounded-2xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TAB_CONFIG.map(({ id, labelEn, labelAr, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all',
                tab === id
                  ? 'bg-primary-700 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700',
              )}
            >
              <Icon className="w-4 h-4" />
              {isAr ? labelAr : labelEn}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* ── Sidebar filters ── */}
          <aside className="w-52 shrink-0 hidden sm:block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-5 sticky top-24">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('search.city')}</p>
                <select className="input text-sm" value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}>
                  <option value="">{t('common.all')}</option>
                  {CITIES.map((c) => <option key={c} value={c}>{t(`cities.${c}`)}</option>)}
                </select>
              </div>

              {tab === 'freelancers' && (
                <>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('search.min_rate')}</p>
                    <input type="number" className="input text-sm" value={filters.min_rate}
                      onChange={(e) => setFilters({ ...filters, min_rate: e.target.value })} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('search.max_rate')}</p>
                    <input type="number" className="input text-sm" value={filters.max_rate}
                      onChange={(e) => setFilters({ ...filters, max_rate: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={filters.available}
                      onChange={(e) => setFilters({ ...filters, available: e.target.checked })}
                      className="w-4 h-4 rounded accent-primary-600" />
                    <span className="text-gray-700">{t('search.available_only')}</span>
                  </label>
                </>
              )}

              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('search.min_rating')}</p>
                <div className="space-y-1">
                  {['', '4', '3', '2'].map((r) => (
                    <button key={r} onClick={() => setFilters({ ...filters, min_rating: r })}
                      className={clsx('w-full text-start px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition',
                        filters.min_rating === r ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50')}>
                      {r ? <><StarSolid className="w-3.5 h-3.5 text-amber-400" />{r}+ {isAr ? 'نجوم' : 'stars'}</> : t('common.all')}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={reset} className="btn btn-ghost btn-sm w-full">
                <XMarkIcon className="w-3.5 h-3.5" /> {t('search.reset')}
              </button>
            </div>
          </aside>

          {/* ── Results ── */}
          <div className="flex-1 min-w-0">
            {/* Result count */}
            {!loading && results.length > 0 && (
              <p className="text-sm text-gray-500 mb-4">
                {results.length} {isAr ? 'نتيجة' : 'results'}
                {filters.keyword && <span className="font-semibold text-gray-700"> "{filters.keyword}"</span>}
              </p>
            )}

            {loading ? (
              <div className={tab === 'freelancers' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-3'}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                    <div className="skeleton h-4 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <MagnifyingGlassIcon className="w-14 h-14 text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">{t('common.no_data')}</p>
                <p className="text-sm text-gray-400 mt-1">{isAr ? 'جرب كلمات مختلفة' : 'Try different keywords'}</p>
              </div>
            ) : tab === 'freelancers' ? (
              <motion.div initial="hidden" animate="show" variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((f) => (
                  <motion.div key={f.id} variants={fadeUp}>
                    <FreelancerCard f={f} isAr={isAr} t={t} apiBase={apiBase} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3">
                {results.map((item) => (
                  <motion.div key={item.id} variants={fadeUp}>
                    <Link href={`/${tab === 'gigs' ? 'gigs' : 'projects'}/${item.id}`}
                      className="group block bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all p-4">
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors mb-1">
                        {isAr ? item.title_ar || item.title_en : item.title_en}
                      </h3>
                      {item.description_en && (
                        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{item.description_en}</p>
                      )}
                      {tab === 'gigs' && (
                        <p className="text-primary-700 font-bold text-sm mt-2">
                          {formatJOD(item.basic_price || item.price)}
                        </p>
                      )}
                      {tab === 'projects' && item.status && (
                        <div className="mt-2"><Badge status={item.status} /></div>
                      )}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Freelancer Card ────────────────────────────────────────────────────────

function FreelancerCard({ f, isAr, t, apiBase }: { f: any; isAr: boolean; t: any; apiBase: string }) {
  const name = isAr ? f.full_name_ar || f.full_name_en : f.full_name_en;
  const title = isAr ? f.professional_title_ar || f.professional_title_en : f.professional_title_en;
  const avatarSrc = f.avatar_url ? (f.avatar_url.startsWith('http') ? f.avatar_url : `${apiBase}${f.avatar_url}`) : null;

  return (
    <Link href={`/profile/${f.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all duration-200 p-4">
      <div className="flex items-start gap-3 mb-3">
        {avatarSrc
          ? <img src={avatarSrc} className="w-12 h-12 rounded-xl object-cover ring-2 ring-gray-100 flex-shrink-0" alt="" />
          : <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-lg">{(name || 'F')[0]?.toUpperCase()}</span>
            </div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 group-hover:text-primary-700 transition-colors truncate">{name}</p>
          <p className="text-xs text-gray-500 truncate">{title}</p>
          {(f.avg_rating ?? 0) > 0 && (
            <div className="mt-1">
              <RatingStars rating={f.avg_rating || 0} count={f.review_count} size="sm" />
            </div>
          )}
        </div>
        {f.hourly_rate && (
          <span className="text-sm font-bold text-primary-700 shrink-0">{formatJOD(f.hourly_rate)}/hr</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {f.city && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MapPinIcon className="w-3 h-3" />
            {t(`cities.${f.city}`)}
          </span>
        )}
        <div className="flex flex-wrap gap-1">
          {(isAr ? f.skills_ar : f.skills_en)?.slice(0, 3).map((s: string, i: number) => (
            <span key={i} className="badge badge-green text-xs">{s}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
