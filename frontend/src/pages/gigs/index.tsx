import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon, AdjustmentsHorizontalIcon, MagnifyingGlassIcon,
  XMarkIcon, PlusIcon, BriefcaseIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '@/components/layout/Layout';
import RatingStars from '@/components/ui/RatingStars';
import { gigsApi, usersApi } from '@/services/api';
import { Gig, Category } from '@/types';
import { formatJOD } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export default function GigsPage() {
  const { t } = useTranslation('common');
  const { locale, query } = useRouter();
  const isAr = locale === 'ar';
  const { isFreelancer } = useAuth();

  const [gigs, setGigs]           = useState<Gig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters]     = useState({
    category_id: (query.category_id as string) || '',
    min_price: '',
    max_price: '',
    min_rating: '',
    search: (query.keyword as string) || '',
    page: 1,
  });

  useEffect(() => {
    usersApi.getCategories()
      .then((r) => setCategories(r.data.data ?? r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadGigs(); }, [filters]);

  async function loadGigs() {
    setLoading(true);
    setError(false);
    try {
      // Sanitize filters: strip empty strings to avoid sending NaN to backend
      const sanitized: any = { ...filters, limit: 12 };
      if (!sanitized.min_price || sanitized.min_price === '') delete sanitized.min_price;
      if (!sanitized.max_price || sanitized.max_price === '') delete sanitized.max_price;
      if (!sanitized.min_rating || sanitized.min_rating === '') delete sanitized.min_rating;
      if (!sanitized.category_id || sanitized.category_id === '') delete sanitized.category_id;
      if (!sanitized.search || sanitized.search === '') delete sanitized.search;
      const res = await gigsApi.list(sanitized);
      const d = res.data?.data ?? res.data;
      setGigs(Array.isArray(d) ? d : d?.data ?? d?.gigs ?? []);
      setTotal(d?.total ?? d?.count ?? 0);
    } catch {
      setError(true);
      setGigs([]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFilters({ category_id: '', min_price: '', max_price: '', min_rating: '', search: '', page: 1 });
  }

  const pages = Math.max(1, Math.ceil(total / 12));
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v1', '');

  const FilterPanel = () => (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('gigs.filter_category')}</p>
        <div className="space-y-1">
          <button
            onClick={() => setFilters({ ...filters, category_id: '', page: 1 })}
            className={clsx('w-full text-start px-3 py-2 rounded-lg text-sm transition',
              !filters.category_id ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50')}
          >
            {t('common.all')}
          </button>
          {categories.map((c) => (
            <button key={c.id}
              onClick={() => setFilters({ ...filters, category_id: c.id, page: 1 })}
              className={clsx('w-full text-start px-3 py-2 rounded-lg text-sm transition',
                filters.category_id === c.id ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50')}
            >
              {isAr ? c.name_ar : c.name_en}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('gigs.filter_price')}</p>
        <div className="flex gap-2">
          <input type="number" placeholder={isAr ? 'من' : 'Min'} className="input flex-1"
            value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value, page: 1 })} />
          <input type="number" placeholder={isAr ? 'إلى' : 'Max'} className="input flex-1"
            value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value, page: 1 })} />
        </div>
      </div>

      {/* Rating */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('gigs.filter_rating')}</p>
        <div className="space-y-1">
          <button onClick={() => setFilters({ ...filters, min_rating: '', page: 1 })}
            className={clsx('w-full text-start px-3 py-2 rounded-lg text-sm transition',
              !filters.min_rating ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50')}>
            {t('common.all')}
          </button>
          {[4, 3, 2].map((r) => (
            <button key={r} onClick={() => setFilters({ ...filters, min_rating: String(r), page: 1 })}
              className={clsx('w-full text-start px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition',
                filters.min_rating === String(r) ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-600 hover:bg-gray-50')}>
              <StarSolid className="w-3.5 h-3.5 text-amber-400" />
              {r}+ {t('common.stars') ?? 'Stars'}
            </button>
          ))}
        </div>
      </div>

      <button onClick={reset} className="btn btn-ghost btn-sm w-full">
        <XMarkIcon className="w-3.5 h-3.5" /> {t('search.reset')}
      </button>
    </div>
  );

  return (
    <Layout title="Browse Gigs" titleAr="تصفح الخدمات" fullWidth>
      <div className="section-container py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{t('gigs.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total > 0 ? `${total.toLocaleString()} ${isAr ? 'خدمة' : 'services available'}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFreelancer && (
              <Link href="/gigs/create" className="btn btn-primary btn-sm">
                <PlusIcon className="w-4 h-4" /> {t('gigs.create_gig')}
              </Link>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden btn btn-ghost btn-sm">
              <AdjustmentsHorizontalIcon className="w-4 h-4" />
              {isAr ? 'الفلاتر' : 'Filters'}
            </button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="relative mb-6">
          <MagnifyingGlassIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            placeholder={isAr ? 'ابحث في الخدمات...' : 'Search services...'}
            className="w-full ps-11 pe-4 py-3.5 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-sm"
          />
        </div>

        <div className="flex gap-6">
          {/* ── Desktop Sidebar ── */}
          <aside className="hidden lg:block w-52 shrink-0">
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <FilterPanel />
            </div>
          </aside>

          {/* ── Mobile drawer overlay ── */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setSidebarOpen(false)}>
              <div className="absolute inset-0 bg-black/40" />
              <div
                className={clsx('absolute top-0 bottom-0 bg-white w-72 shadow-2xl p-5 overflow-y-auto', isAr ? 'right-0' : 'left-0')}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <p className="font-bold">{isAr ? 'الفلاتر' : 'Filters'}</p>
                  <button onClick={() => setSidebarOpen(false)}><XMarkIcon className="w-5 h-5" /></button>
                </div>
                <FilterPanel />
              </div>
            </div>
          )}

          {/* ── Gig Grid ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden bg-white border border-gray-100">
                    <div className="skeleton aspect-video" />
                    <div className="p-4 space-y-2">
                      <div className="skeleton h-3 w-1/3 rounded" />
                      <div className="skeleton h-4 w-5/6 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <BriefcaseIcon className="w-14 h-14 text-red-200 mb-4" />
                <p className="text-red-500 font-medium">{isAr ? 'فشل تحميل الخدمات، حاول مجدداً' : 'Failed to load gigs. Please try again.'}</p>
                <button onClick={loadGigs} className="btn btn-ghost btn-sm mt-3">
                  {isAr ? 'إعادة المحاولة' : 'Retry'}
                </button>
              </div>
            ) : gigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <BriefcaseIcon className="w-14 h-14 text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">{t('gigs.no_gigs')}</p>
                <button onClick={reset} className="btn btn-ghost btn-sm mt-3">
                  {isAr ? 'مسح الفلاتر' : 'Clear filters'}
                </button>
              </div>
            ) : (
              <motion.div
                initial="hidden" animate="show" variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
              >
                {gigs.map((gig) => (
                  <motion.div key={gig.id} variants={fadeUp}>
                    <GigCard gig={gig} isAr={isAr} t={t} apiBase={apiBase} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* ── Pagination ── */}
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setFilters({ ...filters, page: p })}
                    className={clsx(
                      'w-9 h-9 rounded-xl text-sm font-semibold transition-all',
                      filters.page === p
                        ? 'bg-primary-700 text-white shadow-sm'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-700',
                    )}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Gig Card ──────────────────────────────────────────────────────────────

function GigCard({ gig, isAr, t, apiBase }: { gig: Gig; isAr: boolean; t: any; apiBase: string }) {
  const price = (gig as any).basic_price ?? gig.price ?? 0;
  const thumb = gig.gallery_urls?.[0];
  const imgSrc = thumb ? (thumb.startsWith('http') ? thumb : `${apiBase}${thumb}`) : null;
  const freelancerAvatar = (gig as any).freelancer_avatar;
  const avatarSrc = freelancerAvatar ? (freelancerAvatar.startsWith('http') ? freelancerAvatar : `${apiBase}${freelancerAvatar}`) : null;
  const freelancerName = isAr ? ((gig as any).freelancer_name_ar || (gig as any).freelancer_name_en) : (gig as any).freelancer_name_en;

  return (
    <Link href={`/gigs/${gig.id}`} className="gig-card group block">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden">
        {imgSrc
          ? <img src={imgSrc} alt={gig.title_en} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="flex items-center justify-center h-full"><BriefcaseIcon className="w-10 h-10 text-primary-300" /></div>
        }
      </div>

      <div className="p-4">
        {/* Freelancer row */}
        <div className="flex items-center gap-2 mb-2">
          {avatarSrc
            ? <img src={avatarSrc} className="w-6 h-6 rounded-full object-cover ring-1 ring-gray-100" alt="" />
            : <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 text-[10px] font-bold">
                  {(freelancerName || 'F')[0]?.toUpperCase()}
                </span>
              </div>
          }
          <span className="text-xs text-gray-500 truncate flex-1">{freelancerName || (isAr ? 'مستقل' : 'Freelancer')}</span>
          {(gig.avg_rating ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
              <StarSolid className="w-3 h-3 text-amber-400" />
              {Number(gig.avg_rating).toFixed(1)}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2 leading-snug group-hover:text-primary-700 transition-colors">
          {isAr ? gig.title_ar || gig.title_en : gig.title_en}
        </p>

        {/* Rating stars (if any) */}
        {(gig.review_count ?? 0) > 0 && (
          <div className="mb-2">
            <RatingStars rating={gig.avg_rating || 0} count={gig.review_count} size="sm" />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <ClockIcon className="w-3.5 h-3.5" />
            {gig.delivery_days} {t('gigs.days')}
          </span>
          <span className="text-sm font-bold text-primary-700">
            {t('gigs.starting_at')} {formatJOD(price, isAr ? 'ar' : 'en')}
          </span>
        </div>
      </div>
    </Link>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
