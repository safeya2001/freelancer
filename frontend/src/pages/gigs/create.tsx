import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import Layout from '@/components/layout/Layout';
import { gigsApi, uploadsApi, usersApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import toast from 'react-hot-toast';
import { PlusIcon } from '@heroicons/react/24/outline';

const DELIVERY_DAYS = [1, 2, 3, 5, 7, 10, 14, 21, 30];

const PACKAGE_LABELS: Record<string, { en: string; ar: string }> = {
  basic:    { en: 'Basic',    ar: 'أساسية' },
  standard: { en: 'Standard', ar: 'قياسية' },
  premium:  { en: 'Premium',  ar: 'مميزة'  },
};

interface PackageForm {
  package_type: 'basic' | 'standard' | 'premium';
  price: string;
  delivery_days: string;
  revisions: string;
  description_en: string;
  description_ar: string;
}

interface GigForm {
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  category_id: string;
  delivery_days: string;
  requirements_en: string;
  requirements_ar: string;
  packages: PackageForm[];
}

interface Category {
  id: string;
  name_en: string;
  name_ar: string;
  slug: string;
}

export default function CreateGigPage() {
  const { t } = useTranslation('common');
  const { locale, push } = useRouter();
  const isAr = locale === 'ar';
  const { isFreelancer } = useAuth();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    usersApi.getCategories()
      .then((res) => setCategories(res.data.data ?? []))
      .catch(() => {});
  }, []);

  const { register, control, handleSubmit, formState: { errors } } = useForm<GigForm>({
    defaultValues: {
      delivery_days: '7',
      packages: [
        { package_type: 'basic',    price: '', delivery_days: '3', revisions: '1', description_en: '', description_ar: '' },
        { package_type: 'standard', price: '', delivery_days: '5', revisions: '2', description_en: '', description_ar: '' },
        { package_type: 'premium',  price: '', delivery_days: '7', revisions: '3', description_en: '', description_ar: '' },
      ],
    },
  });
  const { fields } = useFieldArray({ control, name: 'packages' });

  if (authLoading || !isAuthenticated) return null;
  if (!isFreelancer) return (
    <Layout title="Access Denied"><p className="text-center py-20 text-red-500">Freelancers only</p></Layout>
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true);
    try {
      const res = await uploadsApi.multiple(Array.from(e.target.files));
      setImages((p) => [...p, ...res.data.data.urls]);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: GigForm) {
    if (images.length === 0) {
      toast.error(isAr ? 'أضف صورة واحدة على الأقل' : 'Add at least one image');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title_en:         data.title_en,
        title_ar:         data.title_ar || undefined,
        description_en:   data.description_en,
        description_ar:   data.description_ar || undefined,
        category_id:      data.category_id,
        delivery_days:    parseInt(data.delivery_days),
        gallery_urls:     images,
        requirements_en:  data.requirements_en || undefined,
        requirements_ar:  data.requirements_ar || undefined,
        packages: data.packages.map((p) => ({
          package_type:   p.package_type,
          name_en:        PACKAGE_LABELS[p.package_type].en,
          name_ar:        PACKAGE_LABELS[p.package_type].ar,
          price:          parseFloat(p.price),
          delivery_days:  parseInt(p.delivery_days),
          revisions:      parseInt(p.revisions) || 0,
          description_en: p.description_en || undefined,
          description_ar: p.description_ar || undefined,
        })),
      };
      await gigsApi.create(payload);
      toast.success(isAr ? 'تم إنشاء الخدمة!' : 'Gig created!');
      push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout title="Create Gig" titleAr="إنشاء خدمة">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="page-title">{isAr ? 'إنشاء خدمة جديدة' : 'Create a New Gig'}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* Basic Info */}
          <div className="card space-y-5">
            <h2 className="section-title">{isAr ? 'المعلومات الأساسية' : 'Basic Info'}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Title (English) *</label>
                <input
                  {...register('title_en', { required: true, minLength: 10, maxLength: 200 })}
                  className="input"
                  placeholder="e.g. I will design a professional logo"
                />
                {errors.title_en && <p className="text-red-500 text-xs mt-1">Min 10 characters</p>}
              </div>
              <div>
                <label className="label">العنوان (عربي)</label>
                <input
                  {...register('title_ar', { maxLength: 200 })}
                  className="input"
                  dir="rtl"
                  placeholder="مثال: سأصمم شعاراً احترافياً"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Description (English) *</label>
                <textarea
                  {...register('description_en', { required: true, minLength: 30 })}
                  rows={4}
                  className="input resize-none"
                  placeholder="Describe your gig in detail..."
                />
                {errors.description_en && <p className="text-red-500 text-xs mt-1">Min 30 characters</p>}
              </div>
              <div>
                <label className="label">الوصف (عربي)</label>
                <textarea
                  {...register('description_ar')}
                  rows={4}
                  className="input resize-none"
                  dir="rtl"
                  placeholder="صف خدمتك بالتفصيل..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{isAr ? 'الفئة' : 'Category'} *</label>
                <select
                  {...register('category_id', { required: true })}
                  className="input"
                >
                  <option value="">{isAr ? 'اختر الفئة...' : 'Select category...'}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isAr ? c.name_ar : c.name_en}
                    </option>
                  ))}
                </select>
                {errors.category_id && <p className="text-red-500 text-xs mt-1">{isAr ? 'مطلوب' : 'Required'}</p>}
              </div>
              <div>
                <label className="label">{isAr ? 'مدة التسليم (أيام)' : 'Delivery Days'} *</label>
                <select {...register('delivery_days', { required: true })} className="input">
                  {DELIVERY_DAYS.map((d) => (
                    <option key={d} value={d}>{d} {isAr ? 'أيام' : 'days'}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Requirements (EN)</label>
                <textarea
                  {...register('requirements_en')}
                  rows={2}
                  className="input resize-none text-sm"
                  placeholder="What do you need from the buyer?"
                />
              </div>
              <div>
                <label className="label">متطلبات من المشتري (عربي)</label>
                <textarea
                  {...register('requirements_ar')}
                  rows={2}
                  className="input resize-none text-sm"
                  dir="rtl"
                  placeholder="ماذا تحتاج من المشتري؟"
                />
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="card space-y-4">
            <h2 className="section-title">{isAr ? 'صور الخدمة' : 'Gig Images'}</h2>
            <div className="flex flex-wrap gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-24 h-24 rounded-xl object-cover border" />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    className="absolute -top-2 -end-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >×</button>
                </div>
              ))}
              {images.length < 5 && (
                <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 transition text-gray-400 text-xs">
                  {uploading ? '...' : <><PlusIcon className="w-6 h-6 mb-1" />{isAr ? 'أضف صورة' : 'Add Image'}</>}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-400">{isAr ? 'حتى 5 صور، الصورة الأولى هي الصورة الرئيسية' : 'Up to 5 images. First image is the thumbnail.'}</p>
          </div>

          {/* Packages */}
          <div className="card space-y-6">
            <h2 className="section-title">{isAr ? 'الباقات' : 'Packages'}</h2>
            {fields.map((field, index) => {
              const label = PACKAGE_LABELS[field.package_type];
              return (
                <div key={field.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${index === 0 ? 'bg-gray-500' : index === 1 ? 'bg-primary-600' : 'bg-yellow-500'}`}>
                    {isAr ? label.ar : label.en}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">{isAr ? 'السعر (دينار)' : 'Price (JOD)'} *</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        {...register(`packages.${index}.price`, { required: true })}
                        className="input"
                        placeholder="5.00"
                      />
                    </div>
                    <div>
                      <label className="label">{isAr ? 'مدة التسليم' : 'Delivery Days'}</label>
                      <select {...register(`packages.${index}.delivery_days`)} className="input">
                        {DELIVERY_DAYS.map((d) => (
                          <option key={d} value={d}>{d} {isAr ? 'أيام' : 'days'}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{isAr ? 'عدد المراجعات' : 'Revisions'}</label>
                      <input
                        type="number"
                        min="0"
                        {...register(`packages.${index}.revisions`)}
                        className="input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Description (EN)</label>
                      <textarea
                        {...register(`packages.${index}.description_en`)}
                        rows={2}
                        className="input resize-none text-sm"
                        placeholder="What's included?"
                      />
                    </div>
                    <div>
                      <label className="label">الوصف (عربي)</label>
                      <textarea
                        {...register(`packages.${index}.description_ar`)}
                        rows={2}
                        className="input resize-none text-sm"
                        dir="rtl"
                        placeholder="ماذا يتضمن هذا الباقة؟"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3 text-base">
            {submitting
              ? (isAr ? 'جاري النشر...' : 'Publishing...')
              : (isAr ? 'نشر الخدمة' : 'Publish Gig')}
          </button>
        </form>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
