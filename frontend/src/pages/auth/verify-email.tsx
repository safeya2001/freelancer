import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import { authApi } from '@/services/api';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    authApi.verifyEmail(token as string)
      .then(() => setStatus('success'))
      .catch((err: any) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed');
      });
  }, [token]);

  return (
    <Layout title="Verify Email" titleAr="تأكيد البريد الإلكتروني" noFooter>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="card shadow-lg p-10">
            {status === 'loading' && (
              <>
                <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Verifying your email…</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircleIcon className="w-16 h-16 text-primary-600 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
                <p className="text-gray-500 mb-6">Your account is now active. You can log in.</p>
                <Link href="/auth/login" className="btn btn-primary w-full">Go to Login</Link>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
                <p className="text-gray-500 mb-6">{message || 'The link is invalid or has expired.'}</p>
                <Link href="/auth/login" className="btn btn-outline w-full">Back to Login</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
