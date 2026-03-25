import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { contentApi } from '@/services/api';

export default function FaqPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const [items, setItems] = useState<{ question_en: string; question_ar?: string; answer_en: string; answer_ar?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contentApi.getFaq()
      .then((res) => setItems(res.data?.data ?? res.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout
      title="FAQ"
      titleAr="الأسئلة الشائعة"
      description="Frequently asked questions"
      descriptionAr="الأسئلة الشائعة"
    >
      <div className="max-w-3xl mx-auto py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
        </h1>
        {loading && <p className="text-gray-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>}
        {!loading && items.length === 0 && (
          <p className="text-gray-500">{isAr ? 'لا توجد أسئلة حالياً.' : 'No FAQ items yet.'}</p>
        )}
        <div className="space-y-6">
          {items.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
              <h2 className="text-lg font-semibold text-primary-800 mb-2">
                {isAr ? (item.question_ar || item.question_en) : item.question_en}
              </h2>
              <div className="text-gray-700 whitespace-pre-wrap">
                {isAr ? (item.answer_ar || item.answer_en) : item.answer_en}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: { ...(await serverSideTranslations(locale ?? 'ar', ['common'])) },
  };
}
