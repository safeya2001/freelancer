import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import { ordersApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'];

export default function OrdersPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersApi.list()
      .then((r) => setOrders(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) return null;

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <Layout title="Orders" titleAr="الطلبات">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="page-title">{isAr ? 'الطلبات' : 'Orders'}</h1>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
          {STATUS_FILTERS.map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={clsx('px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition',
                filter === s ? 'bg-primary-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {s === 'all' ? (isAr ? 'الكل' : 'All') : t(`status.${s}`) || s.replace(/_/g, ' ')}
              {s !== 'all' && (
                <span className="ms-1.5 text-xs opacity-70">
                  ({orders.filter((o) => o.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBagIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">{isAr ? 'لا توجد طلبات' : 'No orders found'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="card card-hover block">
                <div className="flex items-start gap-4">
                  {order.gig_thumbnail && (
                    <img src={order.gig_thumbnail} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm line-clamp-2">
                        {isAr ? order.gig_title_ar : order.gig_title_en}
                      </h3>
                      <Badge status={order.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {user?.role === 'freelancer'
                        ? `${isAr ? 'العميل: ' : 'Client: '}${isAr ? order.client_name_ar : order.client_name_en}`
                        : `${isAr ? 'المستقل: ' : 'Freelancer: '}${isAr ? order.freelancer_name_ar : order.freelancer_name_en}`}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <span className="text-primary-700 font-black text-sm">{formatJOD(order.amount)}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <span>⏱</span>
                          {isAr ? `${order.delivery_days} أيام` : `${order.delivery_days} days`}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(order.created_at, locale as string)}</span>
                    </div>

                    {/* Deadline warning */}
                    {order.status === 'in_progress' && order.deadline && (
                      <div className={clsx('mt-2 text-xs px-2 py-1 rounded-lg inline-block',
                        new Date(order.deadline) < new Date(Date.now() + 86400000)
                          ? 'bg-red-50 text-red-600'
                          : 'bg-yellow-50 text-yellow-700')}>
                        {isAr ? 'الموعد النهائي: ' : 'Deadline: '}
                        {new Date(order.deadline).toLocaleDateString(locale === 'ar' ? 'ar-JO' : 'en-GB')}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
