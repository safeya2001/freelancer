import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import RatingStars from '@/components/ui/RatingStars';
import { projectsApi, proposalsApi, uploadsApi, authApi, chatApi } from '@/services/api';
import { Project, Proposal } from '@/types';
import ChatRoom from '@/components/chat/ChatRoom';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';

interface ProposalForm {
  cover_letter_en: string;
  cover_letter_ar: string;
  proposed_budget: number;
  delivery_days: number;
}

export default function ProjectDetailPage() {
  const { t } = useTranslation('common');
  const { locale, query, push } = useRouter();
  const isAr = locale === 'ar';
  const { isFreelancer, isClient, isAuthenticated, user, loading: authLoading, reloadAuth } = useAuth();

  const [project, setProject]               = useState<Project | null>(null);
  const [proposals, setProposals]           = useState<Proposal[]>([]);
  const [loading, setLoading]               = useState(true);
  const [proposalModal, setProposalModal]   = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [otpSent, setOtpSent]       = useState(false);
  const [otpCode, setOtpCode]       = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  // Interview chat: modal with ChatRoom for a specific proposal
  const [interviewRoom, setInterviewRoom] = useState<{ roomId: string; proposalId: string; freelancerName: string } | null>(null);
  const [interviewLoading, setInterviewLoading] = useState<string | null>(null); // proposal id being opened
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProposalForm>();

  // ── Load project + proposals ─────────────────────────────────────────────
  useEffect(() => {
    if (!query.id) return;
    setLoading(true);
    projectsApi.get(query.id as string)
      .then((r) => setProject(r.data.data))
      .catch(() => setProject(null))
      .finally(() => setLoading(false));

    if (isClient && user) {
      proposalsApi.getProjectProposals(query.id as string)
        .then((r) => setProposals(r.data.data))
        .catch(() => {});
    }

    // Check if this freelancer already submitted
    if (isFreelancer) {
      proposalsApi.myProposals()
        .then((r) => {
          const mine = (r.data.data as any[]) || [];
          const found = mine.some((p: any) => p.project_id === query.id);
          setAlreadyApplied(found);
        })
        .catch(() => {});
    }
  }, [query.id, isClient, isFreelancer, user]);

  // ── File upload ──────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFiles(true);
    try {
      const res = await uploadsApi.multiple(files);
      const urls: string[] = res.data.data?.urls || res.data.data || [];
      setAttachmentUrls((prev) => [...prev, ...urls]);
      setAttachmentNames((prev) => [...prev, ...files.map((f) => f.name)]);
    } catch {
      toast.error(isAr ? 'فشل رفع الملف' : 'File upload failed');
    } finally {
      setUploadingFiles(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removeAttachment(idx: number) {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== idx));
    setAttachmentNames((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Submit proposal ──────────────────────────────────────────────────────
  async function submitProposal(data: ProposalForm) {
    try {
      await proposalsApi.submit({
        project_id: project!.id,
        cover_letter_en: data.cover_letter_en,
        cover_letter_ar: data.cover_letter_ar || undefined,
        proposed_budget: Number(data.proposed_budget),
        delivery_days: Number(data.delivery_days),
        attachment_urls: attachmentUrls,
      });
      toast.success(
        isAr
          ? '✅ تم تقديم عرضك بنجاح! سيتلقى العميل إشعاراً الآن.'
          : '✅ Your proposal has been submitted successfully!',
        { duration: 5000 }
      );
      setProposalModal(false);
      setAlreadyApplied(true);
      setAttachmentUrls([]);
      setAttachmentNames([]);
      reset();
      // Refresh proposal count
      setProject((prev) => prev ? { ...prev, proposals_count: (prev.proposals_count || 0) + 1 } : prev);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      if (msg?.includes('phone')) {
        toast.error(isAr ? 'يجب التحقق من رقم هاتفك أولاً لتقديم العروض.' : 'Please verify your phone number first.');
      } else if (msg?.includes('already')) {
        toast.error(isAr ? 'لقد قدّمت عرضاً على هذا المشروع مسبقاً.' : 'You already submitted a proposal.');
        setAlreadyApplied(true);
        setProposalModal(false);
      } else {
        toast.error(msg || t('common.error'));
      }
    }
  }

  // ── Client actions ───────────────────────────────────────────────────────
  async function acceptProposal(id: string) {
    try {
      await proposalsApi.accept(id);
      toast.success(isAr ? 'تم قبول العرض وإنشاء العقد' : 'Proposal accepted — contract created!');
      setProposals((p) => p.map((x) => x.id === id ? { ...x, status: 'accepted' } : x));
    } catch (e: any) { toast.error(e.response?.data?.message || t('common.error')); }
  }

  async function rejectProposal(id: string) {
    try {
      await proposalsApi.reject(id);
      toast.success(isAr ? 'تم رفض العرض' : 'Proposal rejected');
      setProposals((p) => p.map((x) => x.id === id ? { ...x, status: 'rejected' } : x));
    } catch (e: any) { toast.error(e.response?.data?.message || t('common.error')); }
  }

  // ── Client payment verified heuristic ─────────────────────────────────
  const clientPaymentVerified = Number(project?.client_total_spent || 0) > 0
    || Number(project?.client_total_orders || 0) > 0;

  // ── Loading / not found ──────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout title="Loading...">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
          <div className="lg:col-span-2 space-y-4">
            <div className="card h-64 bg-gray-100" />
            <div className="card h-48 bg-gray-100" />
          </div>
          <div className="space-y-4">
            <div className="card h-40 bg-gray-100" />
            <div className="card h-24 bg-gray-100" />
          </div>
        </div>
      </Layout>
    );
  }
  if (!project) {
    return (
      <Layout title="Not Found">
        <div className="text-center py-24">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-gray-500">{isAr ? 'المشروع غير موجود' : 'Project not found'}</p>
        </div>
      </Layout>
    );
  }

  const isOwner = isClient && user?.id === project.client_id;
  const canApply = isFreelancer && project.status === 'open';
  // In dev, bypass phone verification entirely so the workflow can be tested
  const isDev = process.env.NODE_ENV !== 'production';
  const phoneVerified = isDev ? true : (user?.phone_verified ?? false);

  console.log('[ProjectDetail] phone_verified:', user?.phone_verified, '| isDev:', isDev, '| effective:', phoneVerified);

  return (
    <Layout title={project.title_en} titleAr={project.title_ar || project.title_en}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Main Content ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Project header */}
            <div className="card">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 leading-snug">
                  {isAr ? project.title_ar || project.title_en : project.title_en}
                </h1>
                <Badge status={project.status} label={t(`projects.${project.status}`)} />
              </div>

              {/* Category breadcrumb */}
              {project.category_name_en && (
                <p className="text-xs text-primary-600 font-medium mb-4">
                  {isAr ? project.category_name_ar : project.category_name_en}
                </p>
              )}

              <p className="text-gray-600 leading-relaxed whitespace-pre-line mb-6">
                {isAr ? project.description_ar || project.description_en : project.description_en}
              </p>

              {/* Key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 mb-1">{isAr ? 'نوع الميزانية' : 'Budget type'}</p>
                  <p className="font-semibold text-sm">{t(`projects.${project.budget_type}`)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">{isAr ? 'الميزانية' : 'Budget'}</p>
                  <p className="font-semibold text-sm text-primary-700">
                    {project.budget_type === 'hourly'
                      ? `${formatJOD(project.hourly_rate_min || 0)}–${formatJOD(project.hourly_rate_max || 0)}/hr`
                      : `${formatJOD(project.budget_min || 0)}${project.budget_max ? ` – ${formatJOD(project.budget_max)}` : '+'}`}
                  </p>
                </div>
                {project.deadline && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{isAr ? 'الموعد النهائي' : 'Deadline'}</p>
                    <p className="font-semibold text-sm">{new Date(project.deadline).toLocaleDateString()}</p>
                  </div>
                )}
                {project.preferred_city && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{isAr ? 'الموقع' : 'Location'}</p>
                    <p className="font-semibold text-sm">{t(`cities.${project.preferred_city}`)}</p>
                  </div>
                )}
              </div>

              {/* Skills */}
              {project.skills && project.skills.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">{isAr ? 'المهارات المطلوبة' : 'Required Skills'}</p>
                  <div className="flex flex-wrap gap-2">
                    {project.skills.map((s: any) => (
                      <span key={s.id} className="badge badge-green text-xs px-3 py-1">
                        {isAr ? s.name_ar : s.name_en}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Proposals list — visible to project owner only */}
            {isOwner && (
              <div className="card">
                <h2 className="section-title mb-4">
                  {isAr ? 'العروض المقدمة' : 'Submitted Proposals'}
                  {proposals.length > 0 && (
                    <span className="ml-2 bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      {proposals.length}
                    </span>
                  )}
                </h2>

                {proposals.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm">{isAr ? 'لا توجد عروض بعد' : 'No proposals yet'}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {proposals.map((prop: any) => (
                      <div key={prop.id}
                        className="border border-gray-100 rounded-2xl p-4 hover:border-primary-200 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            {prop.avatar_url
                              ? <img src={prop.avatar_url} className="w-11 h-11 rounded-full object-cover" alt="" />
                              : <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
                                  {(prop.freelancer_name || '?')[0]}
                                </div>
                            }
                            <div>
                              <p className="font-semibold text-sm">{isAr ? prop.freelancer_name_ar || prop.freelancer_name : prop.freelancer_name}</p>
                              <p className="text-xs text-gray-400">{prop.professional_title_en}</p>
                              <RatingStars rating={Number(prop.avg_rating) || 0} count={prop.review_count} />
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="font-bold text-primary-700 text-lg">{formatJOD(prop.proposed_budget)}</p>
                            <p className="text-xs text-gray-400">{prop.delivery_days} {isAr ? 'يوم' : 'days'}</p>
                            <p className="text-xs text-gray-400">{prop.total_jobs_done} {isAr ? 'مشروع مكتمل' : 'jobs done'}</p>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-4">
                          {isAr ? prop.cover_letter_ar || prop.cover_letter_en : prop.cover_letter_en}
                        </p>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400">{timeAgo(prop.created_at, locale as string)}</p>
                          {prop.status === 'pending' ? (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                disabled={interviewLoading === prop.id}
                                onClick={async () => {
                                  setInterviewLoading(prop.id);
                                  try {
                                    const r = await chatApi.getOrCreateProposalRoom(prop.id);
                                    const roomId = r.data?.data?.room_id;
                                    setInterviewRoom({ roomId, proposalId: prop.id, freelancerName: prop.freelancer_name });
                                  } catch { toast.error('Could not open chat'); }
                                  finally { setInterviewLoading(null); }
                                }}
                                className="btn btn-outline btn-sm text-primary-700 border-primary-200 hover:bg-primary-50">
                                {interviewLoading === prop.id ? '...' : (isAr ? '💬 مقابلة' : '💬 Interview')}
                              </button>
                              <button onClick={() => acceptProposal(prop.id)}
                                className="btn btn-primary btn-sm">
                                {isAr ? 'قبول العرض' : '✓ Hire'}
                              </button>
                              <button onClick={() => rejectProposal(prop.id)}
                                className="btn btn-outline btn-sm text-red-500 border-red-200 hover:bg-red-50">
                                {isAr ? 'رفض' : 'Decline'}
                              </button>
                            </div>
                          ) : (
                            <Badge status={prop.status} label={t(`proposals.status_${prop.status}`)} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Client card */}
            <div className="card">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                {isAr ? 'معلومات العميل' : 'About the Client'}
              </h3>
              <div className="flex items-center gap-3 mb-4">
                {project.client_avatar
                  ? <img src={project.client_avatar} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  : <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
                      {(project.client_name || 'C')[0]}
                    </div>
                }
                <div>
                  <p className="font-bold text-sm">{isAr ? project.client_name_ar || project.client_name : project.client_name}</p>
                  {project.company_name && (
                    <p className="text-xs text-gray-400">{project.company_name}</p>
                  )}
                  {project.client_city && (
                    <p className="text-xs text-gray-400">📍 {t(`cities.${project.client_city}`)}</p>
                  )}
                </div>
              </div>

              {/* Client stats */}
              <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{isAr ? 'إجمالي العروض' : 'Proposals'}</span>
                  <span className="font-semibold">{project.proposals_count || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{isAr ? 'آخر ظهور' : 'Last seen'}</span>
                  <span className="font-semibold text-xs">
                    {project.client_last_seen
                      ? timeAgo(project.client_last_seen, locale as string)
                      : (isAr ? 'غير معروف' : 'Unknown')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{isAr ? 'حالة الدفع' : 'Payment status'}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    clientPaymentVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {clientPaymentVerified
                      ? (isAr ? '✓ موثّق' : '✓ Verified')
                      : (isAr ? 'غير موثّق' : 'Unverified')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">{isAr ? 'نشر منذ' : 'Posted'}</span>
                  <span className="font-semibold text-xs">{timeAgo(project.created_at, locale as string)}</span>
                </div>
              </div>
            </div>

            {/* CTA — Submit Proposal (wait for auth to resolve) */}
            {authLoading ? (
              <div className="card animate-pulse h-20 bg-gray-100" />
            ) : canApply && (
              <div className="card">
                {alreadyApplied ? (
                  <div className="text-center py-2">
                    <span className="text-3xl block mb-2">✅</span>
                    <p className="font-semibold text-green-700 text-sm">
                      {isAr ? 'لقد قدّمت عرضاً على هذا المشروع' : 'You already applied to this project'}
                    </p>
                    <Link href="/dashboard" className="text-xs text-primary-600 hover:underline mt-1 inline-block">
                      {isAr ? 'عرض عروضي' : 'View my proposals'}
                    </Link>
                  </div>
                ) : !phoneVerified ? (
                  /* ── Phone not verified — inline OTP widget ── */
                  <div>
                    <p className="text-sm font-semibold text-amber-700 mb-1">
                      {isAr ? '📱 تحقق من هاتفك لتقديم عرض' : '📱 Verify your phone to apply'}
                    </p>
                    {!user?.phone ? (
                      <p className="text-xs text-gray-500">
                        {isAr ? 'أضف رقم هاتفك من ' : 'Add your phone number from '}
                        <Link href="/profile" className="text-primary-600 underline">{isAr ? 'ملفك الشخصي' : 'your profile'}</Link>.
                      </p>
                    ) : !otpSent ? (
                      <button
                        disabled={otpLoading}
                        onClick={() => {
                          setOtpLoading(true);
                          authApi.sendOtp()
                            .then(() => { setOtpSent(true); toast.success(isAr ? 'تم إرسال الرمز' : 'OTP sent!'); })
                            .catch((e) => toast.error(e.response?.data?.message || 'Failed'))
                            .finally(() => setOtpLoading(false));
                        }}
                        className="btn btn-primary w-full mt-2 text-sm">
                        {otpLoading ? '...' : (isAr ? 'أرسل رمز التحقق' : 'Send Verification Code')}
                      </button>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-gray-500">{isAr ? `إلى: ${user.phone}` : `Sent to: ${user.phone}`}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder={isAr ? 'أدخل الرمز' : 'Enter code'}
                            className="input flex-1 text-center font-mono text-lg"
                          />
                          <button
                            disabled={otpLoading || otpCode.length < 4}
                            onClick={() => {
                              setOtpLoading(true);
                              authApi.verifyPhone(otpCode)
                                .then(async () => {
                                  await reloadAuth(); // refresh user.phone_verified globally
                                  setOtpSent(false);
                                  setOtpCode('');
                                  toast.success(isAr ? '✅ تم التحقق! يمكنك الآن تقديم عرضك.' : '✅ Verified! You can now submit.');
                                })
                                .catch((e) => toast.error(e.response?.data?.message || 'Invalid code'))
                                .finally(() => setOtpLoading(false));
                            }}
                            className="btn btn-primary text-sm px-4">
                            {otpLoading ? '...' : (isAr ? 'تحقق' : 'Verify')}
                          </button>
                        </div>
                        <button onClick={() => { setOtpSent(false); setOtpCode(''); }}
                          className="text-xs text-gray-400 hover:underline">
                          {isAr ? 'إعادة إرسال' : 'Resend'}
                        </button>
                        {process.env.NODE_ENV !== 'production' && (
                          <p className="text-xs text-gray-300 italic">{isAr ? '(dev: استخدم 123456)' : '(dev: use 123456)'}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-3 text-center">
                      {isAr
                        ? 'قدّم عرضك الآن للحصول على هذا المشروع'
                        : 'Submit your proposal to win this project'}
                    </p>
                    <button onClick={() => {
                      if (isDev) toast(`[dev] phone_verified: ${user?.phone_verified} → bypassed`, { icon: '🔧' });
                      setProposalModal(true);
                    }}
                      className="btn btn-primary w-full py-3 text-base font-semibold">
                      {isAr ? '🚀 تقديم عرض' : '🚀 Submit Proposal'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Guest CTA */}
            {!authLoading && !isAuthenticated && (
              <div className="card text-center">
                <p className="text-sm text-gray-500 mb-3">
                  {isAr ? 'سجّل دخولك لتقديم عرض على هذا المشروع' : 'Login to apply for this project'}
                </p>
                <Link href={`/auth/login?redirect=/projects/${project.id}`}
                  className="btn btn-primary w-full">
                  {isAr ? 'تسجيل الدخول للتقديم' : 'Login to Apply'}
                </Link>
              </div>
            )}

            {/* Project closed */}
            {!authLoading && project.status !== 'open' && isFreelancer && (
              <div className="card text-center py-3">
                <p className="text-sm text-gray-400">
                  {isAr ? 'هذا المشروع لم يعد يقبل عروضاً' : 'This project is no longer accepting proposals'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Proposal Modal ────────────────────────────────────────────────── */}
      <Modal open={proposalModal} onClose={() => setProposalModal(false)}
        title={isAr ? 'تقديم عرض' : 'Submit a Proposal'} size="lg">
        <form onSubmit={handleSubmit(submitProposal)} className="space-y-5">

          {/* Budget hint */}
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-sm text-primary-700">
            {isAr
              ? `ميزانية المشروع: ${project.budget_type === 'hourly'
                  ? `${formatJOD(project.hourly_rate_min || 0)}–${formatJOD(project.hourly_rate_max || 0)}/ساعة`
                  : `${formatJOD(project.budget_min || 0)}${project.budget_max ? ` – ${formatJOD(project.budget_max)}` : '+'}`}`
              : `Project budget: ${project.budget_type === 'hourly'
                  ? `${formatJOD(project.hourly_rate_min || 0)}–${formatJOD(project.hourly_rate_max || 0)}/hr`
                  : `${formatJOD(project.budget_min || 0)}${project.budget_max ? ` – ${formatJOD(project.budget_max)}` : '+'}`}`}
          </div>

          {/* Bid + delivery grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                {isAr ? 'قيمة عرضك (دينار)' : 'Your Bid (JOD)'} <span className="text-red-400">*</span>
              </label>
              <input
                {...register('proposed_budget', { required: true, min: 1 })}
                type="number" step="0.001" min="1"
                className={`input ${errors.proposed_budget ? 'border-red-300' : ''}`}
                placeholder="e.g. 350"
              />
              {errors.proposed_budget && (
                <p className="text-red-500 text-xs mt-1">{isAr ? 'مطلوب' : 'Required'}</p>
              )}
            </div>
            <div>
              <label className="label">
                {isAr ? 'مدة التسليم (أيام)' : 'Delivery (Days)'} <span className="text-red-400">*</span>
              </label>
              <input
                {...register('delivery_days', { required: true, min: 1 })}
                type="number" min="1"
                className={`input ${errors.delivery_days ? 'border-red-300' : ''}`}
                placeholder="e.g. 14"
              />
              {errors.delivery_days && (
                <p className="text-red-500 text-xs mt-1">{isAr ? 'مطلوب' : 'Required'}</p>
              )}
            </div>
          </div>

          {/* Cover letter EN */}
          <div>
            <label className="label">
              {isAr ? 'رسالة التقديم (إنجليزي)' : 'Cover Letter (English)'} <span className="text-red-400">*</span>
            </label>
            <textarea
              {...register('cover_letter_en', {
                required: true,
                minLength: { value: 50, message: isAr ? 'على الأقل 50 حرفاً' : 'At least 50 characters' },
              })}
              rows={5}
              className={`input resize-none ${errors.cover_letter_en ? 'border-red-300' : ''}`}
              placeholder={isAr
                ? 'اكتب رسالتك باللغة الإنجليزية. صِف تجربتك المشابهة وسبب اختيارك لهذا المشروع...'
                : 'Describe your relevant experience and why you are the best fit for this project...'}
            />
            {errors.cover_letter_en && (
              <p className="text-red-500 text-xs mt-1">
                {typeof errors.cover_letter_en.message === 'string'
                  ? errors.cover_letter_en.message
                  : (isAr ? 'مطلوب' : 'Required')}
              </p>
            )}
          </div>

          {/* Cover letter AR (optional) */}
          <div>
            <label className="label">
              {isAr ? 'رسالة التقديم (عربي)' : 'Cover Letter (Arabic)'}{' '}
              <span className="text-gray-400 text-xs font-normal">{isAr ? '(اختياري)' : '(optional)'}</span>
            </label>
            <textarea
              {...register('cover_letter_ar')}
              rows={3}
              dir="rtl"
              className="input resize-none"
              placeholder={isAr ? 'يمكنك إضافة نسخة عربية من رسالتك...' : 'Optional Arabic version of your pitch...'}
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="label">
              {isAr ? 'مرفقات (نماذج عمل، ملفات)' : 'Attachments (portfolio samples, files)'}
              <span className="text-gray-400 text-xs font-normal mr-2">
                {isAr ? '(اختياري)' : '(optional)'}
              </span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 transition-colors">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.mp4,.mov" />
              {uploadingFiles ? (
                <p className="text-sm text-primary-600 animate-pulse">{isAr ? 'جاري الرفع...' : 'Uploading...'}</p>
              ) : (
                <>
                  <p className="text-2xl mb-1">📎</p>
                  <p className="text-sm text-gray-500">
                    {isAr ? 'انقر لإرفاق ملفات' : 'Click to attach files'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, ZIP, PNG, JPG, MP4</p>
                </>
              )}
            </div>
            {attachmentNames.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachmentNames.map((name, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                    <span className="text-gray-700 truncate">📄 {name}</span>
                    <button type="button" onClick={() => removeAttachment(i)}
                      className="text-red-400 hover:text-red-600 ml-2 text-xs shrink-0">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setProposalModal(false)}
              className="btn btn-ghost flex-1">
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={isSubmitting || uploadingFiles}
              className="btn btn-primary flex-1 py-3">
              {isSubmitting
                ? (isAr ? 'جاري الإرسال...' : 'Submitting...')
                : (isAr ? '🚀 إرسال العرض' : '🚀 Submit Proposal')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Interview Chat Modal ─────────────────────────────────────────────── */}
      {interviewRoom && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4"
          onClick={() => setInterviewRoom(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-primary-50 shrink-0">
              <div>
                <p className="font-bold text-primary-900 text-sm">
                  {isAr ? '💬 مقابلة مع' : '💬 Interview with'} {interviewRoom.freelancerName}
                </p>
                <p className="text-xs text-primary-600 mt-0.5">
                  {isAr ? 'هذه المحادثة مرتبطة بالعرض — يمكنك التوظيف بعد الاتفاق' : 'This chat is linked to the proposal — hire after aligning'}
                </p>
              </div>
              <button onClick={() => setInterviewRoom(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>
            {/* Chat */}
            <div className="flex-1 overflow-hidden">
              <ChatRoom roomId={interviewRoom.roomId} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
