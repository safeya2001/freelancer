import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  StarIcon as StarOutline,
  CodeBracketIcon,
  PaintBrushIcon,
  LanguageIcon,
  MegaphoneIcon,
  FilmIcon,
  PencilSquareIcon,
  TableCellsIcon,
  DevicePhoneMobileIcon,
  BriefcaseIcon,
  LockClosedIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  ArrowLongRightIcon,
  UserGroupIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import Layout from '@/components/layout/Layout';
import { gigsApi } from '@/services/api';
import { formatJOD } from '@/utils/currency';
import clsx from 'clsx';

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: 'web-development',  Icon: CodeBracketIcon,       en: 'Web Development',   ar: 'تطوير الويب',           gradient: 'from-blue-500 to-indigo-600',   light: 'bg-blue-50 text-blue-600'   },
  { slug: 'graphic-design',   Icon: PaintBrushIcon,        en: 'Graphic Design',    ar: 'التصميم الجرافيكي',     gradient: 'from-pink-500 to-rose-600',     light: 'bg-pink-50 text-pink-600'   },
  { slug: 'translation',      Icon: LanguageIcon,          en: 'Translation',       ar: 'الترجمة',               gradient: 'from-violet-500 to-purple-600', light: 'bg-violet-50 text-violet-600'},
  { slug: 'marketing',        Icon: MegaphoneIcon,         en: 'Marketing',         ar: 'التسويق',               gradient: 'from-orange-400 to-orange-600', light: 'bg-orange-50 text-orange-600'},
  { slug: 'video-editing',    Icon: FilmIcon,              en: 'Video Editing',     ar: 'مونتاج الفيديو',        gradient: 'from-red-500 to-rose-700',      light: 'bg-red-50 text-red-600'     },
  { slug: 'content-writing',  Icon: PencilSquareIcon,      en: 'Content Writing',   ar: 'كتابة المحتوى',         gradient: 'from-emerald-500 to-green-600', light: 'bg-emerald-50 text-emerald-600'},
  { slug: 'data-entry',       Icon: TableCellsIcon,        en: 'Data Entry',        ar: 'إدخال البيانات',        gradient: 'from-cyan-500 to-teal-600',     light: 'bg-cyan-50 text-cyan-600'   },
  { slug: 'mobile-apps',      Icon: DevicePhoneMobileIcon, en: 'Mobile Apps',       ar: 'تطبيقات الموبايل',      gradient: 'from-primary-500 to-primary-700', light: 'bg-primary-50 text-primary-600'},
];

const POPULAR_SEARCHES = {
  en: ['Web Design', 'Logo Design', 'Translation', 'WordPress', 'Social Media'],
  ar: ['تصميم مواقع', 'تصميم شعار', 'ترجمة', 'ووردبريس', 'سوشيال ميديا'],
};


const VALUE_PROPS = [
  { Icon: ShieldCheckIcon,        titleEn: 'Verified Freelancers',     titleAr: 'مستقلون موثقون',          descEn: 'Every freelancer is vetted and rated by real clients.',                    descAr: 'كل مستقل تم التحقق منه وتقييمه من قِبل عملاء حقيقيين.' },
  { Icon: LockClosedIcon,         titleEn: 'Escrow Protection',        titleAr: 'حماية بالضمان',           descEn: 'Your payment is held safely until you approve the work.',                  descAr: 'دفعتك محفوظة بأمان حتى تعتمد العمل.' },
  { Icon: ChatBubbleLeftRightIcon, titleEn: 'Real-time Messaging',     titleAr: 'مراسلة فورية',            descEn: 'Chat directly with freelancers — built-in and instant.',                   descAr: 'تواصل مباشرةً مع المستقلين — مدمج وفوري.' },
  { Icon: ClockIcon,              titleEn: 'On-time Delivery',         titleAr: 'تسليم في الوقت',          descEn: 'Milestone tracking keeps every project on schedule.',                      descAr: 'تتبع المراحل يبقي كل مشروع في موعده.' },
];

// ─── Animation helpers ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.1 } },
};


// ─── Gig card ──────────────────────────────────────────────────────────────

type Gig = {
  id: string;
  title_en: string;
  title_ar?: string;
  price?: number;
  gallery_urls?: string[];
  freelancer_id?: string;
  avg_rating?: number;
  review_count?: number;
  freelancer_name?: string;
  freelancer_avatar?: string;
};

function GigCard({ gig, isAr, apiBase }: { gig: Gig; isAr: boolean; apiBase: string }) {
  const title = isAr ? (gig.title_ar || gig.title_en) : gig.title_en;
  const thumb = gig.gallery_urls?.[0];
  const imgSrc = thumb ? (thumb.startsWith('http') ? thumb : `${apiBase}${thumb}`) : null;
  const rating = gig.avg_rating ? Number(gig.avg_rating).toFixed(1) : null;

  return (
    <Link href={`/gigs/${gig.id}`} className="gig-card group block">
      {/* Image */}
      <div className="relative w-full aspect-video bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden">
        {imgSrc ? (
          <img src={imgSrc} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <BriefcaseIcon className="w-10 h-10 text-primary-400" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Freelancer */}
        <div className="flex items-center gap-2 mb-2">
          {gig.freelancer_avatar ? (
            <img src={gig.freelancer_avatar.startsWith('http') ? gig.freelancer_avatar : `${apiBase}${gig.freelancer_avatar}`}
              className="w-6 h-6 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-primary-700 text-xs font-bold">
                {(gig.freelancer_name || 'F')[0].toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs text-gray-500 truncate">{gig.freelancer_name || (isAr ? 'مستقل' : 'Freelancer')}</span>
          {rating && (
            <span className="flex items-center gap-0.5 ms-auto text-xs font-semibold text-amber-600">
              <StarSolid className="w-3 h-3 text-amber-400" />
              {rating}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2 mb-3 group-hover:text-primary-700 transition-colors">
          {title}
        </p>

        {/* Price */}
        <div className="flex items-center justify-between border-t border-gray-50 pt-3">
          <span className="text-xs text-gray-400">{isAr ? 'يبدأ من' : 'Starting at'}</span>
          <span className="text-base font-bold text-primary-700">
            {gig.price != null ? formatJOD(gig.price, isAr ? 'ar' : 'en') : '—'}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation('common');
  const { locale, push } = useRouter();
  const isAr = locale === 'ar';
  const [search, setSearch] = useState('');
  const [featuredGigs, setFeaturedGigs] = useState<Gig[]>([]);
  const [gigsLoading, setGigsLoading] = useState(true);

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');

  // Stats animation

  useEffect(() => {
    gigsApi.list({ limit: 6, page: 1 })
      .then((res) => {
        const data = res.data?.data ?? res.data;
        const items = Array.isArray(data) ? data : data?.data ?? data?.items ?? data?.gigs ?? [];
        setFeaturedGigs(items.slice(0, 6));
      })
      .catch(() => setFeaturedGigs([]))
      .finally(() => setGigsLoading(false));

  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) push(`/search?keyword=${encodeURIComponent(search.trim())}`);
  }

  const popularSearches = isAr ? POPULAR_SEARCHES.ar : POPULAR_SEARCHES.en;

  return (
    <Layout
      title="Jordan's Freelance Marketplace — Dopa Work"
      titleAr="دوبا ووك — سوق العمل الحر الأردني"
      fullWidth
    >

      {/* ═══════════════════════════════════════════════════════════════════
          1. HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600">

        {/* Decorative blobs */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -start-32 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -end-24 w-[420px] h-[420px] rounded-full bg-primary-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-white/[0.03]" />

        <div className="section-container relative z-10 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: text + search */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            >
              {/* Label pill */}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-primary-200 text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {isAr ? 'السوق الأول للمستقلين في الأردن' : "Jordan's #1 Freelance Marketplace"}
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-black text-white leading-[1.12] tracking-tight mb-5">
                {t('home.hero_title')}
              </h1>
              <p className="text-primary-200 text-lg leading-relaxed mb-8 max-w-lg">
                {t('home.hero_subtitle')}
              </p>

              {/* Search bar */}
              <form onSubmit={handleSearch} className="flex gap-2 bg-white rounded-2xl shadow-2xl p-2 mb-5">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('home.search_placeholder')}
                    className="w-full h-full ps-10 pe-3 py-2.5 text-gray-900 text-sm bg-transparent focus:outline-none placeholder:text-gray-400"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary-700 hover:bg-primary-800 active:scale-95 transition-all text-white font-semibold text-sm px-5 py-2.5 rounded-xl"
                >
                  {t('home.search_btn')}
                </button>
              </form>

              {/* Popular searches */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-primary-300 text-xs">{isAr ? 'الأكثر بحثاً:' : 'Popular:'}</span>
                {popularSearches.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => push(`/search?keyword=${encodeURIComponent(tag)}`)}
                    className="text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1 rounded-full transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Right: visual floating cards — desktop only */}
            <motion.div
              initial={{ opacity: 0, x: isAr ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="hidden lg:block relative h-80"
            >
              {/* Background image card */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=700&q=80&auto=format&fit=crop"
                  alt={isAr ? 'مستقل يعمل على جهازه' : 'Freelancer working professionally'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary-900/60 via-transparent to-transparent" />
              </div>

              {/* Trust indicators */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
                className="absolute -top-4 -start-6 bg-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <ShieldCheckIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900">{isAr ? 'مستقلون موثقون' : 'Verified Freelancers'}</p>
                  <p className="text-[10px] text-green-500 font-semibold">{isAr ? '● ابدأ الآن' : '● Get started'}</p>
                </div>
              </motion.div>

              {/* Floating: escrow badge */}
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-4 -end-4 bg-white rounded-2xl px-4 py-3 shadow-xl max-w-[200px]"
              >
                <div className="flex items-center gap-2">
                  <LockClosedIcon className="w-5 h-5 text-primary-600" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">{isAr ? 'دفع بالضمان' : 'Escrow Protection'}</p>
                    <p className="text-[10px] text-gray-500">{isAr ? 'أموالك محمية' : 'Your funds are safe'}</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating: JOD badge */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut', delay: 0.5 }}
                className="absolute top-1/2 -end-6 -translate-y-1/2 bg-white rounded-2xl px-4 py-3 shadow-xl text-center"
              >
                <p className="text-2xl font-black text-primary-700">🇯🇴</p>
                <p className="text-xs font-bold text-gray-900 mt-1">{isAr ? 'بالدينار' : 'JOD'}</p>
                <p className="text-[10px] text-gray-500">{isAr ? 'السوق الأردني' : 'Jordan Market'}</p>
              </motion.div>
            </motion.div>

          </div>
        </div>

        {/* Trust badges strip at bottom of hero */}
        <div className="border-t border-white/10 bg-black/20 backdrop-blur-sm">
          <div className="section-container py-4">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
              {[
                { icon: '✅', en: 'Verified Freelancers', ar: 'مستقلون موثقون' },
                { icon: '🔒', en: 'Escrow Payments',      ar: 'دفع بالضمان'    },
                { icon: '🇯🇴', en: 'Jordan Market',        ar: 'السوق الأردني'  },
                { icon: '💰', en: 'JOD Currency',          ar: 'بالدينار الأردني'},
              ].map((b) => (
                <span key={b.en} className="flex items-center gap-1.5 text-sm text-white/80 font-medium">
                  {b.icon} {isAr ? b.ar : b.en}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════
          3. CATEGORIES
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-20">
        <div className="section-container">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-black text-gray-900 mb-2">{t('home.popular_categories')}</h2>
              <p className="text-gray-500">{isAr ? 'اكتشف آلاف الخدمات في كل المجالات' : 'Explore thousands of services across every field'}</p>
            </motion.div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {CATEGORIES.map((cat) => (
                <motion.div key={cat.slug} variants={fadeUp}>
                  <Link href={`/gigs?category_slug=${cat.slug}`} className="cat-card group">
                    {/* Icon circle with gradient */}
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                      <cat.Icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 text-center leading-snug">
                      {isAr ? cat.ar : cat.en}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          4. HOW IT WORKS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="section-container">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-14">
              <h2 className="text-3xl font-black text-gray-900 mb-2">{t('home.how_it_works')}</h2>
              <p className="text-gray-500">{isAr ? 'ابدأ في دقائق — سهل وآمن وسريع' : 'Get started in minutes — simple, secure, fast'}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting dashed line (desktop) */}
              <div className="hidden md:block absolute top-10 start-[calc(16.67%+1.5rem)] end-[calc(16.67%+1.5rem)] h-px border-t-2 border-dashed border-primary-200 z-0" />

              {[
                { num: '01', Icon: MagnifyingGlassIcon, titleKey: 'step1_title', descKey: 'step1_desc', color: 'from-blue-500 to-indigo-600' },
                { num: '02', Icon: LockClosedIcon,       titleKey: 'step2_title', descKey: 'step2_desc', color: 'from-primary-500 to-primary-700' },
                { num: '03', Icon: StarOutline,          titleKey: 'step3_title', descKey: 'step3_desc', color: 'from-amber-400 to-orange-500' },
              ].map((step) => (
                <motion.div key={step.num} variants={fadeUp} className="relative z-10 text-center">
                  {/* Number circle */}
                  <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex flex-col items-center justify-center mx-auto mb-5 shadow-md`}>
                    <step.Icon className="w-8 h-8 text-white" />
                    <span className="text-white/70 text-[10px] font-bold mt-0.5">{step.num}</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{t(`home.${step.titleKey}`)}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">{t(`home.${step.descKey}`)}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          5. FEATURED GIGS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-20">
        <div className="section-container">
          {/* Header */}
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="flex items-end justify-between mb-10 gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-1">
                  {isAr ? 'خدمات مميزة' : 'Popular Services'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {isAr ? 'أعمال احترافية جاهزة للطلب الآن' : 'Professional work ready to order right now'}
                </p>
              </div>
              <Link
                href="/gigs"
                className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-900 transition-colors group"
              >
                {isAr ? 'عرض الكل' : 'View all'}
                <ArrowLongRightIcon className={clsx('w-4 h-4 transition-transform group-hover:translate-x-1', isAr && 'rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0')} />
              </Link>
            </motion.div>

            {/* Grid */}
            {gigsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
            ) : featuredGigs.length > 0 ? (
              <motion.div
                variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {featuredGigs.map((gig) => (
                  <motion.div key={gig.id} variants={fadeUp}>
                    <GigCard gig={gig} isAr={isAr} apiBase={apiBase} />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-16">
                <BriefcaseIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{isAr ? 'لا توجد خدمات حالياً' : 'No gigs yet'}</p>
                <Link href="/gigs/create" className="btn btn-primary mt-4">
                  {isAr ? 'أنشئ أول خدمة' : 'Create the First Gig'}
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          6. VALUE PROPS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-primary-900 py-20">
        <div className="section-container">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-black text-white mb-2">
                {isAr ? 'لماذا دوبا ووك؟' : 'Why Dopa Work?'}
              </h2>
              <p className="text-primary-300">
                {isAr ? 'نبني الثقة بين الموهبة والفرصة' : 'We build trust between talent and opportunity'}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALUE_PROPS.map(({ Icon, titleEn, titleAr, descEn, descAr }) => (
                <motion.div
                  key={titleEn}
                  variants={fadeUp}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary-700 border border-primary-600 flex items-center justify-center mb-4 group-hover:bg-primary-600 transition-colors">
                    <Icon className="w-6 h-6 text-primary-200" />
                  </div>
                  <h3 className="font-bold text-white mb-1.5">{isAr ? titleAr : titleEn}</h3>
                  <p className="text-sm text-primary-300 leading-relaxed">{isAr ? descAr : descEn}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          7. DUAL CTA
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-20">
        <div className="section-container">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <h2 className="text-3xl font-black text-gray-900">
                {isAr ? 'ابدأ رحلتك اليوم' : 'Start Your Journey Today'}
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Freelancer CTA */}
              <motion.div
                variants={fadeUp}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 to-primary-900 p-8 text-white shadow-xl"
              >
                <div aria-hidden className="absolute -bottom-10 -end-10 w-40 h-40 rounded-full bg-white/5" />
                <div aria-hidden className="absolute -top-8 -start-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-5">
                    <BoltIcon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-black mb-2">{isAr ? 'هل أنت مستقل؟' : 'Are You a Freelancer?'}</h3>
                  <p className="text-primary-200 text-sm mb-6 leading-relaxed">
                    {isAr
                      ? 'عرض خدماتك لآلاف العملاء في الأردن وابدأ بالكسب اليوم.'
                      : 'Showcase your skills to thousands of clients in Jordan and start earning today.'}
                  </p>
                  <Link href="/auth/register?role=freelancer"
                    className="inline-flex items-center gap-2 bg-white text-primary-800 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-primary-50 transition-colors group-hover:shadow-lg">
                    {isAr ? 'انضم كمستقل' : 'Join as Freelancer'}
                    <ArrowLongRightIcon className={clsx('w-4 h-4', isAr && 'rotate-180')} />
                  </Link>
                </div>
              </motion.div>

              {/* Client CTA */}
              <motion.div
                variants={fadeUp}
                className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 p-8 text-white shadow-xl"
              >
                <div aria-hidden className="absolute -bottom-10 -end-10 w-40 h-40 rounded-full bg-white/5" />
                <div aria-hidden className="absolute -top-8 -start-8 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-5">
                    <UserGroupIcon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-black mb-2">{isAr ? 'تبحث عن موهبة؟' : 'Looking for Talent?'}</h3>
                  <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                    {isAr
                      ? 'انشر مشروعك وتلقَّ عروضاً من أفضل المستقلين الأردنيين خلال دقائق.'
                      : 'Post your project and receive proposals from top Jordanian freelancers in minutes.'}
                  </p>
                  <Link href="/auth/register?role=client"
                    className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100 transition-colors group-hover:shadow-lg">
                    {isAr ? 'وظّف مستقلاً' : 'Hire a Freelancer'}
                    <ArrowLongRightIcon className={clsx('w-4 h-4', isAr && 'rotate-180')} />
                  </Link>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
