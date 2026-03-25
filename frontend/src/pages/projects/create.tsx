import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Layout from '@/components/layout/Layout';
import { projectsApi } from '@/services/api';
import { formatJOD } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIES = ['web_development','mobile_development','graphic_design','writing','marketing','video','music','data','translation','other'];
const CITIES = ['amman','irbid','zarqa','aqaba','madaba','salt','karak','jerash','nationwide'];
const DURATIONS = ['less_than_week','one_to_two_weeks','two_to_four_weeks','one_to_three_months','more_than_three_months'];
const EXPERIENCE_LEVELS = ['entry','intermediate','expert'];

interface ProjectForm {
  title_en: string; title_ar: string;
  description_en: string; description_ar: string;
  category: string; city: string;
  budget_min: string; budget_max: string;
  duration: string; experience_level: string;
  skills_required: string;
}

export default function CreateProjectPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const router = useRouter();
  const { isClient } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch } = useForm<ProjectForm>();
  const budgetMin = parseFloat(watch('budget_min') || '0');
  const budgetMax = parseFloat(watch('budget_max') || '0');

  if (!isClient) return (
    <Layout title="Access Denied"><p className="text-center py-20 text-red-500">Clients only</p></Layout>
  );

  async function onSubmit(data: ProjectForm) {
    if (budgetMax > 0 && budgetMin > budgetMax) {
      toast.error(isAr ? 'الحد الأدنى للميزانية يجب أن يكون أقل من الحد الأعلى' : 'Budget min must be less than max');
      return;
    }
    setSubmitting(true);
    try {
      await projectsApi.create({
        ...data,
        budget_min: parseFloat(data.budget_min),
        budget_max: data.budget_max ? parseFloat(data.budget_max) : null,
        skills_required: data.skills_required.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success(isAr ? 'تم نشر المشروع!' : 'Project posted!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setSubmitting(false); }
  }

  return (
    <Layout title="Post a Project" titleAr="نشر مشروع">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="page-title">{isAr ? 'نشر مشروع جديد' : 'Post a New Project'}</h1>
        <p className="text-gray-500 mb-8 text-sm">
          {isAr ? 'أخبر المستقلين بما تحتاجه وسيرسلون عروضهم' : 'Tell freelancers what you need and they will send proposals'}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="card space-y-4">
            <h2 className="section-title">{isAr ? 'عنوان المشروع' : 'Project Title'}</h2>
            <div>
              <label className="label">Title (English) *</label>
              <input {...register('title_en', { required: true })} className="input"
                placeholder="e.g. Build a responsive e-commerce website" />
              {errors.title_en && <p className="text-red-500 text-xs mt-1">Required</p>}
            </div>
            <div>
              <label className="label">العنوان (عربي) *</label>
              <input {...register('title_ar', { required: true })} className="input" dir="rtl"
                placeholder="مثال: بناء موقع تجارة إلكترونية متجاوب" />
              {errors.title_ar && <p className="text-red-500 text-xs mt-1">مطلوب</p>}
            </div>
          </div>

          {/* Description */}
          <div className="card space-y-4">
            <h2 className="section-title">{isAr ? 'وصف المشروع' : 'Project Description'}</h2>
            <div>
              <label className="label">Description (English) *</label>
              <textarea {...register('description_en', { required: true, minLength: 50 })} rows={5} className="input resize-none"
                placeholder="Describe your project requirements in detail. What do you need? What are the deliverables?" />
              {errors.description_en?.type === 'required' && <p className="text-red-500 text-xs mt-1">Required</p>}
              {errors.description_en?.type === 'minLength' && <p className="text-red-500 text-xs mt-1">At least 50 characters</p>}
            </div>
            <div>
              <label className="label">الوصف (عربي) *</label>
              <textarea {...register('description_ar', { required: true, minLength: 50 })} rows={5} className="input resize-none" dir="rtl"
                placeholder="صف متطلبات مشروعك بالتفصيل. ماذا تحتاج؟ ما هي النتائج المطلوبة؟" />
              {errors.description_ar?.type === 'required' && <p className="text-red-500 text-xs mt-1">مطلوب</p>}
            </div>
          </div>

          {/* Details */}
          <div className="card space-y-4">
            <h2 className="section-title">{isAr ? 'تفاصيل المشروع' : 'Project Details'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{isAr ? 'الفئة' : 'Category'} *</label>
                <select {...register('category', { required: true })} className="input">
                  <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{isAr ? 'الموقع' : 'Location'} *</label>
                <select {...register('city', { required: true })} className="input">
                  <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                  {CITIES.map((c) => <option key={c} value={c}>{t(`cities.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{isAr ? 'مستوى الخبرة المطلوب' : 'Experience Level'}</label>
                <select {...register('experience_level')} className="input">
                  <option value="">{isAr ? 'أي مستوى' : 'Any level'}</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>{isAr ? (l === 'entry' ? 'مبتدئ' : l === 'intermediate' ? 'متوسط' : 'خبير') : l.charAt(0).toUpperCase() + l.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{isAr ? 'مدة المشروع' : 'Project Duration'}</label>
                <select {...register('duration')} className="input">
                  <option value="">{isAr ? 'اختر...' : 'Select...'}</option>
                  {DURATIONS.map((d) => <option key={d} value={d}>{t(`durations.${d}`)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">{isAr ? 'المهارات المطلوبة (مفصولة بفاصلة)' : 'Required Skills (comma-separated)'}</label>
              <input {...register('skills_required')} className="input"
                placeholder={isAr ? 'مثال: React، Node.js، PostgreSQL' : 'e.g. React, Node.js, PostgreSQL'} />
            </div>
          </div>

          {/* Budget */}
          <div className="card space-y-4">
            <h2 className="section-title">{isAr ? 'الميزانية' : 'Budget'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{isAr ? 'الحد الأدنى (دينار)' : 'Min Budget (JOD)'} *</label>
                <input type="number" step="1" min="5" {...register('budget_min', { required: true, min: 5 })} className="input" placeholder="50" />
                {errors.budget_min && <p className="text-red-500 text-xs mt-1">{isAr ? 'الحد الأدنى 5 دنانير' : 'Min 5 JOD'}</p>}
              </div>
              <div>
                <label className="label">{isAr ? 'الحد الأعلى (دينار)' : 'Max Budget (JOD)'}</label>
                <input type="number" step="1" {...register('budget_max')} className="input" placeholder={isAr ? 'اختياري' : 'Optional'} />
              </div>
            </div>
            {budgetMin > 0 && (
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 text-sm text-primary-700">
                {isAr
                  ? `ميزانيتك: ${formatJOD(budgetMin, 'ar')}${budgetMax ? ` - ${formatJOD(budgetMax, 'ar')}` : '+'}`
                  : `Budget: ${formatJOD(budgetMin, 'en')}${budgetMax ? ` – ${formatJOD(budgetMax, 'en')}` : '+'}`}
              </div>
            )}
            <p className="text-xs text-gray-400">
              {isAr ? '* سيتم أخذ عمولة 10% من المبلغ عند إتمام الطلب' : '* A 10% platform commission will be applied on completion'}
            </p>
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3 text-base">
            {submitting ? (isAr ? 'جاري النشر...' : 'Posting...') : (isAr ? 'نشر المشروع' : 'Post Project')}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
