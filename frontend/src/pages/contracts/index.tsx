import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import { contractsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

export default function ContractsPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const { user } = useAuth();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    contractsApi.list()
      .then((r) => setContracts(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <Layout title="Contracts" titleAr="العقود">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="page-title">{isAr ? 'العقود' : 'Contracts'}</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="text-center py-20">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">{isAr ? 'لا توجد عقود بعد' : 'No contracts yet'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contracts.map((c) => (
              <Link key={c.id} href={`/contracts/${c.id}`} className="card card-hover block">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-sm">
                      {isAr ? c.project?.title_ar || c.gig?.title_ar : c.project?.title_en || c.gig?.title_en}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {isAr ? (user?.role === 'freelancer' ? 'العميل: ' : 'المستقل: ') : (user?.role === 'freelancer' ? 'Client: ' : 'Freelancer: ')}
                      <span className="font-medium">
                        {user?.role === 'freelancer' ? (isAr ? c.client_name_ar : c.client_name_en) : (isAr ? c.freelancer_name_ar : c.freelancer_name_en)}
                      </span>
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-lg font-black text-primary-700">{formatJOD(c.total_amount)}</p>
                    <Badge status={c.status} />
                  </div>
                </div>

                {/* Milestones progress */}
                {c.milestones?.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>{isAr ? 'المراحل' : 'Milestones'}</span>
                      <span>{c.milestones.filter((m: any) => m.status === 'completed').length}/{c.milestones.length}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-primary-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${(c.milestones.filter((m: any) => m.status === 'completed').length / c.milestones.length) * 100}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at, locale as string)}</span>
                  <span className="text-xs text-primary-600 font-medium">{isAr ? 'عرض التفاصيل ←' : 'View Details →'}</span>
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
