import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { ShieldCheckIcon, EnvelopeIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function Footer() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';

  const columns = [
    {
      title_en: 'For Clients',
      title_ar: 'للعملاء',
      links: [
        { href: '/gigs',            label_en: 'Browse Services',   label_ar: 'تصفح الخدمات'       },
        { href: '/projects/create', label_en: 'Post a Project',    label_ar: 'انشر مشروعاً'        },
        { href: '/search',          label_en: 'Find Freelancers',  label_ar: 'ابحث عن مستقلين'     },
      ],
    },
    {
      title_en: 'For Freelancers',
      title_ar: 'للمستقلين',
      links: [
        { href: '/projects',      label_en: 'Browse Projects',  label_ar: 'تصفح المشاريع'     },
        { href: '/gigs/create',   label_en: 'Create a Gig',     label_ar: 'أنشئ خدمة'          },
        { href: '/dashboard',     label_en: 'Dashboard',        label_ar: 'لوحة التحكم'        },
      ],
    },
    {
      title_en: 'Company',
      title_ar: 'الشركة',
      links: [
        { href: '/about',   label_en: 'About Us',  label_ar: 'من نحن'           },
        { href: '/faq',     label_en: 'FAQ',       label_ar: 'الأسئلة الشائعة'  },
        { href: '/terms',   label_en: 'Terms',     label_ar: 'الشروط والأحكام'  },
        { href: '/privacy', label_en: 'Privacy',   label_ar: 'سياسة الخصوصية'  },
      ],
    },
  ];

  return (
    <footer className="bg-gray-950 text-gray-400">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-5 group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-primary-500/20 transition-shadow">
                <span className="text-white font-black text-sm">D</span>
              </div>
              <div>
                <span className="font-black text-white text-lg block leading-none">
                  Dopa<span className="text-primary-400">Work</span>
                </span>
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">Jordan</span>
              </div>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mb-6">
              {isAr
                ? 'منصة العمل الحر الأردنية الأولى — ربط المهنيين بالعملاء بكل أمان وشفافية.'
                : "Jordan's premier bilingual freelancing marketplace — connecting professionals with clients securely."}
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3">
              {[
                { Icon: ShieldCheckIcon, label_en: 'Secure Payments', label_ar: 'مدفوعات آمنة' },
              ].map(({ Icon, label_en, label_ar }) => (
                <div key={label_en} className="flex items-center gap-1.5 bg-gray-900 rounded-lg px-3 py-1.5 text-xs text-gray-400 border border-gray-800">
                  <Icon className="w-3.5 h-3.5 text-primary-400" />
                  {isAr ? label_ar : label_en}
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title_en}>
              <h4 className="text-white font-semibold text-sm mb-4">
                {isAr ? col.title_ar : col.title_en}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                      {isAr ? link.label_ar : link.label_en}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { Icon: EnvelopeIcon, val: 'support@dopawork.jo' },
              { Icon: PhoneIcon,    val: '+962 6 000 0000'      },
              { Icon: MapPinIcon,   val: isAr ? 'عمّان، الأردن' : 'Amman, Jordan' },
            ].map(({ Icon, val }) => (
              <div key={val} className="flex items-center gap-2.5 text-sm text-gray-500">
                <Icon className="w-4 h-4 text-primary-400 shrink-0" />
                {val}
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <p>
              © {new Date().getFullYear()} Dopa Work ·{' '}
              {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved'}
            </p>
            <div className="flex items-center gap-4">
              <Link href="/terms"   className="hover:text-gray-400 transition-colors">{isAr ? 'الشروط' : 'Terms'}</Link>
              <Link href="/privacy" className="hover:text-gray-400 transition-colors">{isAr ? 'الخصوصية' : 'Privacy'}</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
