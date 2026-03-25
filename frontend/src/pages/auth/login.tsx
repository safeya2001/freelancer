import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { locale } = router;
  const isAr = locale === 'ar';
  const { login, isAuthenticated, loading, user } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>();

  // Redirect ONLY after React has committed the auth state update.
  // This fires after setUser() is committed — unlike code in onSubmit which
  // runs before the commit and would cause the destination's useRequireAuth
  // to see isAuthenticated=false and bounce straight back to login.
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      const adminRoles = ['admin', 'super_admin', 'finance_admin', 'support_admin'];
      const dest = adminRoles.includes(user.role) ? '/admin' : '/dashboard';
      router.replace(dest);
    }
  }, [loading, isAuthenticated, user, router]);

  async function onSubmit({ email, password }: { email: string; password: string }) {
    try {
      await login(email, password);
      toast.success(t('auth.login_success'));
      // Navigation is intentionally handled ONLY by the useEffect below.
      // Calling router.replace here would fire before React commits the
      // setUser() state update, causing the destination page's useRequireAuth
      // to see isAuthenticated=false and redirect straight back to login.
    } catch (err: any) {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || t('common.error'));
    }
  }

  return (
    <Layout title="Login" titleAr="تسجيل الدخول" noFooter>
      <div className="min-h-[90vh] flex">
        {/* ── Left: decorative panel ── */}
        <div className="hidden lg:flex flex-col justify-between w-5/12 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 p-12 text-white">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <span className="font-black text-lg">D</span>
            </div>
            <span className="font-black text-xl">Dopa<span className="text-primary-200">Work</span></span>
          </Link>

          <div>
            <h2 className="text-3xl font-black leading-tight mb-4">
              {isAr ? 'أهلاً بعودتك إلى منصتك المهنية' : 'Welcome back to your professional platform'}
            </h2>
            <p className="text-primary-200 leading-relaxed text-sm">
              {isAr
                ? 'انضم إلى آلاف المستقلين والعملاء الذين يثقون في Dopa Work لبناء مستقبلهم المهني.'
                : 'Join thousands of freelancers and clients who trust Dopa Work to build their professional future.'}
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: '🔒', en: 'Secure escrow payments', ar: 'مدفوعات مضمونة وآمنة' },
                { icon: '⚡', en: 'Fast project matching', ar: 'مطابقة سريعة للمشاريع' },
                { icon: '⭐', en: 'Verified professionals', ar: 'محترفون موثقون' },
              ].map((f) => (
                <div key={f.en} className="flex items-center gap-3 text-sm">
                  <span className="text-xl">{f.icon}</span>
                  <span className="text-primary-100">{isAr ? f.ar : f.en}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-primary-300 text-xs">© 2025 Dopa Work · Jordan</p>
        </div>

        {/* ── Right: form panel ── */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            {/* Mobile logo */}
            <Link href="/" className="flex items-center gap-2 mb-8 lg:hidden">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center">
                <span className="text-white font-black">D</span>
              </div>
              <span className="font-black text-gray-900">Dopa<span className="text-primary-600">Work</span></span>
            </Link>

            <h1 className="text-2xl font-black text-gray-900 mb-1">{t('auth.login_title')}</h1>
            <p className="text-gray-500 text-sm mb-8">{t('auth.login_subtitle')}</p>

            {/* Google OAuth */}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}
              className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all font-medium text-gray-700 text-sm shadow-sm mb-6"
            >
              <img src="/google.svg" alt="" className="w-5 h-5" />
              {t('auth.google_login')}
            </a>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative text-center">
                <span className="bg-gray-50 px-4 text-xs text-gray-400 font-medium">
                  {isAr ? 'أو بالبريد الإلكتروني' : 'or continue with email'}
                </span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('email', { required: true })}
                    type="email"
                    placeholder="you@example.com"
                    dir="ltr"
                    className={`w-full ps-10 pe-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-gray-700">{t('auth.password')}</label>
                  <Link href="/auth/forgot-password" className="text-xs text-primary-600 hover:underline">
                    {t('auth.forgot_password')}
                  </Link>
                </div>
                <div className="relative">
                  <LockClosedIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('password', { required: true })}
                    type="password"
                    className={`w-full ps-10 pe-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full py-3 text-sm font-semibold mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t('common.loading')}
                  </span>
                ) : t('auth.login_btn')}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              {t('auth.no_account')}{' '}
              <Link href="/auth/register" className="text-primary-600 font-semibold hover:underline">
                {t('nav.register')}
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
