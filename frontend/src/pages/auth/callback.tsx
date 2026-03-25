import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

/**
 * Landing page after Google OAuth redirect.
 * The backend sets httpOnly cookies before redirecting here.
 * We just need to reload the auth state and navigate to dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { reloadAuth } = useAuth();
  const { status } = router.query;

  useEffect(() => {
    if (!router.isReady) return;

    if (status === 'success') {
      reloadAuth().then(() => {
        toast.success('Logged in successfully');
        router.replace('/dashboard');
      });
    } else {
      toast.error('Authentication failed. Please try again.');
      router.replace('/auth/login');
    }
  }, [router.isReady, status]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
