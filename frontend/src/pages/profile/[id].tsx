import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import RatingStars from '@/components/ui/RatingStars';
import { usersApi, gigsApi, reviewsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';
import {
  MapPinIcon, CheckBadgeIcon, ClockIcon,
} from '@heroicons/react/24/solid';
import {
  ChatBubbleLeftIcon, PencilSquareIcon, BriefcaseIcon,
  StarIcon, UserCircleIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

export default function ProfilePage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;
  const { locale } = router;
  const isAr = locale === 'ar';
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [gigs, setGigs]       = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'gigs' | 'reviews'>('gigs');

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v1', '');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      usersApi.getProfile(id as string),
      gigsApi.byFreelancer(id as string),
      reviewsApi.getFreelancerReviews(id as string),
    ]).then(([p, g, r]) => {
      setProfile(p.data.data);
      setGigs(g.data.data ?? []);
      setReviews(r.data.data ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout title="Profile">
        <div className="section-container py-10 space-y-4">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout title="Not Found">
        <div className="section-container py-24 flex flex-col items-center text-center">
          <UserCircleIcon className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-xl font-bold text-gray-700">{isAr ? 'المستخدم غير موجود' : 'User not found'}</p>
        </div>
      </Layout>
    );
  }

  const isOwnProfile = me?.id === profile.user_id;
  const name    = isAr ? profile.full_name_ar || profile.full_name_en : profile.full_name_en;
  const tagline = isAr
    ? profile.professional_title_ar || profile.professional_title_en
    : profile.professional_title_en;
  const bio     = isAr ? profile.bio_ar || profile.bio_en : profile.bio_en;
  const avatarSrc = profile.avatar_url
    ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `${apiBase}${profile.avatar_url}`)
    : null;

  return (
    <Layout title={name} titleAr={profile.full_name_ar} fullWidth>
      {/* ── Hero Banner ── */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white">
        <div className="section-container py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              {avatarSrc
                ? <img src={avatarSrc} alt={name} className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white/20 shadow-lg" />
                : <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                    <span className="text-white font-black text-4xl">{name?.[0]?.toUpperCase()}</span>
                  </div>
              }
              {profile.identity_verified === 'verified' && (
                <div className="absolute -bottom-1 -end-1 bg-white rounded-full p-0.5 shadow">
                  <CheckBadgeIcon className="w-5 h-5 text-primary-600" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-black">{name}</h1>
                {profile.identity_verified === 'verified' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-white/20 text-white rounded-full uppercase tracking-wider">
                    {isAr ? 'موثق' : 'Verified'}
                  </span>
                )}
              </div>
              {tagline && <p className="text-primary-200 text-sm mb-3">{tagline}</p>}

              <div className="flex flex-wrap items-center gap-4 text-sm text-primary-200">
                {profile.avg_rating > 0 && (
                  <span className="flex items-center gap-1.5">
                    <StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="font-bold text-white">{Number(profile.avg_rating).toFixed(1)}</span>
                    <span>({profile.review_count || 0} {isAr ? 'تقييم' : 'reviews'})</span>
                  </span>
                )}
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPinIcon className="w-4 h-4" />
                    {t(`cities.${profile.city}`)}
                  </span>
                )}
                {profile.total_jobs_done > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircleIcon className="w-4 h-4" />
                    {profile.total_jobs_done} {isAr ? 'طلب مكتمل' : 'orders completed'}
                  </span>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="shrink-0">
              {isOwnProfile ? (
                <Link href="/dashboard" className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 rounded-xl font-semibold text-sm hover:bg-primary-50 transition-colors shadow">
                  <PencilSquareIcon className="w-4 h-4" />
                  {isAr ? 'تعديل الملف' : 'Edit Profile'}
                </Link>
              ) : (
                <Link href={`/messages/new?to=${profile.user_id}`}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 rounded-xl font-semibold text-sm hover:bg-primary-50 transition-colors shadow">
                  <ChatBubbleLeftIcon className="w-4 h-4" />
                  {isAr ? 'إرسال رسالة' : 'Send Message'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section-container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">

          {/* ── Left Sidebar ── */}
          <div className="space-y-5">
            {/* Stats */}
            <motion.div
              initial="hidden" animate="show" variants={fadeUp}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                {isAr ? 'الإحصائيات' : 'Statistics'}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { val: profile.total_jobs_done || 0, label_en: 'Completed', label_ar: 'مكتمل' },
                  { val: profile.review_count || 0,    label_en: 'Reviews',   label_ar: 'تقييم' },
                  { val: `${profile.response_rate || 100}%`, label_en: 'Response', label_ar: 'استجابة' },
                ].map((s) => (
                  <div key={s.label_en} className="text-center bg-gray-50 rounded-xl py-3">
                    <p className="text-lg font-black text-gray-800">{s.val}</p>
                    <p className="text-[10px] text-gray-400">{isAr ? s.label_ar : s.label_en}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Skills */}
            {profile.skills?.length > 0 && (
              <motion.div
                initial="hidden" animate="show" variants={fadeUp}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {isAr ? 'المهارات' : 'Skills'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s: any) => {
                    const key = s?.id || s;
                    const label = typeof s === 'string' ? s : (isAr ? s.name_ar || s.name_en : s.name_en);
                    return (
                      <span key={key} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-semibold">
                        {label}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Languages */}
            {profile.languages?.length > 0 && (
              <motion.div
                initial="hidden" animate="show" variants={fadeUp}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {isAr ? 'اللغات' : 'Languages'}
                </h3>
                <div className="space-y-1.5">
                  {profile.languages.map((l: string) => (
                    <p key={l} className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                      {l}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Main Content ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            {bio && (
              <motion.div
                initial="hidden" animate="show" variants={fadeUp}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
              >
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <UserCircleIcon className="w-5 h-5 text-primary-500" />
                  {isAr ? 'نبذة عني' : 'About Me'}
                </h2>
                <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-line">{bio}</p>
              </motion.div>
            )}

            {/* Tabs: Gigs / Reviews */}
            <div>
              <div className="flex border-b border-gray-200 mb-5">
                {[
                  { id: 'gigs',    labelEn: `Gigs (${gigs.length})`,       labelAr: `الخدمات (${gigs.length})`,      Icon: BriefcaseIcon },
                  { id: 'reviews', labelEn: `Reviews (${reviews.length})`,  labelAr: `التقييمات (${reviews.length})`, Icon: StarIcon      },
                ].map(({ id, labelEn, labelAr, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id as any)}
                    className={clsx(
                      'flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors',
                      tab === id
                        ? 'border-primary-600 text-primary-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {isAr ? labelAr : labelEn}
                  </button>
                ))}
              </div>

              {tab === 'gigs' && (
                gigs.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <BriefcaseIcon className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">{isAr ? 'لا توجد خدمات حتى الآن' : 'No gigs yet'}</p>
                  </div>
                ) : (
                  <motion.div
                    initial="hidden" animate="show" variants={stagger}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    {gigs.map((gig) => {
                      const thumb = gig.gallery_urls?.[0] || gig.thumbnail_url;
                      const imgSrc = thumb ? (thumb.startsWith('http') ? thumb : `${apiBase}${thumb}`) : null;
                      return (
                        <motion.div key={gig.id} variants={fadeUp}>
                          <Link href={`/gigs/${gig.id}`} className="gig-card group block">
                            <div className="aspect-video bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden">
                              {imgSrc
                                ? <img src={imgSrc} alt={gig.title_en} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                : <div className="flex items-center justify-center h-full"><BriefcaseIcon className="w-8 h-8 text-primary-300" /></div>
                              }
                            </div>
                            <div className="p-4">
                              <p className="text-sm font-semibold text-gray-800 line-clamp-2 mb-2 group-hover:text-primary-700 transition-colors">
                                {isAr ? gig.title_ar || gig.title_en : gig.title_en}
                              </p>
                              <div className="flex items-center justify-between">
                                {gig.avg_rating > 0 && <RatingStars rating={gig.avg_rating} count={gig.review_count} size="sm" />}
                                <span className="text-primary-700 font-bold text-sm ms-auto">
                                  {isAr ? 'يبدأ من' : 'From'} {formatJOD(gig.starting_price ?? gig.basic_price ?? 0)}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )
              )}

              {tab === 'reviews' && (
                reviews.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <StarIcon className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm">{isAr ? 'لا توجد تقييمات حتى الآن' : 'No reviews yet'}</p>
                  </div>
                ) : (
                  <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-4">
                    {reviews.map((r) => (
                      <motion.div
                        key={r.id}
                        variants={fadeUp}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm">
                              {r.reviewer_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{r.reviewer_name}</p>
                              <RatingStars rating={r.overall_rating} showNumber={false} size="sm" />
                            </div>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <ClockIcon className="w-3 h-3" />
                            {timeAgo(r.created_at, locale as string)}
                          </span>
                        </div>
                        {(r.comment_en || r.comment_ar) && (
                          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-4 py-3">
                            {isAr ? r.comment_ar || r.comment_en : r.comment_en || r.comment_ar}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
