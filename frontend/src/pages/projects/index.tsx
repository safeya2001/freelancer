import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BriefcaseIcon, ClockIcon, UserGroupIcon, PlusIcon,
  MagnifyingGlassIcon, MapPinIcon, BanknotesIcon, XMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import { projectsApi, proposalsApi } from '@/services/api';
import { Project } from '@/types';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

const CITIES = ['amman', 'irbid', 'zarqa', 'aqaba', 'madaba', 'salt', 'karak', 'jerash'];

export default function ProjectsPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const { isClient, isFreelancer } = useAuth();

  const [projects, setProjects]     = useState<Project[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [filters, setFilters]       = useState({ budget_type: '', city: '', search: '', page: 1 });
  const [hideApplied, setHideApplied] = useState(false);
  // Set of project IDs the current freelancer has applied to
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // Load applied project IDs once for freelancers
  useEffect(() => {
    if (!isFreelancer) return;
    proposalsApi.myProposals()
      .then((r) => {
        const ids = new Set<string>((r.data?.data ?? []).map((p: any) => p.project_id as string));
        setAppliedIds(ids);
      })
      .catch(() => {});
  }, [isFreelancer]);

  useEffect(() => { load(); }, [filters]);

  async function load() {
    setLoading(true);
    try {
      const res = await projectsApi.list({ ...filters, limit: 10 });
      const d = res.data?.data ?? res.data;
      setProjects(Array.isArray(d) ? d : d?.data ?? d?.projects ?? []);
      setTotal(d?.total ?? d?.count ?? 0);
    } finally { setLoading(false); }
  }

  function reset() {
    setFilters({ budget_type: '', city: '', search: '', page: 1 });
    setHideApplied(false);
  }

  const pages = Math.max(1, Math.ceil(total / 10));

  const visibleProjects = hideApplied
    ? projects.filter((p) => !appliedIds.has(p.id))
    : projects;

  return (
    <Layout title="Browse Projects" titleAr="تصفح المشاريع" fullWidth>
      <div className="section-container py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{t('projects.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total > 0 ? `${total.toLocaleString()} ${isAr ? 'مشروع' : 'projects posted'}` : ''}
            </p>
          </div>
          {isClient && (
            <Link href="/projects/create" className="btn btn-primary btn-sm self-start sm:self-auto">
              <PlusIcon className="w-4 h-4" /> {t('projects.post_project')}
            </Link>
          )}
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                placeholder={isAr ? 'ابحث في المشاريع...' : 'Search projects...'}
                className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-gray-50"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>

            {/* Budget type */}
            <select
              className="input w-40 py-2.5 bg-gray-50 rounded-xl"
              value={filters.budget_type}
              onChange={(e) => setFilters({ ...filters, budget_type: e.target.value, page: 1 })}
            >
              <option value="">{isAr ? 'نوع الميزانية' : 'Budget Type'}</option>
              <option value="fixed">{t('projects.fixed')}</option>
              <option value="hourly">{t('projects.hourly')}</option>
            </select>

            {/* City */}
            <select
              className="input w-36 py-2.5 bg-gray-50 rounded-xl"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value, page: 1 })}
            >
              <option value="">{isAr ? 'المدينة' : 'City'}</option>
              {CITIES.map((c) => <option key={c} value={c}>{t(`cities.${c}`)}</option>)}
            </select>

            {/* Hide Applied — only for freelancers */}
            {isFreelancer && appliedIds.size > 0 && (
              <button
                onClick={() => setHideApplied((v) => !v)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  hideApplied
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-400',
                )}>
                <CheckCircleIcon className="w-4 h-4" />
                {isAr ? (hideApplied ? 'إظهار الكل' : 'إخفاء التي قدّمت عليها') : (hideApplied ? 'Show All' : 'Hide Applied')}
              </button>
            )}

            {/* Reset */}
            {(filters.search || filters.budget_type || filters.city || hideApplied) && (
              <button onClick={reset} className="btn btn-ghost btn-sm self-center">
                <XMarkIcon className="w-4 h-4" /> {t('search.reset')}
              </button>
            )}
          </div>
        </div>

        {/* ── Results ── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="skeleton h-5 w-1/2 rounded mb-3" />
                <div className="skeleton h-3 w-full rounded mb-2" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BriefcaseIcon className="w-14 h-14 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">
              {hideApplied
                ? (isAr ? 'لا توجد مشاريع أخرى — لقد قدّمت عروضاً على كل المشاريع المتاحة!' : 'No more projects — you\'ve applied to all available ones!')
                : t('projects.no_projects')}
            </p>
            {isClient && (
              <Link href="/projects/create" className="btn btn-primary mt-4">
                <PlusIcon className="w-4 h-4" /> {t('projects.post_project')}
              </Link>
            )}
          </div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3">
            {visibleProjects.map((p) => (
              <motion.div key={p.id} variants={fadeUp}>
                <ProjectCard
                  project={p}
                  isAr={isAr}
                  t={t}
                  locale={locale as string}
                  isApplied={appliedIds.has(p.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Pagination ── */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setFilters({ ...filters, page: p })}
                className={clsx(
                  'w-9 h-9 rounded-xl text-sm font-semibold transition-all',
                  filters.page === p
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-400',
                )}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── Project Card ────────────────────────────────────────────────────────────

function ProjectCard({
  project: p, isAr, t, locale, isApplied,
}: {
  project: Project; isAr: boolean; t: any; locale: string; isApplied: boolean;
}) {
  const title = isAr ? p.title_ar || p.title_en : p.title_en;
  const desc  = p.description_en;

  const budgetLabel = p.budget_type === 'fixed'
    ? `${formatJOD(p.budget_min || 0)} – ${formatJOD(p.budget_max || 0)}`
    : `${formatJOD(p.budget_min || 0)}/hr`;

  // Status label — only show known statuses, never "projects.undefined"
  const statusLabel = p.status === 'open'   ? (isAr ? 'مفتوح'  : 'Open')
                    : p.status === 'closed' ? (isAr ? 'مغلق'   : 'Closed')
                    : p.status === 'in_progress' ? (isAr ? 'جارٍ' : 'In Progress')
                    : p.status ?? '';

  return (
    <Link href={`/projects/${p.id}`}
      className={clsx(
        'group block bg-white rounded-2xl border hover:shadow-md transition-all duration-200 p-5',
        isApplied ? 'border-green-200 bg-green-50/30' : 'border-gray-100 hover:border-primary-200',
      )}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1.5">
            <h2 className="font-bold text-gray-900 group-hover:text-primary-700 transition-colors leading-snug">
              {title}
            </h2>
            {/* Status badge — use inline label to avoid missing translation keys */}
            {statusLabel && (
              <Badge status={p.status} label={statusLabel} />
            )}
            {/* Applied badge */}
            {isApplied && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <CheckCircleIcon className="w-3 h-3" />
                {isAr ? 'تم التقديم' : 'Applied'}
              </span>
            )}
          </div>

          {desc && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">{desc}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1.5 font-semibold text-primary-700">
              <BanknotesIcon className="w-3.5 h-3.5" />
              {budgetLabel}
            </span>
            <span className="flex items-center gap-1.5">
              <UserGroupIcon className="w-3.5 h-3.5" />
              {p.proposals_count ?? 0} {isAr ? 'عرض' : 'proposals'}
            </span>
            {p.preferred_city && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5" />
                {t(`cities.${p.preferred_city}`)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5" />
              {timeAgo(p.created_at, locale)}
            </span>
          </div>
        </div>

        {/* Client */}
        {(p as any).client_name && (
          <div className="flex items-center gap-2 shrink-0">
            {(p as any).client_avatar
              ? <img src={(p as any).client_avatar} className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100" alt="" />
              : <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 text-xs font-bold">{((p as any).client_name || 'C')[0]}</span>
                </div>
            }
            <span className="text-xs text-gray-500 hidden sm:block max-w-[100px] truncate">{(p as any).client_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
