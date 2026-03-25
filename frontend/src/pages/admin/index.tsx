import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import { adminApi, withdrawalsApi, contentApi, paymentsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';

type AdminTab =
  | 'stats' | 'users' | 'gigs' | 'projects' | 'kyc' | 'disputes'
  | 'finance' | 'transactions' | 'reports' | 'categories' | 'cms' | 'broadcast' | 'settings';

// ─── tiny modal helper ────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useTranslation('common');
  const { locale } = useRouter();
  const isAr = locale === 'ar';
  const { isAdmin, user } = useAuth();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  const [tab, setTab] = useState<AdminTab>('stats');

  // ── data states ──────────────────────────────────────────────
  const [stats, setStats]             = useState<any>(null);
  const [users, setUsers]             = useState<any[]>([]);
  const [kycQueue, setKycQueue]       = useState<any[]>([]);
  const [disputes, setDisputes]       = useState<any[]>([]);
  const [finance, setFinance]         = useState<any>(null);
  const [transactions, setTx]         = useState<any[]>([]);
  const [gigs, setGigs]               = useState<any[]>([]);
  const [projects, setProjects]       = useState<any[]>([]);
  const [categories, setCategories]   = useState<any[]>([]);
  const [skills, setSkills]           = useState<any[]>([]);
  const [banners, setBanners]         = useState<any[]>([]);
  const [faqs, setFaqs]               = useState<any[]>([]);
  const [settings, setSettings]       = useState<any[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);

  // ── modal states ─────────────────────────────────────────────
  const [kycModal, setKycModal]       = useState<any>(null);
  const [disputeModal, setDisputeModal] = useState<any>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; type: 'kyc' | 'dispute' } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [splitModal, setSplitModal]   = useState<any>(null);
  const [clientPct, setClientPct]     = useState(50);

  // ── broadcast form ───────────────────────────────────────────
  const [bc, setBc] = useState({ title_en: '', title_ar: '', body_en: '', body_ar: '', target: 'all' as const });

  // ── cms form ─────────────────────────────────────────────────
  const [bannerForm, setBannerForm] = useState({ title_en: '', title_ar: '', image_url: '', link_url: '', is_active: true });
  const [faqForm, setFaqForm]       = useState({ question_en: '', question_ar: '', answer_en: '', answer_ar: '' });
  const [pageKey, setPageKey]       = useState('terms');
  const [pageContent, setPageContent] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    adminApi.stats().then((r) => setStats(r.data.data)).catch(() => {});
    adminApi.users().then((r) => setUsers(r.data.data)).catch(() => {});
    adminApi.gigs({ limit: 100 }).then((r) => setGigs(r.data?.data?.data ?? r.data?.data ?? [])).catch(() => {});
    adminApi.projects({ limit: 100 }).then((r) => setProjects(r.data?.data?.data ?? r.data?.data ?? [])).catch(() => {});
    adminApi.categories().then((r) => setCategories(r.data?.data ?? [])).catch(() => {});
    adminApi.skills().then((r) => setSkills(r.data?.data ?? [])).catch(() => {});
    adminApi.kycQueue().then((r) => setKycQueue(r.data.data)).catch(() => {});
    adminApi.disputes().then((r) => setDisputes(r.data.data)).catch(() => {});
    adminApi.financeOverview().then((r) => setFinance(r.data.data)).catch(() => {});
    adminApi.transactions().then((r) => setTx(r.data.data)).catch(() => {});
    contentApi.getBanners(true).then((r) => setBanners(r.data.data)).catch(() => {});
    contentApi.getFaq().then((r) => setFaqs(r.data.data)).catch(() => {});
    adminApi.settings().then((r) => setSettings(r.data.data)).catch(() => {});
    paymentsApi.adminPendingDeposits().then((r) => setPendingDeposits(r.data?.data ?? [])).catch(() => {});
  }, [isAdmin]);

  // load CMS page content when key changes
  useEffect(() => {
    if (!isAdmin || tab !== 'cms') return;
    contentApi.getPage(pageKey).then((r) => setPageContent(r.data.data?.content ?? '')).catch(() => {});
  }, [pageKey, tab, isAdmin]);

  if (authLoading || !isAuthenticated) return null;
  if (!isAdmin) return (
    <Layout title="Access Denied">
      <p className="text-center py-20 text-red-500">Access denied</p>
    </Layout>
  );

  const TABS: { id: AdminTab; label: string; badge?: number }[] = [
    { id: 'stats',        label: isAr ? 'الإحصائيات' : 'Stats' },
    { id: 'users',        label: isAr ? 'المستخدمون' : 'Users' },
    { id: 'gigs',         label: isAr ? 'الخدمات' : 'Gigs', badge: gigs.length || undefined },
    { id: 'projects',     label: isAr ? 'المشاريع' : 'Projects' },
    { id: 'kyc',          label: isAr ? 'التحقق KYC' : 'KYC', badge: kycQueue.length || undefined },
    { id: 'disputes',     label: isAr ? 'النزاعات' : 'Disputes',
      badge: disputes.filter((d) => d.status === 'open').length || undefined },
    { id: 'finance',      label: isAr ? 'المالية' : 'Finance' },
    { id: 'transactions', label: isAr ? 'المعاملات' : 'Transactions' },
    { id: 'reports',      label: isAr ? 'التقارير' : 'Reports' },
    { id: 'categories',   label: isAr ? 'الفئات والمهارات' : 'Categories & Skills' },
    { id: 'cms',          label: isAr ? 'المحتوى CMS' : 'CMS' },
    { id: 'broadcast',    label: isAr ? 'إشعار جماعي' : 'Broadcast' },
    { id: 'settings',     label: isAr ? 'الإعدادات' : 'Settings' },
  ];

  // ── helpers ──────────────────────────────────────────────────
  async function handleVerifyKyc(userId: string, status: 'verified' | 'rejected' | 'reupload', reason?: string) {
    await adminApi.verifyIdentity(userId, status === 'reupload' ? 'pending' : status, reason);
    toast.success(status === 'verified' ? 'Verified!' : status === 'rejected' ? 'Rejected' : 'Re-upload requested');
    setKycQueue((p) => p.filter((u) => u.id !== userId));
    setKycModal(null);
    setRejectModal(null);
  }

  async function handleResolveDispute(id: string, resolution: string, note: string, cp?: number) {
    await adminApi.resolveDispute(id, {
      resolution,
      note,
      client_pct: cp,
      freelancer_pct: cp !== undefined ? 100 - cp : undefined,
    });
    toast.success('Dispute resolved!');
    setDisputes((p) => p.map((d) => d.id === id ? { ...d, status: 'resolved_client' } : d));
    setDisputeModal(null);
    setSplitModal(null);
  }

  async function openDisputeDetail(d: any) {
    const res = await adminApi.getDispute(d.id);
    setDisputeModal(res.data.data);
  }

  return (
    <Layout title="Admin Panel" titleAr="لوحة الإدارة" fullWidth>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="page-title">{isAr ? 'لوحة الإدارة' : 'Admin Panel'}</h1>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-48 shrink-0">
            <nav className="space-y-1">
              {TABS.map((item) => (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={clsx(
                    'w-full text-start px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-between',
                    tab === item.id ? 'bg-primary-700 text-white' : 'text-gray-600 hover:bg-gray-100',
                  )}>
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className={clsx('text-xs rounded-full px-1.5 py-0.5 font-bold',
                      tab === item.id ? 'bg-white/30 text-white' : 'bg-red-500 text-white')}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">

            {/* ── STATS ───────────────────────────────────────── */}
            {tab === 'stats' && stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: isAr ? 'المستخدمون' : 'Total Users',        value: stats.total_users,                    color: 'bg-blue-600' },
                  { label: isAr ? 'المستقلون' : 'Freelancers',          value: stats.total_freelancers,              color: 'bg-primary-600' },
                  { label: isAr ? 'العملاء' : 'Clients',                value: stats.total_clients,                  color: 'bg-purple-600' },
                  { label: isAr ? 'خدمات نشطة' : 'Active Gigs',         value: stats.active_gigs,                    color: 'bg-yellow-500' },
                  { label: isAr ? 'طلبات مكتملة' : 'Completed Orders',  value: stats.completed_orders,               color: 'bg-green-600' },
                  { label: isAr ? 'عمولات (دينار)' : 'Commission (JOD)', value: formatJOD(stats.total_commission_jod), color: 'bg-primary-700' },
                  { label: isAr ? 'سحوبات معلقة' : 'Pending Withdrawals', value: stats.pending_withdrawals,          color: 'bg-orange-500' },
                  { label: isAr ? 'تحقق هوية معلق' : 'ID Verifications', value: stats.pending_identity_verifications, color: 'bg-red-600' },
                ].map((s) => (
                  <div key={s.label} className={`${s.color} text-white rounded-2xl p-5`}>
                    <p className="text-2xl font-black">{s.value}</p>
                    <p className="text-sm opacity-80 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── USERS ───────────────────────────────────────── */}
            {tab === 'users' && (
              <div className="card overflow-hidden !p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[isAr ? 'الاسم' : 'Name', isAr ? 'البريد' : 'Email',
                        isAr ? 'الدور' : 'Role', isAr ? 'الحالة' : 'Status',
                        isAr ? 'الهوية' : 'ID', isAr ? 'الهاتف' : 'Phone', isAr ? 'إجراء' : 'Action'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{u.full_name_en}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3"><Badge status={u.role} label={u.role} /></td>
                        <td className="px-4 py-3"><Badge status={u.status} /></td>
                        <td className="px-4 py-3"><Badge status={u.identity_verified || 'unverified'} /></td>
                        <td className="px-4 py-3">
                          {u.phone_verified
                            ? <span className="text-xs text-green-600 font-semibold">✓ {isAr ? 'موثّق' : 'Verified'}</span>
                            : <span className="text-xs text-gray-400">{isAr ? 'غير موثّق' : 'Unverified'}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {!u.phone_verified && (
                              <button onClick={() => adminApi.manualVerifyPhone(u.id)
                                .then(() => {
                                  toast.success(isAr ? 'تم توثيق الهاتف يدوياً' : 'Phone manually verified');
                                  setUsers((p) => p.map((x) => x.id === u.id ? { ...x, phone_verified: true } : x));
                                })
                                .catch(() => toast.error('Failed'))}
                                className="btn btn-outline btn-sm text-green-600 border-green-400 hover:bg-green-50">
                                {isAr ? 'توثيق الهاتف' : 'Verify Phone'}
                              </button>
                            )}
                            {u.status === 'active' && (
                              <button onClick={() => adminApi.updateUserStatus(u.id, 'suspended')
                                .then(() => { toast.success('Suspended'); setUsers((p) => p.map((x) => x.id === u.id ? { ...x, status: 'suspended' } : x)); })}
                                className="btn btn-outline btn-sm">
                                {isAr ? 'إيقاف' : 'Suspend'}
                              </button>
                            )}
                            {u.status === 'suspended' && (
                              <button onClick={() => adminApi.updateUserStatus(u.id, 'active')
                                .then(() => { toast.success('Activated'); setUsers((p) => p.map((x) => x.id === u.id ? { ...x, status: 'active' } : x)); })}
                                className="btn btn-primary btn-sm">
                                {isAr ? 'تفعيل' : 'Activate'}
                              </button>
                            )}
                            {u.status === 'active' && u.status !== 'banned' && (
                              <button onClick={() => adminApi.updateUserStatus(u.id, 'banned')
                                .then(() => { toast.success('Banned'); setUsers((p) => p.map((x) => x.id === u.id ? { ...x, status: 'banned' } : x)); })}
                                className="btn btn-danger btn-sm">
                                {isAr ? 'حظر' : 'Ban'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── GIGS ─────────────────────────────────────────── */}
            {tab === 'gigs' && (
              <div className="card overflow-hidden !p-0">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">{isAr ? 'إدارة الخدمات' : 'Manage Gigs'}</h2>
                  <span className="text-xs text-gray-500">{gigs.length} {isAr ? 'خدمة' : 'gigs'}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[isAr ? 'الخدمة' : 'Gig', isAr ? 'المستقل' : 'Freelancer',
                        isAr ? 'الفئة' : 'Category', isAr ? 'السعر' : 'Price',
                        isAr ? 'الطلبات' : 'Orders', isAr ? 'الحالة' : 'Status', isAr ? 'إجراء' : 'Action'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {gigs.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-400">{isAr ? 'لا توجد خدمات' : 'No gigs found'}</td></tr>
                    ) : gigs.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-gray-800 truncate">{isAr ? g.title_ar || g.title_en : g.title_en}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{g.freelancer_name_en}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{g.category_name_en}</td>
                        <td className="px-4 py-3 font-semibold text-primary-700">{formatJOD(g.price ?? g.basic_price ?? 0)}</td>
                        <td className="px-4 py-3 text-center">{g.orders_count ?? 0}</td>
                        <td className="px-4 py-3"><Badge status={g.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {g.status === 'active' ? (
                              <button
                                onClick={() => adminApi.updateGigStatus(g.id, 'paused')
                                  .then(() => { toast.success('Gig paused'); setGigs((p) => p.map((x) => x.id === g.id ? { ...x, status: 'paused' } : x)); })
                                  .catch(() => toast.error('Failed'))}
                                className="btn btn-outline btn-sm text-xs">
                                {isAr ? 'إيقاف' : 'Pause'}
                              </button>
                            ) : (
                              <button
                                onClick={() => adminApi.updateGigStatus(g.id, 'active')
                                  .then(() => { toast.success('Gig activated'); setGigs((p) => p.map((x) => x.id === g.id ? { ...x, status: 'active' } : x)); })
                                  .catch(() => toast.error('Failed'))}
                                className="btn btn-primary btn-sm text-xs">
                                {isAr ? 'تفعيل' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── PROJECTS ─────────────────────────────────────── */}
            {tab === 'projects' && (
              <div className="card overflow-hidden !p-0">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">{isAr ? 'إدارة المشاريع' : 'Manage Projects'}</h2>
                  <span className="text-xs text-gray-500">{projects.length} {isAr ? 'مشروع' : 'projects'}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[isAr ? 'المشروع' : 'Project', isAr ? 'العميل' : 'Client',
                        isAr ? 'الفئة' : 'Category', isAr ? 'الميزانية' : 'Budget',
                        isAr ? 'الاقتراحات' : 'Proposals', isAr ? 'الحالة' : 'Status', isAr ? 'إجراء' : 'Action'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {projects.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-400">{isAr ? 'لا توجد مشاريع' : 'No projects found'}</td></tr>
                    ) : projects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-gray-800 truncate">{isAr ? p.title_ar || p.title_en : p.title_en}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.client_name}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{p.category_name_en}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-primary-700">
                          {p.budget_type === 'hourly'
                            ? `${formatJOD(p.hourly_rate_min ?? 0)}–${formatJOD(p.hourly_rate_max ?? 0)}/hr`
                            : `${formatJOD(p.budget_min ?? 0)}–${formatJOD(p.budget_max ?? 0)}`}
                        </td>
                        <td className="px-4 py-3 text-center">{p.proposals_count ?? 0}</td>
                        <td className="px-4 py-3"><Badge status={p.status} /></td>
                        <td className="px-4 py-3">
                          {p.status === 'open' && (
                            <button
                              onClick={() => adminApi.cancelProject(p.id)
                                .then(() => { toast.success('Project cancelled'); setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'cancelled' } : x)); })
                                .catch(() => toast.error('Failed'))}
                              className="btn btn-danger btn-sm text-xs">
                              {isAr ? 'إلغاء' : 'Cancel'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── KYC QUEUE ───────────────────────────────────── */}
            {tab === 'kyc' && (
              <div className="space-y-3">
                <h2 className="section-title">{isAr ? 'طابور التحقق من الهوية' : 'Identity Verification Queue'}</h2>
                {kycQueue.length === 0
                  ? <p className="text-center text-gray-400 py-12">{isAr ? 'لا يوجد طلبات معلقة' : 'No pending verifications'}</p>
                  : kycQueue.map((u) => (
                    <div key={u.id} className="card flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {u.avatar_url
                          ? <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                          : <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                              {u.full_name_en?.[0]}
                            </div>
                        }
                        <div>
                          <p className="font-semibold">{u.full_name_en}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {u.identity_doc_url && (
                          <button onClick={() => setKycModal(u)}
                            className="btn btn-outline btn-sm">
                            {isAr ? 'عرض الوثيقة' : 'View Document'}
                          </button>
                        )}
                        <button onClick={() => handleVerifyKyc(u.id, 'verified')}
                          className="btn btn-primary btn-sm">
                          {isAr ? 'قبول' : 'Verify'}
                        </button>
                        <button onClick={() => { setRejectModal({ id: u.id, type: 'kyc' }); setRejectReason(''); }}
                          className="btn btn-danger btn-sm">
                          {isAr ? 'رفض' : 'Reject'}
                        </button>
                        <button onClick={() => handleVerifyKyc(u.id, 'reupload', 'Please re-upload a clearer document.')}
                          className="btn btn-outline btn-sm text-yellow-600 border-yellow-400">
                          {isAr ? 'إعادة رفع' : 'Re-upload'}
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* ── DISPUTES ────────────────────────────────────── */}
            {tab === 'disputes' && (
              <div className="space-y-3">
                <h2 className="section-title">{isAr ? 'إدارة النزاعات' : 'Dispute Management'}</h2>
                {disputes.length === 0
                  ? <p className="text-center text-gray-400 py-12">{isAr ? 'لا توجد نزاعات' : 'No disputes'}</p>
                  : disputes.map((d) => (
                    <div key={d.id}
                      className={clsx('card cursor-pointer hover:shadow-md transition',
                        d.status === 'open' ? 'border-l-4 border-red-400' :
                        d.status === 'under_review' ? 'border-l-4 border-yellow-400' : 'opacity-60')}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge status={d.status} label={d.status.replace('_', ' ')} />
                            {d.escrow_amount && (
                              <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                                {formatJOD(d.escrow_amount)} {isAr ? 'في الضمان' : 'in escrow'}
                              </span>
                            )}
                          </div>
                          <p className="font-semibold">{d.title_en}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isAr ? 'العميل:' : 'Client:'} {d.client_name} →{' '}
                            {isAr ? 'المستقل:' : 'Freelancer:'} {d.freelancer_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(d.created_at, locale as string)}</p>
                        </div>
                        {(d.status === 'open' || d.status === 'under_review') && (
                          <button onClick={() => openDisputeDetail(d)}
                            className="btn btn-primary btn-sm ms-4 shrink-0">
                            {isAr ? 'مراجعة' : 'Review'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* ── FINANCE OVERVIEW ────────────────────────────── */}
            {tab === 'finance' && finance && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-blue-600 text-white rounded-2xl p-5">
                    <p className="text-2xl font-black">{formatJOD(finance.total_escrow_held)}</p>
                    <p className="text-sm opacity-80 mt-1">{isAr ? 'إجمالي الضمان المحتجز' : 'Total Escrow Held'}</p>
                    <p className="text-xs opacity-60 mt-0.5">{finance.active_escrows} {isAr ? 'نشط' : 'active'}</p>
                  </div>
                  <div className="bg-green-600 text-white rounded-2xl p-5">
                    <p className="text-2xl font-black">{formatJOD(finance.total_commission)}</p>
                    <p className="text-sm opacity-80 mt-1">{isAr ? 'إجمالي عمولات المنصة' : 'Total Platform Revenue'}</p>
                  </div>
                  <div className="bg-orange-500 text-white rounded-2xl p-5">
                    <p className="text-2xl font-black">{formatJOD(finance.total_pending_withdrawals)}</p>
                    <p className="text-sm opacity-80 mt-1">{isAr ? 'سحوبات معلقة' : 'Pending Withdrawals'}</p>
                    <p className="text-xs opacity-60 mt-0.5">{finance.pending_withdrawal_count} {isAr ? 'طلب' : 'requests'}</p>
                  </div>
                </div>

                {/* Withdrawal list */}
                <h3 className="font-bold text-gray-800">{isAr ? 'طلبات السحب' : 'Withdrawal Requests'}</h3>
                {(!finance.withdrawals || finance.withdrawals.length === 0)
                  ? <p className="text-gray-400 text-center py-8">{isAr ? 'لا توجد سحوبات' : 'No withdrawals'}</p>
                  : (finance.withdrawals as any[]).map((w: any) => (
                    <div key={w.id} className="card">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold">{w.freelancer_name}</p>
                          <p className="text-xs text-gray-500">{w.freelancer_email}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-xl font-black text-primary-700">{formatJOD(w.amount)}</p>
                          <Badge status={w.status} />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        {isAr ? 'الطريقة:' : 'Method:'} {w.method?.replace('_', ' ')}
                      </p>
                      {w.bank_iban    && <p className="text-xs text-gray-500">IBAN: {w.bank_iban}</p>}
                      {w.mobile_number && <p className="text-xs text-gray-500">📱 {w.mobile_number}</p>}
                      {w.cliq_alias   && <p className="text-xs text-gray-500">CliQ: {w.cliq_alias}</p>}
                      <p className="text-xs text-gray-400 mt-1 mb-3">{timeAgo(w.created_at, locale as string)}</p>
                      {w.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => withdrawalsApi.approve(w.id, { reference: `REF-${Date.now()}` })
                              .then(() => {
                                toast.success(isAr ? 'تمت الموافقة' : 'Marked as paid!');
                                setFinance((prev: any) => ({
                                  ...prev,
                                  withdrawals: prev.withdrawals.map((x: any) =>
                                    x.id === w.id ? { ...x, status: 'approved' } : x),
                                }));
                              })}
                            className="btn btn-primary btn-sm">
                            {isAr ? 'تحديد كمدفوع' : 'Mark as Paid'}
                          </button>
                          <button
                            onClick={() => withdrawalsApi.reject(w.id, isAr ? 'مرفوض من المدير' : 'Rejected by admin')
                              .then(() => {
                                toast.error(isAr ? 'تم الرفض' : 'Rejected');
                                setFinance((prev: any) => ({
                                  ...prev,
                                  withdrawals: prev.withdrawals.filter((x: any) => x.id !== w.id),
                                }));
                              })}
                            className="btn btn-danger btn-sm">
                            {isAr ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                }

                {/* Pending Deposits */}
                <h3 className="font-bold text-gray-800 mt-6">{isAr ? 'إيداعات يدوية معلقة' : 'Pending Manual Deposits'}</h3>
                {pendingDeposits.length === 0
                  ? <p className="text-gray-400 text-center py-8">{isAr ? 'لا توجد إيداعات معلقة' : 'No pending deposits'}</p>
                  : pendingDeposits.map((dep: any) => (
                    <div key={dep.id} className="card border border-yellow-200 bg-yellow-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold">{dep.client_name || dep.user_name}</p>
                          <p className="text-xs text-gray-500">{dep.client_email || dep.user_email}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-xl font-black text-yellow-700">{formatJOD(dep.amount)}</p>
                          <p className="text-xs text-gray-500">{dep.payment_method?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {dep.metadata?.user_reference && (
                        <p className="text-xs text-gray-600 mb-1">
                          {isAr ? 'المرجع:' : 'Reference:'} <span className="font-mono font-semibold">{dep.metadata.user_reference}</span>
                        </p>
                      )}
                      {dep.metadata?.proof_image_url && (
                        <a href={dep.metadata.proof_image_url} target="_blank" rel="noopener noreferrer"
                          className="block mb-3">
                          <img src={dep.metadata.proof_image_url} alt="Payment proof"
                            className="h-32 w-auto rounded-lg border border-gray-200 object-cover hover:opacity-80 transition" />
                          <p className="text-xs text-primary-600 mt-1">{isAr ? 'عرض الإيصال' : 'View proof'}</p>
                        </a>
                      )}
                      <p className="text-xs text-gray-400 mb-3">{timeAgo(dep.created_at, locale as string)}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => paymentsApi.adminConfirmDeposit(dep.id)
                            .then(() => {
                              toast.success(isAr ? 'تم تأكيد الإيداع وإضافة الرصيد' : 'Deposit confirmed & balance credited!');
                              setPendingDeposits((prev) => prev.filter((d) => d.id !== dep.id));
                            })
                            .catch(() => toast.error(isAr ? 'فشل التأكيد' : 'Confirmation failed'))}
                          className="btn btn-primary btn-sm">
                          {isAr ? 'تأكيد وإضافة الرصيد' : 'Approve & Credit'}
                        </button>
                        <button
                          onClick={() => {
                            toast.error(isAr ? 'لم يتم تنفيذ رفض الإيداع بعد' : 'Deposit rejection not implemented yet');
                          }}
                          className="btn btn-danger btn-sm">
                          {isAr ? 'رفض' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}

            {/* ── TRANSACTIONS ────────────────────────────────── */}
            {tab === 'transactions' && (
              <div className="card overflow-hidden !p-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[isAr ? 'النوع' : 'Type', isAr ? 'المبلغ' : 'Amount',
                        isAr ? 'الحالة' : 'Status', isAr ? 'من' : 'From',
                        isAr ? 'إلى' : 'To', isAr ? 'التاريخ' : 'Date'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-4 py-3"><Badge status={tx.type} label={tx.type} /></td>
                        <td className="px-4 py-3 font-bold text-primary-700">{formatJOD(tx.amount)}</td>
                        <td className="px-4 py-3"><Badge status={tx.status} /></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{tx.from_email || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{tx.to_email  || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{timeAgo(tx.created_at, locale as string)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── REPORTS ─────────────────────────────────────── */}
            {tab === 'reports' && (
              <ReportsTab isAr={isAr} />
            )}

            {/* ── CATEGORIES & SKILLS ──────────────────────────── */}
            {tab === 'categories' && (
              <CategoriesSkillsTab
                isAr={isAr}
                categories={categories} setCategories={setCategories}
                skills={skills} setSkills={setSkills}
              />
            )}

            {/* ── CMS ─────────────────────────────────────────── */}
            {tab === 'cms' && (
              <div className="space-y-8">
                {/* Banners */}
                <section>
                  <h3 className="font-bold text-gray-800 mb-3">{isAr ? 'البانرات' : 'Banners'}</h3>
                  <div className="space-y-2 mb-4">
                    {banners.map((b) => (
                      <div key={b.id} className="card flex items-center justify-between gap-4">
                        {b.image_url && <img src={b.image_url} className="w-16 h-10 object-cover rounded-lg" alt="" />}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{b.title_en}</p>
                          <p className="text-xs text-gray-400">{b.title_ar}</p>
                        </div>
                        <Badge status={b.is_active ? 'active' : 'inactive'} />
                        <button onClick={() => adminApi.updateBanner(b.id, { is_active: !b.is_active })
                          .then(() => { toast.success('Updated'); setBanners((p) => p.map((x) => x.id === b.id ? { ...x, is_active: !b.is_active } : x)); })}
                          className="btn btn-outline btn-sm">
                          {b.is_active ? (isAr ? 'إخفاء' : 'Deactivate') : (isAr ? 'تفعيل' : 'Activate')}
                        </button>
                        <button onClick={() => adminApi.deleteBanner(b.id)
                          .then(() => { toast.success('Deleted'); setBanners((p) => p.filter((x) => x.id !== b.id)); })}
                          className="btn btn-danger btn-sm">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="card space-y-3">
                    <p className="font-semibold text-sm">{isAr ? 'إضافة بانر جديد' : 'Add New Banner'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="Title (EN)" value={bannerForm.title_en}
                        onChange={(e) => setBannerForm((p) => ({ ...p, title_en: e.target.value }))} />
                      <input className="input" placeholder="العنوان بالعربي" value={bannerForm.title_ar}
                        onChange={(e) => setBannerForm((p) => ({ ...p, title_ar: e.target.value }))} dir="rtl" />
                    </div>
                    <input className="input" placeholder="Image URL" value={bannerForm.image_url}
                      onChange={(e) => setBannerForm((p) => ({ ...p, image_url: e.target.value }))} />
                    <input className="input" placeholder="Link URL (optional)" value={bannerForm.link_url}
                      onChange={(e) => setBannerForm((p) => ({ ...p, link_url: e.target.value }))} />
                    <button onClick={() => adminApi.createBanner(bannerForm)
                      .then((r) => { toast.success('Banner created!'); setBanners((p) => [...p, r.data.data]); setBannerForm({ title_en: '', title_ar: '', image_url: '', link_url: '', is_active: true }); })}
                      className="btn btn-primary btn-sm">
                      {isAr ? 'إضافة' : 'Add Banner'}
                    </button>
                  </div>
                </section>

                {/* FAQs */}
                <section>
                  <h3 className="font-bold text-gray-800 mb-3">{isAr ? 'الأسئلة الشائعة' : 'FAQs'}</h3>
                  <div className="space-y-2 mb-4">
                    {faqs.map((f) => (
                      <div key={f.id} className="card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{f.question_en}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{f.answer_en?.slice(0, 80)}…</p>
                          </div>
                          <button onClick={() => adminApi.deleteFaq(f.id)
                            .then(() => { toast.success('Deleted'); setFaqs((p) => p.filter((x) => x.id !== f.id)); })}
                            className="btn btn-danger btn-sm ms-3">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card space-y-3">
                    <p className="font-semibold text-sm">{isAr ? 'إضافة سؤال جديد' : 'Add FAQ'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input" placeholder="Question (EN)" value={faqForm.question_en}
                        onChange={(e) => setFaqForm((p) => ({ ...p, question_en: e.target.value }))} />
                      <input className="input" placeholder="السؤال بالعربي" value={faqForm.question_ar}
                        onChange={(e) => setFaqForm((p) => ({ ...p, question_ar: e.target.value }))} dir="rtl" />
                      <textarea className="input" rows={3} placeholder="Answer (EN)" value={faqForm.answer_en}
                        onChange={(e) => setFaqForm((p) => ({ ...p, answer_en: e.target.value }))} />
                      <textarea className="input" rows={3} placeholder="الجواب بالعربي" value={faqForm.answer_ar}
                        onChange={(e) => setFaqForm((p) => ({ ...p, answer_ar: e.target.value }))} dir="rtl" />
                    </div>
                    <button onClick={() => adminApi.createFaq(faqForm)
                      .then((r) => { toast.success('FAQ added!'); setFaqs((p) => [...p, r.data.data]); setFaqForm({ question_en: '', question_ar: '', answer_en: '', answer_ar: '' }); })}
                      className="btn btn-primary btn-sm">
                      {isAr ? 'إضافة' : 'Add FAQ'}
                    </button>
                  </div>
                </section>

                {/* Static pages */}
                <section>
                  <h3 className="font-bold text-gray-800 mb-3">{isAr ? 'الصفحات الثابتة' : 'Static Pages'}</h3>
                  <div className="flex gap-2 mb-3">
                    {['terms', 'privacy', 'about'].map((k) => (
                      <button key={k} onClick={() => setPageKey(k)}
                        className={clsx('btn btn-sm', pageKey === k ? 'btn-primary' : 'btn-outline')}>
                        {k}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={12}
                    value={pageContent}
                    onChange={(e) => setPageContent(e.target.value)}
                    className="input w-full font-mono text-sm"
                    placeholder="Page content (HTML/Markdown)…"
                  />
                  <button onClick={() => adminApi.updatePage(pageKey, pageContent).then(() => toast.success('Page saved!'))}
                    className="btn btn-primary mt-2">
                    {isAr ? 'حفظ' : 'Save Page'}
                  </button>
                </section>
              </div>
            )}

            {/* ── BROADCAST ───────────────────────────────────── */}
            {tab === 'broadcast' && (
              <div className="max-w-xl space-y-4">
                <h2 className="section-title">{isAr ? 'إشعار جماعي' : 'Broadcast Notification'}</h2>
                <div className="card space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">{isAr ? 'العنوان بالإنجليزي' : 'Title (EN)'}</label>
                      <input className="input" value={bc.title_en}
                        onChange={(e) => setBc((p) => ({ ...p, title_en: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">{isAr ? 'العنوان بالعربي' : 'Title (AR)'}</label>
                      <input className="input" dir="rtl" value={bc.title_ar}
                        onChange={(e) => setBc((p) => ({ ...p, title_ar: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">{isAr ? 'الرسالة بالإنجليزي' : 'Body (EN)'}</label>
                      <textarea className="input" rows={4} value={bc.body_en}
                        onChange={(e) => setBc((p) => ({ ...p, body_en: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">{isAr ? 'الرسالة بالعربي' : 'Body (AR)'}</label>
                      <textarea className="input" rows={4} dir="rtl" value={bc.body_ar}
                        onChange={(e) => setBc((p) => ({ ...p, body_ar: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">{isAr ? 'إرسال إلى' : 'Send to'}</label>
                    <select className="input" value={bc.target}
                      onChange={(e) => setBc((p) => ({ ...p, target: e.target.value as any }))}>
                      <option value="all">{isAr ? 'الجميع' : 'All Users'}</option>
                      <option value="freelancers">{isAr ? 'المستقلون فقط' : 'Freelancers Only'}</option>
                      <option value="clients">{isAr ? 'العملاء فقط' : 'Clients Only'}</option>
                    </select>
                  </div>
                  <button
                    disabled={!bc.title_en || !bc.body_en}
                    onClick={() => adminApi.broadcast(bc)
                      .then((r: any) => {
                        toast.success(r.data.data?.message || 'Broadcast sent!');
                        setBc({ title_en: '', title_ar: '', body_en: '', body_ar: '', target: 'all' });
                      })}
                    className="btn btn-primary w-full">
                    {isAr ? 'إرسال الإشعار' : 'Send Broadcast'}
                  </button>
                </div>
              </div>
            )}

            {/* ── SETTINGS ────────────────────────────────────── */}
            {tab === 'settings' && (
              <div className="space-y-4 max-w-lg">
                {settings.map((s) => (
                  <div key={s.key} className="card flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{s.key}</p>
                      {s.description && <p className="text-xs text-gray-400">{s.description}</p>}
                    </div>
                    <input defaultValue={s.value} className="input w-32"
                      onBlur={(e) => adminApi.updateSetting(s.key, e.target.value)
                        .then(() => toast.success('Updated!'))} />
                  </div>
                ))}
              </div>
            )}

          </div>{/* /content */}
        </div>{/* /flex */}
      </div>{/* /container */}

      {/* ── MODAL: KYC Document ──────────────────────────────── */}
      <Modal open={!!kycModal} onClose={() => setKycModal(null)}
        title={kycModal ? `${kycModal.full_name_en} — Identity Document` : ''}>
        {kycModal && (
          <div className="space-y-4">
            <img src={kycModal.identity_doc_url} alt="ID Document"
              className="w-full rounded-xl border border-gray-200" />
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button onClick={() => handleVerifyKyc(kycModal.id, 'verified')}
                className="btn btn-primary">{isAr ? 'تحقق' : 'Verify'}</button>
              <button onClick={() => { setRejectModal({ id: kycModal.id, type: 'kyc' }); setRejectReason(''); setKycModal(null); }}
                className="btn btn-danger">{isAr ? 'رفض' : 'Reject'}</button>
              <button onClick={() => handleVerifyKyc(kycModal.id, 'reupload', 'Document unclear. Please re-upload.')}
                className="btn btn-outline text-yellow-600">{isAr ? 'إعادة رفع' : 'Re-upload'}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: Reject with reason ────────────────────────── */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)}
        title={isAr ? 'سبب الرفض' : 'Rejection Reason'}>
        {rejectModal && (
          <div className="space-y-4">
            <textarea className="input w-full" rows={4}
              placeholder={isAr ? 'اكتب سبب الرفض...' : 'Write rejection reason…'}
              value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRejectModal(null)} className="btn btn-outline">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                disabled={!rejectReason.trim()}
                onClick={() => handleVerifyKyc(rejectModal.id, 'rejected', rejectReason)}
                className="btn btn-danger">
                {isAr ? 'تأكيد الرفض' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: Dispute Detail ────────────────────────────── */}
      <Modal open={!!disputeModal} onClose={() => setDisputeModal(null)}
        title={disputeModal ? disputeModal.title_en : ''}>
        {disputeModal && (
          <div className="space-y-4">
            {/* Parties */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">{isAr ? 'العميل' : 'Client'}</p>
                <p className="font-semibold">{disputeModal.client_name}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">{isAr ? 'المستقل' : 'Freelancer'}</p>
                <p className="font-semibold">{disputeModal.freelancer_name}</p>
              </div>
            </div>

            {/* Description */}
            <div>
              <p className="text-xs text-gray-500 mb-1">{isAr ? 'الوصف' : 'Description'}</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{disputeModal.description_en}</p>
            </div>

            {/* Escrow info */}
            {disputeModal.escrow_amount && (
              <div className="bg-primary-50 rounded-xl p-3 flex justify-between">
                <span className="text-sm text-primary-800 font-medium">
                  {isAr ? 'مبلغ الضمان:' : 'Escrow Amount:'}
                </span>
                <span className="font-black text-primary-700">{formatJOD(disputeModal.escrow_amount)}</span>
              </div>
            )}

            {/* Attachments */}
            {disputeModal.attachment_urls?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">{isAr ? 'المرفقات' : 'Attachments'}</p>
                <div className="flex flex-wrap gap-2">
                  {disputeModal.attachment_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="text-xs text-primary-600 underline">
                      {isAr ? `ملف ${i + 1}` : `File ${i + 1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages preview */}
            {disputeModal.messages?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">{isAr ? 'سجل المحادثة' : 'Chat History'}</p>
                <div className="max-h-48 overflow-y-auto space-y-2 bg-gray-50 rounded-xl p-3">
                  {disputeModal.messages.map((m: any) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-semibold text-primary-700">{m.sender_name}: </span>
                      <span className="text-gray-700">{m.content}</span>
                      <span className="text-gray-400 ms-2">{timeAgo(m.created_at, locale as string)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution actions */}
            <div className="border-t pt-4 space-y-3">
              <p className="font-semibold text-sm">{isAr ? 'قرار الحل' : 'Resolution'}</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleResolveDispute(disputeModal.id, 'release_to_freelancer',
                    isAr ? 'تم الإفراج لصالح المستقل' : 'Released to freelancer by admin')}
                  className="btn btn-primary btn-sm">
                  {isAr ? 'تحرير للمستقل' : 'Release to Freelancer'}
                </button>
                <button
                  onClick={() => handleResolveDispute(disputeModal.id, 'refund_to_client',
                    isAr ? 'تم الاسترداد للعميل' : 'Refunded to client by admin')}
                  className="btn btn-danger btn-sm">
                  {isAr ? 'استرداد للعميل' : 'Refund to Client'}
                </button>
                <button
                  onClick={() => { setSplitModal(disputeModal); setClientPct(50); setDisputeModal(null); }}
                  className="btn btn-outline btn-sm text-yellow-700 border-yellow-400">
                  {isAr ? 'تقسيم جزئي' : 'Partial Split'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL: Partial Split ─────────────────────────────── */}
      <Modal open={!!splitModal} onClose={() => setSplitModal(null)}
        title={isAr ? 'تقسيم جزئي للضمان' : 'Partial Escrow Split'}>
        {splitModal && (
          <div className="space-y-5">
            <div className="bg-primary-50 rounded-xl p-4 flex justify-between">
              <span className="text-sm font-medium text-primary-800">
                {isAr ? 'إجمالي الضمان:' : 'Total escrow net:'}
              </span>
              <span className="font-black text-primary-700">{formatJOD(splitModal.escrow_net ?? splitModal.escrow_amount)}</span>
            </div>

            <div>
              <label className="label">{isAr ? 'نسبة العميل (%)' : `Client share: ${clientPct}%`}</label>
              <input type="range" min={0} max={100} step={5} value={clientPct}
                onChange={(e) => setClientPct(Number(e.target.value))}
                className="w-full accent-primary-600" />
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-700">
                  {isAr ? 'العميل:' : 'Client:'}{' '}
                  <strong>{clientPct}%</strong>{' '}
                  ({formatJOD(((splitModal.escrow_net ?? splitModal.escrow_amount) * clientPct) / 100)})
                </span>
                <span className="text-gray-700">
                  {isAr ? 'المستقل:' : 'Freelancer:'}{' '}
                  <strong>{100 - clientPct}%</strong>{' '}
                  ({formatJOD(((splitModal.escrow_net ?? splitModal.escrow_amount) * (100 - clientPct)) / 100)})
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setSplitModal(null)} className="btn btn-outline">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleResolveDispute(
                  splitModal.id, 'partial_split',
                  `Split: Client ${clientPct}% / Freelancer ${100 - clientPct}%`,
                  clientPct,
                )}
                className="btn btn-primary">
                {isAr ? 'تأكيد التقسيم' : 'Confirm Split'}
              </button>
            </div>
          </div>
        )}
      </Modal>

    </Layout>
  );
}

// ─── Reports Tab ────────────────────────────────────────────────────────────
function ReportsTab({ isAr }: { isAr: boolean }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [loading, setLoading] = useState(false);

  async function download() {
    if (!from || !to) { toast.error(isAr ? 'يرجى تحديد نطاق التاريخ' : 'Please select a date range'); return; }
    setLoading(true);
    try {
      const res = await adminApi.downloadReport(from, to, format);
      const blob = new Blob([res.data], { type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-report-${from}-${to}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isAr ? 'تم تحميل التقرير' : 'Report downloaded');
    } catch {
      toast.error(isAr ? 'فشل تحميل التقرير' : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-gray-900">{isAr ? 'تقارير المنصة' : 'Platform Reports'}</h2>
      <div className="card space-y-5">
        <h3 className="font-semibold text-gray-800">{isAr ? 'تقرير المدفوعات' : 'Payments Report'}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isAr ? 'من تاريخ' : 'From Date'}</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isAr ? 'إلى تاريخ' : 'To Date'}</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{isAr ? 'الصيغة' : 'Format'}</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="input w-full">
              <option value="pdf">PDF</option>
              <option value="excel">Excel (.xlsx)</option>
            </select>
          </div>
        </div>
        <button onClick={download} disabled={loading || !from || !to} className="btn btn-primary gap-2">
          {loading ? (isAr ? 'جاري التوليد...' : 'Generating...') : (isAr ? 'تحميل التقرير' : 'Download Report')}
        </button>
      </div>
    </div>
  );
}

// ─── Categories & Skills Tab ─────────────────────────────────────────────────
function CategoriesSkillsTab({ isAr, categories, setCategories, skills, setSkills }: any) {
  const [catForm, setCatForm] = useState({ name_en: '', name_ar: '', icon: '' });
  const [skillForm, setSkillForm] = useState({ name_en: '', name_ar: '' });
  const [editCat, setEditCat] = useState<any>(null);
  const [editSkill, setEditSkill] = useState<any>(null);

  async function saveCategory() {
    try {
      if (editCat) {
        const res = await adminApi.updateCategory(editCat.id, catForm);
        setCategories((p: any[]) => p.map((c) => c.id === editCat.id ? res.data?.data ?? res.data : c));
        toast.success(isAr ? 'تم تحديث الفئة' : 'Category updated');
        setEditCat(null);
      } else {
        const res = await adminApi.createCategory(catForm);
        setCategories((p: any[]) => [...p, res.data?.data ?? res.data]);
        toast.success(isAr ? 'تم إضافة الفئة' : 'Category added');
      }
      setCatForm({ name_en: '', name_ar: '', icon: '' });
    } catch { toast.error(isAr ? 'حدث خطأ' : 'An error occurred'); }
  }

  async function deleteCategory(id: string) {
    await adminApi.deleteCategory(id).catch(() => {});
    setCategories((p: any[]) => p.filter((c) => c.id !== id));
    toast.success(isAr ? 'تم حذف الفئة' : 'Category removed');
  }

  async function saveSkill() {
    try {
      if (editSkill) {
        const res = await adminApi.updateSkill(editSkill.id, skillForm);
        setSkills((p: any[]) => p.map((s) => s.id === editSkill.id ? res.data?.data ?? res.data : s));
        toast.success(isAr ? 'تم تحديث المهارة' : 'Skill updated');
        setEditSkill(null);
      } else {
        const res = await adminApi.createSkill(skillForm);
        setSkills((p: any[]) => [...p, res.data?.data ?? res.data]);
        toast.success(isAr ? 'تم إضافة المهارة' : 'Skill added');
      }
      setSkillForm({ name_en: '', name_ar: '' });
    } catch { toast.error(isAr ? 'حدث خطأ' : 'An error occurred'); }
  }

  async function deleteSkill(id: string) {
    await adminApi.deleteSkill(id).catch(() => {});
    setSkills((p: any[]) => p.filter((s) => s.id !== id));
    toast.success(isAr ? 'تم حذف المهارة' : 'Skill removed');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Categories */}
      <div className="space-y-4">
        <h2 className="font-bold text-gray-900">{isAr ? 'الفئات' : 'Categories'}</h2>
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editCat ? (isAr ? 'تعديل فئة' : 'Edit Category') : (isAr ? 'إضافة فئة جديدة' : 'Add New Category')}</h3>
          <input value={catForm.name_en} onChange={(e) => setCatForm({ ...catForm, name_en: e.target.value })} placeholder="Name (English)" className="input w-full text-sm" />
          <input value={catForm.name_ar} onChange={(e) => setCatForm({ ...catForm, name_ar: e.target.value })} placeholder="الاسم (عربي)" className="input w-full text-sm" dir="rtl" />
          <input value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} placeholder="Icon (emoji or name)" className="input w-full text-sm" />
          <div className="flex gap-2">
            {editCat && <button onClick={() => { setEditCat(null); setCatForm({ name_en: '', name_ar: '', icon: '' }); }} className="btn btn-ghost flex-1 text-sm">{isAr ? 'إلغاء' : 'Cancel'}</button>}
            <button onClick={saveCategory} disabled={!catForm.name_en} className="btn btn-primary flex-1 text-sm">
              {editCat ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إضافة' : 'Add')}
            </button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {categories.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{c.name_en}</p>
                <p className="text-xs text-gray-500">{c.name_ar}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { setEditCat(c); setCatForm({ name_en: c.name_en, name_ar: c.name_ar || '', icon: c.icon || '' }); }} className="btn btn-outline btn-sm text-xs">{isAr ? 'تعديل' : 'Edit'}</button>
                <button onClick={() => deleteCategory(c.id)} className="btn btn-danger btn-sm text-xs">{isAr ? 'حذف' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="space-y-4">
        <h2 className="font-bold text-gray-900">{isAr ? 'المهارات' : 'Skills'}</h2>
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">{editSkill ? (isAr ? 'تعديل مهارة' : 'Edit Skill') : (isAr ? 'إضافة مهارة جديدة' : 'Add New Skill')}</h3>
          <input value={skillForm.name_en} onChange={(e) => setSkillForm({ ...skillForm, name_en: e.target.value })} placeholder="Skill name (English)" className="input w-full text-sm" />
          <input value={skillForm.name_ar} onChange={(e) => setSkillForm({ ...skillForm, name_ar: e.target.value })} placeholder="اسم المهارة (عربي)" className="input w-full text-sm" dir="rtl" />
          <div className="flex gap-2">
            {editSkill && <button onClick={() => { setEditSkill(null); setSkillForm({ name_en: '', name_ar: '' }); }} className="btn btn-ghost flex-1 text-sm">{isAr ? 'إلغاء' : 'Cancel'}</button>}
            <button onClick={saveSkill} disabled={!skillForm.name_en} className="btn btn-primary flex-1 text-sm">
              {editSkill ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إضافة' : 'Add')}
            </button>
          </div>
        </div>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {skills.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium text-gray-800">{s.name_en}</p>
                <p className="text-xs text-gray-500">{s.name_ar}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { setEditSkill(s); setSkillForm({ name_en: s.name_en, name_ar: s.name_ar || '' }); }} className="btn btn-outline btn-sm text-xs">{isAr ? 'تعديل' : 'Edit'}</button>
                <button onClick={() => deleteSkill(s.id)} className="btn btn-danger btn-sm text-xs">{isAr ? 'حذف' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
