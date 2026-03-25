import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import { authApi } from '@/services/api';

export default function ForgotPasswordPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } =
    useForm<{ email: string }>();

  async function onSubmit(data: { email: string }) {
    try {
      await authApi.forgotPassword(data.email);
      // Always show success to prevent account enumeration
      toast.success('If that email exists, a reset link has been sent.');
    } catch {
      toast.success('If that email exists, a reset link has been sent.');
    }
  }

  return (
    <Layout title="Forgot Password" titleAr="استعادة كلمة المرور" noFooter>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="card shadow-lg">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-black text-2xl">F</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Enter your email and we'll send you a reset link.
              </p>
            </div>

            {isSubmitSuccessful ? (
              <div className="text-center py-4">
                <p className="text-primary-700 font-medium">
                  Check your inbox for a password reset link.
                </p>
                <Link href="/auth/login" className="btn btn-ghost mt-4">Back to Login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    {...register('email', { required: 'Email is required' })}
                    type="email"
                    className={errors.email ? 'input-error' : 'input'}
                    placeholder="you@example.com"
                    dir="ltr"
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full mt-2">
                  {isSubmitting ? 'Sending…' : 'Send Reset Link'}
                </button>
                <p className="text-center text-sm text-gray-500 mt-4">
                  <Link href="/auth/login" className="text-primary-600 hover:underline">Back to Login</Link>
                </p>
              </form>
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
