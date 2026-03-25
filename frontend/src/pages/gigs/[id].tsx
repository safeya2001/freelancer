import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ClockIcon, CheckBadgeIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Layout from '@/components/layout/Layout';
import RatingStars from '@/components/ui/RatingStars';
import CheckoutButton from '@/components/payment/CheckoutButton';
import { gigsApi, ordersApi } from '@/services/api';
import { Gig, GigPackage } from '@/types';
import { formatJOD } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';

export default function GigDetailPage() {
  const { t } = useTranslation('common');
  const { locale, query } = useRouter();
  const isAr = locale === 'ar';
  const { isAuthenticated, isClient, user } = useAuth();
  const [gig, setGig] = useState<Gig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<GigPackage | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (query.id) gigsApi.get(query.id as string).then((r) => {
      setGig(r.data.data);
      if (r.data.data.packages?.length) setSelectedPkg(r.data.data.packages[0]);
    }).finally(() => setLoading(false));
  }, [query.id]);

  async function handleOrder() {
    if (!isAuthenticated) { toast.error(isAr ? 'يجب تسجيل الدخول أولاً' : 'Please login first'); return; }
    setOrdering(true);
    try {
      const res = await ordersApi.create({ gig_id: gig!.id, package_id: selectedPkg?.id });
      const order = res.data.data;
      // Create checkout session
      const checkout = await (await import('@/services/api')).paymentsApi.checkoutOrder(order.id);
      window.location.href = checkout.data.data.checkout_url;
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('common.error'));
    } finally { setOrdering(false); }
  }

  if (loading) return <Layout title="Loading..."><div className="animate-pulse card h-96" /></Layout>;
  if (!gig) return <Layout title="Not Found"><p className="text-center py-20">Gig not found</p></Layout>;

  const price = selectedPkg?.price ?? gig.price ?? 0;
  const pkg = selectedPkg;
  const pkgTypes = ['basic', 'standard', 'premium'] as const;

  return (
    <Layout title={gig.title_en} titleAr={gig.title_ar || gig.title_en}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Gig detail */}
        <div className="lg:col-span-2 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {isAr ? gig.title_ar || gig.title_en : gig.title_en}
          </h1>

          {/* Gallery */}
          {gig.gallery_urls && gig.gallery_urls.length > 0 && (
            <div>
              <div className="rounded-2xl overflow-hidden h-72 bg-gray-100 mb-2">
                <img src={gig.gallery_urls[imgIdx]} className="w-full h-full object-cover" alt="" />
              </div>
              {gig.gallery_urls.length > 1 && (
                <div className="flex gap-2">
                  {gig.gallery_urls.map((url, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={clsx('w-16 h-16 rounded-xl overflow-hidden border-2 transition',
                        imgIdx === i ? 'border-primary-500' : 'border-transparent')}>
                      <img src={url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="card">
            <h2 className="section-title">{isAr ? 'عن الخدمة' : 'About This Gig'}</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
              {isAr ? gig.description_ar || gig.description_en : gig.description_en}
            </p>
          </div>

          {/* Seller info */}
          <div className="card">
            <h2 className="section-title">{t('gigs.about_seller')}</h2>
            <div className="flex items-center gap-4">
              {gig.freelancer_avatar
                ? <img src={gig.freelancer_avatar} className="w-16 h-16 rounded-2xl object-cover" alt="" />
                : <div className="w-16 h-16 bg-primary-200 rounded-2xl flex items-center justify-center text-2xl">👤</div>}
              <div>
                <p className="font-bold text-gray-900">
                  {isAr ? gig.freelancer_name_ar || gig.freelancer_name_en : gig.freelancer_name_en}
                </p>
                {gig.freelancer_city && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5" />
                    {t(`cities.${gig.freelancer_city}`)}
                  </p>
                )}
                <RatingStars rating={gig.avg_rating || 0} count={gig.review_count} />
              </div>
            </div>
          </div>

          {/* Reviews */}
          {gig.reviews && gig.reviews.length > 0 && (
            <div className="card">
              <h2 className="section-title">{t('gigs.reviews')} ({gig.review_count})</h2>
              <div className="space-y-4">
                {gig.reviews.map((r) => (
                  <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.reviewer_name}</p>
                        <RatingStars rating={r.overall_rating} showNumber={false} />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{isAr ? r.comment_ar || r.comment_en : r.comment_en}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Order panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            {/* Package tabs */}
            {gig.packages && gig.packages.length > 0 && (
              <div className="card !p-0 overflow-hidden">
                <div className="grid grid-cols-3">
                  {pkgTypes.map((pt) => {
                    const p = gig.packages!.find((x) => x.package_type === pt);
                    if (!p) return null;
                    return (
                      <button key={pt} onClick={() => setSelectedPkg(p)}
                        className={clsx('py-3 text-xs font-semibold border-b-2 transition',
                          selectedPkg?.id === p.id
                            ? 'border-primary-600 text-primary-700 bg-primary-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700')}>
                        {t(`gigs.${pt}`)}
                      </button>
                    );
                  })}
                </div>
                {pkg && (
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{isAr ? pkg.name_ar || pkg.name_en : pkg.name_en}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{isAr ? pkg.description_en : pkg.description_en}</p>
                      </div>
                      <span className="text-lg font-black text-primary-700">{formatJOD(pkg.price)}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500 mb-4">
                      <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5" /> {pkg.delivery_days}d</span>
                      <span>🔄 {pkg.revisions} revisions</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No packages — simple price */}
            {(!gig.packages || gig.packages.length === 0) && (
              <div className="card">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-900">{t('gigs.price')}</span>
                  <span className="text-2xl font-black text-primary-700">{formatJOD(gig.price || 0)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ClockIcon className="w-4 h-4" />
                  {gig.delivery_days} {t('gigs.days')} {t('gigs.delivery')}
                </div>
              </div>
            )}

            {/* Payment breakdown */}
            {isClient && user?.id !== gig.freelancer_id && (
              <div className="card bg-primary-50 border border-primary-200">
                <p className="text-xs text-gray-500 mb-2">{t('payment.escrow_info')}</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>{t('payment.amount')}</span><span className="font-medium">{formatJOD(price)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>{t('payment.commission')}</span><span>{formatJOD(price * 0.1)}</span></div>
                  <div className="border-t border-primary-200 pt-1.5 flex justify-between font-bold text-primary-800">
                    <span>{t('payment.freelancer_receives')}</span>
                    <span>{formatJOD(price * 0.9)}</span>
                  </div>
                </div>
              </div>
            )}

            <button onClick={handleOrder} disabled={ordering || !isAuthenticated}
              className="btn btn-primary w-full btn-lg">
              {ordering ? t('common.loading') : t('gigs.order_now')}
            </button>
            <p className="text-center text-xs text-gray-400">🔒 {t('payment.secure_payment')}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
