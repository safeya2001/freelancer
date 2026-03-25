import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import { authApi } from '@/services/api';

interface ResetForm {
  new_password: string;
  confirm_password: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } =
    useForm<ResetForm>();

  async function onSubmit(data: ResetForm) {
    if (!token) {
      toast.error('Invalid reset link. Please request a new one.');
      return;
    }
    try {
      await authApi.resetPassword(token as string, data.new_password);
      toast.success('Password reset successfully. Please log in.');
      router.push('/auth/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reset failed. The link may have expired.');
    }
  }

  return (
    <Layout title="Reset Password" titleAr="إعادة تعيين كلمة المرور" noFooter>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="card shadow-lg">
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-black text-2xl">F</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
              <p className="text-gray-500 mt-1 text-sm">Choose a strong password for your account.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <input
                  {...register('new_password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'At least 8 characters' },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Must include uppercase, lowercase and a number',
                    },
                  })}
                  type="password"
                  className={errors.new_password ? 'input-error' : 'input'}
                />
                {errors.new_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.new_password.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  {...register('confirm_password', {
                    required: 'Please confirm your password',
                    validate: (v) => v === watch('new_password') || 'Passwords do not match',
                  })}
                  type="password"
                  className={errors.confirm_password ? 'input-error' : 'input'}
                />
                {errors.confirm_password && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>
                )}
              </div>
              <button type="submit" disabled={isSubmitting || !token} className="btn btn-primary w-full mt-2">
                {isSubmitting ? 'Resetting…' : 'Reset Password'}
              </button>
              <p className="text-center text-sm text-gray-500 mt-4">
                <Link href="/auth/login" className="text-primary-600 hover:underline">Back to Login</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
