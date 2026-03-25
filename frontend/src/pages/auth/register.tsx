import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  EnvelopeIcon, LockClosedIcon, UserIcon, PhoneIcon,
  BriefcaseIcon, BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function RegisterPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const defaultRole = (router.query.role as string) || 'client';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      role: defaultRole,
      preferred_language: 'ar',
      email: '',
      password: '',
      confirm_password: '',
      full_name_en: '',
      full_name_ar: '',
      phone: '',
    },
  });

  const pwd = watch('password');
  const selectedRole = watch('role');

  async function onSubmit(data: any) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirm_password, ...payload } = data;
      await registerUser(payload);
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  }

  return (
    <Layout title="Register" titleAr="إنشاء حساب" noFooter>
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
              {isAr ? 'ابدأ رحلتك المهنية اليوم' : 'Start your professional journey today'}
            </h2>
            <p className="text-primary-200 leading-relaxed text-sm">
              {isAr
                ? 'سجّل مجاناً واستمتع بكامل مميزات منصة العمل الحر الأولى في الأردن.'
                : "Register for free and enjoy all features of Jordan's #1 freelancing platform."}
            </p>

            <div className="mt-10 space-y-5">
              {[
                { icon: '🚀', en: 'Get started in minutes', ar: 'ابدأ في دقائق' },
                { icon: '🛡️', en: 'Secure & verified platform', ar: 'منصة آمنة وموثوقة' },
                { icon: '💰', en: 'No subscription fees', ar: 'بدون رسوم اشتراك' },
                { icon: '🌍', en: 'Work with Jordanian talent', ar: 'تعامل مع كفاءات أردنية' },
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
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50 overflow-y-auto">
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

            <h1 className="text-2xl font-black text-gray-900 mb-1">{t('auth.register_title')}</h1>
            <p className="text-gray-500 text-sm mb-8">{t('auth.register_subtitle')}</p>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-3 mb-7">
              {[
                { value: 'client',     Icon: BuildingOffice2Icon, en: t('auth.client'),     ar: 'أنا عميل',      desc_en: 'I need work done',         desc_ar: 'أريد إنجاز عمل'       },
                { value: 'freelancer', Icon: BriefcaseIcon,       en: t('auth.freelancer'), ar: 'أنا مستقل',     desc_en: 'I offer services',         desc_ar: 'أقدم خدمات مهنية'     },
              ].map(({ value, Icon, en, ar, desc_en, desc_ar }) => (
                <label
                  key={value}
                  className={clsx(
                    'relative flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 cursor-pointer transition-all',
                    selectedRole === value
                      ? 'border-primary-500 bg-primary-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  )}
                >
                  <input {...register('role')} type="radio" value={value} className="sr-only" />
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    selectedRole === value ? 'bg-primary-100' : 'bg-gray-100',
                  )}>
                    <Icon className={clsx('w-5 h-5', selectedRole === value ? 'text-primary-600' : 'text-gray-500')} />
                  </div>
                  <div className="text-center">
                    <p className={clsx('text-sm font-bold', selectedRole === value ? 'text-primary-700' : 'text-gray-700')}>
                      {isAr ? ar : en}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{isAr ? desc_ar : desc_en}</p>
                  </div>
                  {selectedRole === value && (
                    <div className="absolute top-2 end-2 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </label>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.full_name')}</label>
                <div className="relative">
                  <UserIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('full_name_en', { required: true })}
                    placeholder={isAr ? 'الاسم الكامل' : 'Full Name'}
                    className={clsx(
                      'w-full ps-10 pe-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                      errors.full_name_en ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
                    )}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.email')}</label>
                <div className="relative">
                  <EnvelopeIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('email', { required: true, pattern: /^\S+@\S+$/i })}
                    type="email"
                    placeholder="you@example.com"
                    dir="ltr"
                    className={clsx(
                      'w-full ps-10 pe-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
                    )}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.phone')}</label>
                <div className="relative">
                  <PhoneIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="+9627XXXXXXXX"
                    dir="ltr"
                    className="w-full ps-10 pe-4 py-3 rounded-xl border border-gray-200 bg-white text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('password', { required: true, minLength: 8 })}
                    type="password"
                    className={clsx(
                      'w-full ps-10 pe-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                      errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
                    )}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {isAr ? '8 أحرف على الأقل، حرف كبير ورقم' : 'Min 8 chars, one uppercase + one number'}
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.confirm_password')}</label>
                <div className="relative">
                  <LockClosedIcon className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('confirm_password', {
                      validate: (v) => v === pwd || (isAr ? 'كلمات المرور غير متطابقة' : 'Passwords do not match'),
                    })}
                    type="password"
                    className={clsx(
                      'w-full ps-10 pe-4 py-3 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500',
                      errors.confirm_password ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white',
                    )}
                  />
                </div>
                {errors.confirm_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message as string}</p>
                )}
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
                ) : t('auth.register_btn')}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              {t('auth.have_account')}{' '}
              <Link href="/auth/login" className="text-primary-600 font-semibold hover:underline">
                {t('nav.login')}
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
