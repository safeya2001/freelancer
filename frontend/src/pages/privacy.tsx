import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { contentApi } from '@/services/api';

export default function PrivacyPage() {
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const key = isAr ? 'privacy_ar' : 'privacy_en';
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contentApi.getPage(key)
      .then((res) => setContent(res.data?.data?.content ?? res.data?.content ?? ''))
      .catch(() => setContent(''))
      .finally(() => setLoading(false));
  }, [key]);

  return (
    <Layout
      title="Privacy Policy"
      titleAr="سياسة الخصوصية"
      description="Privacy policy"
      descriptionAr="سياسة الخصوصية"
    >
      <div className="max-w-3xl mx-auto py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </h1>
        {loading && <p className="text-gray-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>}
        {!loading && (
          <div className="prose prose-lg max-w-none text-gray-700 whitespace-pre-wrap">
            {content || (isAr ? 'لم يتم إضافة المحتوى بعد.' : 'Content has not been added yet.')}
          </div>
        )}
      </div>
    </Layout>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: { ...(await serverSideTranslations(locale ?? 'ar', ['common'])) },
  };
}
