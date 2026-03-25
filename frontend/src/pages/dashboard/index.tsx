import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Squares2X2Icon, ShoppingCartIcon, DocumentTextIcon,
  ChatBubbleLeftIcon, BellIcon, WalletIcon,
  ArrowTrendingUpIcon, ClockIcon, CheckCircleIcon,
  ArrowUpRightIcon, BanknotesIcon, UserCircleIcon,
  ExclamationCircleIcon, InboxIcon, LifebuoyIcon,
} from '@heroicons/react/24/outline';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import ChatRoom from '@/components/chat/ChatRoom';
import {
  ordersApi, contractsApi, chatApi, paymentsApi,
  walletsApi, withdrawalsApi, notificationsApi, authApi, ticketsApi,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { formatJOD } from '@/utils/currency';
import { timeAgo } from '@/utils/date';
import clsx from 'clsx';

type Tab = 'overview' | 'orders' | 'contracts' | 'messages' | 'notifications' | 'wallet' | 'support';

function getNotificationLink(n: { entity_type?: string; entity_id?: string }): string | null {
  switch (n.entity_type) {
    case 'project':     return n.entity_id ? `/projects/${n.entity_id}` : null;
    case 'contract':    return n.entity_id ? `/contracts/${n.entity_id}` : null;
    case 'order':       return n.entity_id ? `/orders/${n.entity_id}` : null;
    case 'milestone':   return `/dashboard?tab=contracts`;   // no direct milestone URL
    case 'dispute':     return n.entity_id ? `/orders/${n.entity_id}` : `/dashboard?tab=overview`;
    case 'review':      return `/dashboard?tab=overview`;
    case 'withdrawal':  return `/dashboard?tab=wallet`;
    case 'transaction': return `/dashboard?tab=wallet`;
    case 'chat':        return `/dashboard?tab=messages`;
    case 'user':        return `/dashboard`;                  // identity verification
    case 'announcement':return null;
    default:            return null;
  }
}

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function DashboardPage() {
  const { t } = useTranslation('common');
  const { locale, query, push } = useRouter();
  const isAr = locale === 'ar';
  const { user, profile, isFreelancer, isClient, loading, reloadAuth } = useAuth();
  const { isAuthenticated } = useRequireAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const [tab, setTab]               = useState<Tab>((query.tab as Tab) || 'overview');
  const [orders, setOrders]         = useState<any[]>([]);
  const [contracts, setContracts]   = useState<any[]>([]);
  const [rooms, setRooms]           = useState<any[]>([]);
  const [transactions, setTxs]      = useState<any[]>([]);
  const [wallet, setWallet]         = useState<any>(null);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  // ── Phone verification state ─────────────────────────────────
  const [otpSent, setOtpSent]       = useState(false);
  const [otpCode, setOtpCode]       = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  // In development, bypass phone verification so the full workflow can be tested
  const isDev = process.env.NODE_ENV !== 'production';
  const phoneVerified = isDev ? true : (user?.phone_verified ?? false);
  useEffect(() => { setTab((query.tab as Tab) || 'overview'); }, [query.tab]);

  useEffect(() => {
    ordersApi.myOrders().then((r) => {
      const rows = r.data?.data ?? [];
      setOrders(rows.map((o: any) => ({ ...o, price: Number(o.price ?? 0) })));
    }).catch(() => {});
    contractsApi.myContracts().then((r) => setContracts(r.data?.data ?? [])).catch(() => {});
    chatApi.rooms().then((r) => setRooms(r.data?.data ?? [])).catch(() => {});
    paymentsApi.myTransactions().then((r) => {
      const rows = r.data?.data ?? [];
      setTxs(rows.map((tx: any) => ({ ...tx, amount: Number(tx.amount ?? 0) })));
    }).catch(() => {});
    walletsApi.me().then((r) => {
      const w = r.data?.data ?? null;
      if (w) {
        // postgres returns numeric columns as strings — normalise to numbers
        setWallet({
          ...w,
          balance:           Number(w.balance           ?? 0),
          pending_balance:   Number(w.pending_balance   ?? 0),
          available_balance: Number(w.available_balance ?? 0),
          total_earned:      Number(w.total_earned      ?? 0),
          total_withdrawn:   Number(w.total_withdrawn   ?? 0),
        });
      } else {
        setWallet(null);
      }
    }).catch(() => {});
  }, []);

  const activeOrders    = orders.filter((o) => ['in_progress', 'pending', 'delivered'].includes(o.status));
  const activeContracts = contracts.filter((c) => c.status === 'active');
  const totalSpent      = orders.reduce((sum, o) => sum + Number(o.price || 0), 0);

  const TABS: { id: Tab; labelEn: string; labelAr: string; Icon: any; badge?: number }[] = [
    { id: 'overview',      labelEn: 'Overview',               labelAr: 'نظرة عامة',     Icon: Squares2X2Icon },
    { id: 'orders',        labelEn: t('dashboard.active_orders'), labelAr: 'الطلبات',   Icon: ShoppingCartIcon, badge: activeOrders.length },
    { id: 'contracts',     labelEn: t('contracts.title'),     labelAr: 'العقود',         Icon: DocumentTextIcon },
    { id: 'messages',      labelEn: t('nav.messages'),        labelAr: 'الرسائل',        Icon: ChatBubbleLeftIcon },
    { id: 'notifications', labelEn: t('nav.notifications'),   labelAr: 'الإشعارات',     Icon: BellIcon, badge: unreadCount },
    { id: 'wallet',        labelEn: t('nav.wallet'),          labelAr: 'المحفظة',        Icon: WalletIcon },
    { id: 'support',       labelEn: 'Support',                labelAr: 'الدعم',           Icon: LifebuoyIcon },
  ];

  function changeTab(id: Tab) { push(`/dashboard?tab=${id}`); }

  if (loading || !isAuthenticated) return null;

  const avatarSrc = profile?.avatar_url;

  return (
    <Layout title="Dashboard" titleAr="لوحة التحكم" fullWidth>
      <div className="section-container py-8">

        {/* ── Welcome banner ── */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-primary-700 to-primary-600 rounded-2xl p-5 mb-6 text-white">
          {avatarSrc
            ? <img src={avatarSrc} className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/30" alt="" />
            : <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                <UserCircleIcon className="w-7 h-7 text-white/70" />
              </div>
          }
          <div>
            <p className="font-black text-lg leading-tight">
              {isAr ? `مرحباً، ${profile?.full_name_ar || profile?.full_name_en || ''}` : `Welcome back, ${profile?.full_name_en || ''}`}
            </p>
            <p className="text-primary-200 text-sm">
              {isAr ? (isFreelancer ? 'لوحة تحكم المستقل' : 'لوحة تحكم العميل') : (isFreelancer ? 'Freelancer Dashboard' : 'Client Dashboard')}
            </p>
          </div>
          <div className="ms-auto hidden sm:flex items-center gap-3">
            {isFreelancer && (
              <Link href="/gigs/create" className="bg-white/15 hover:bg-white/25 transition text-white text-sm font-semibold px-4 py-2 rounded-xl">
                {isAr ? '+ خدمة جديدة' : '+ New Gig'}
              </Link>
            )}
            {isClient && (
              <Link href="/projects/create" className="bg-white/15 hover:bg-white/25 transition text-white text-sm font-semibold px-4 py-2 rounded-xl">
                {isAr ? '+ نشر مشروع' : '+ Post Project'}
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-6">

          {/* ── Sidebar ── */}
          <aside className="w-52 shrink-0 hidden md:block">
            <nav className="space-y-0.5">
              {TABS.map(({ id, labelEn, labelAr, Icon, badge }) => (
                <button
                  key={id}
                  onClick={() => changeTab(id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-start',
                    tab === id
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{isAr ? labelAr : labelEn}</span>
                  {badge ? (
                    <span className={clsx('min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                      tab === id ? 'bg-white/25 text-white' : 'bg-danger text-white')}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Mobile tab strip ── */}
          <div className="md:hidden w-full mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map(({ id, labelAr, labelEn, Icon, badge }) => (
              <button key={id} onClick={() => changeTab(id)}
                className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap relative transition-all',
                  tab === id ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-600')}>
                <Icon className="w-3.5 h-3.5" />
                {isAr ? labelAr : labelEn}
                {badge ? <span className="w-4 h-4 bg-danger rounded-full text-white text-[9px] flex items-center justify-center">{badge}</span> : null}
              </button>
            ))}
          </div>

          {/* ── Content ── */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial="hidden" animate="show" exit="hidden" variants={fadeIn}>

                {/* ════════ OVERVIEW ════════ */}
                {tab === 'overview' && (
                  <div className="space-y-6">

                    {/* ── Phone verification banner (freelancers only) ── */}
                    {isFreelancer && !phoneVerified && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <ExclamationCircleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-amber-900 text-sm">
                              {isAr ? 'يجب التحقق من رقم هاتفك لتقديم العروض' : 'Verify your phone number to submit proposals'}
                            </p>
                            {!user?.phone && (
                              <p className="text-xs text-amber-700 mt-1">
                                {isAr ? 'لم يتم إضافة رقم هاتف. أضفه من ' : 'No phone number added. Add it from '}
                                <a href="/profile" className="underline font-medium">{isAr ? 'ملفك الشخصي' : 'your profile'}</a>.
                              </p>
                            )}
                            {user?.phone && !otpSent && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-amber-700">{user.phone}</span>
                                <button
                                  disabled={otpLoading}
                                  onClick={() => {
                                    setOtpLoading(true);
                                    authApi.sendOtp()
                                      .then(() => { setOtpSent(true); toast.success(isAr ? 'تم إرسال الرمز' : 'OTP sent!'); })
                                      .catch((e) => toast.error(e.response?.data?.message || 'Failed'))
                                      .finally(() => setOtpLoading(false));
                                  }}
                                  className="btn btn-primary btn-sm py-1 px-3 text-xs">
                                  {otpLoading ? '...' : (isAr ? 'أرسل رمز التحقق' : 'Send OTP')}
                                </button>
                              </div>
                            )}
                            {user?.phone && otpSent && (
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={6}
                                  value={otpCode}
                                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                  placeholder={isAr ? 'أدخل الرمز' : 'Enter OTP'}
                                  className="input w-32 text-center font-mono text-lg"
                                />
                                <button
                                  disabled={otpLoading || otpCode.length < 4}
                                  onClick={() => {
                                    setOtpLoading(true);
                                    authApi.verifyPhone(otpCode)
                                      .then(async () => {
                                        // Refresh global auth state so user.phone_verified
                                        // becomes true everywhere (proposal page, etc.)
                                        await reloadAuth();
                                        setOtpSent(false);
                                        setOtpCode('');
                                        toast.success(isAr ? 'تم التحقق من الهاتف بنجاح! يمكنك الآن تقديم العروض.' : 'Phone verified! You can now submit proposals.');
                                      })
                                      .catch((e) => toast.error(e.response?.data?.message || 'Invalid OTP'))
                                      .finally(() => setOtpLoading(false));
                                  }}
                                  className="btn btn-primary btn-sm py-1 px-3 text-xs">
                                  {otpLoading ? '...' : (isAr ? 'تحقق' : 'Verify')}
                                </button>
                                <button onClick={() => { setOtpSent(false); setOtpCode(''); }}
                                  className="text-xs text-amber-700 underline">
                                  {isAr ? 'إعادة إرسال' : 'Resend'}
                                </button>
                                {process.env.NODE_ENV !== 'production' && (
                                  <span className="text-xs text-gray-400 italic">
                                    {isAr ? '(dev: استخدم 123456)' : '(dev: use 123456)'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { labelEn: t('dashboard.active_orders'),   labelAr: 'الطلبات النشطة',    value: activeOrders.length,                        Icon: ShoppingCartIcon,    color: 'text-blue-600',    bg: 'bg-blue-50'    },
                        isFreelancer
                          ? { labelEn: t('dashboard.total_earned'), labelAr: 'إجمالي الأرباح',   value: formatJOD(profile?.total_earned || 0),      Icon: ArrowTrendingUpIcon,  color: 'text-emerald-600', bg: 'bg-emerald-50' }
                          : { labelEn: 'Total Spent',               labelAr: 'إجمالي الإنفاق',   value: formatJOD(totalSpent),                      Icon: BanknotesIcon,        color: 'text-rose-600',    bg: 'bg-rose-50'    },
                        { labelEn: isAr ? 'العقود النشطة' : 'Active Contracts', labelAr: 'العقود النشطة', value: activeContracts.length,           Icon: DocumentTextIcon,    color: 'text-violet-600',  bg: 'bg-violet-50'  },
                        { labelEn: t('dashboard.wallet_balance'),   labelAr: 'رصيد المحفظة',     value: formatJOD(wallet?.balance || 0),            Icon: WalletIcon,          color: 'text-primary-600', bg: 'bg-primary-50' },
                      ].map((s) => (
                        <div key={s.labelEn} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                          <div className={`w-9 h-9 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                            <s.Icon className="w-4.5 h-4.5" />
                          </div>
                          <p className="text-xl font-black text-gray-900">{s.value}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{isAr ? s.labelAr : s.labelEn}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recent orders */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-gray-900">{t('dashboard.recent_orders')}</h2>
                        <button onClick={() => changeTab('orders')} className="text-xs text-primary-600 hover:underline font-medium">
                          {isAr ? 'عرض الكل' : 'View all'}
                        </button>
                      </div>
                      {orders.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-gray-400">
                          <InboxIcon className="w-10 h-10 mb-2" />
                          <p className="text-sm">{isAr ? 'لا توجد طلبات بعد' : 'No orders yet'}</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {orders.slice(0, 5).map((o) => (
                            <Link key={o.id} href={`/orders/${o.id}`}
                              className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-gray-50 transition group">
                              <div>
                                <p className="text-sm font-semibold text-gray-800 group-hover:text-primary-700 transition-colors">{o.gig_title || o.title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(o.created_at, locale as string)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-primary-700 text-sm">{formatJOD(o.price)}</span>
                                <Badge status={o.status} />
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick links */}
                    <div className="grid grid-cols-2 gap-3">
                      <Link href="/gigs" className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary-200 hover:shadow-sm transition group">
                        <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
                          <ArrowUpRightIcon className="w-4 h-4 text-primary-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-primary-700 transition-colors">
                          {isAr ? 'تصفح الخدمات' : 'Browse Gigs'}
                        </span>
                      </Link>
                      <Link href="/projects" className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary-200 hover:shadow-sm transition group">
                        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                          <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-primary-700 transition-colors">
                          {isAr ? 'تصفح المشاريع' : 'Browse Projects'}
                        </span>
                      </Link>
                    </div>
                  </div>
                )}

                {/* ════════ ORDERS ════════ */}
                {tab === 'orders' && (
                  <div className="space-y-3">
                    <h2 className="font-bold text-gray-900 mb-4">{t('orders.title')}</h2>
                    {orders.length === 0 ? (
                      <div className="flex flex-col items-center py-20 text-gray-400">
                        <InboxIcon className="w-12 h-12 mb-3" />
                        <p>{isAr ? 'لا توجد طلبات' : 'No orders yet'}</p>
                      </div>
                    ) : orders.map((o) => (
                      <Link key={o.id} href={`/orders/${o.id}`}
                        className="group block bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 transition-colors truncate">{o.gig_title || o.title}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {isFreelancer
                                ? (isAr ? `العميل: ${o.client_name}` : `Client: ${o.client_name}`)
                                : (isAr ? `المستقل: ${o.freelancer_name}` : `Freelancer: ${o.freelancer_name}`)}
                            </p>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="font-bold text-primary-700">{formatJOD(o.price)}</p>
                            <div className="mt-1"><Badge status={o.status} /></div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* ════════ CONTRACTS ════════ */}
                {tab === 'contracts' && (
                  <div className="space-y-3">
                    <h2 className="font-bold text-gray-900 mb-4">{t('contracts.title')}</h2>
                    {contracts.length === 0 ? (
                      <div className="flex flex-col items-center py-20 text-gray-400">
                        <DocumentTextIcon className="w-12 h-12 mb-3" />
                        <p>{isAr ? 'لا توجد عقود' : 'No contracts yet'}</p>
                      </div>
                    ) : contracts.map((c) => (
                      <Link key={c.id} href={`/contracts/${c.id}`}
                        className="group block bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 group-hover:text-primary-700 transition-colors">{isAr ? c.title_ar || c.title_en : c.title_en}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
                                <div
                                  className="bg-primary-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${c.total_milestones ? (c.approved_milestones / c.total_milestones) * 100 : 0}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-400">
                                {c.approved_milestones}/{c.total_milestones} {isAr ? 'مراحل' : 'milestones'}
                              </p>
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="font-bold text-primary-700">{formatJOD(c.total_amount)}</p>
                            <div className="mt-1"><Badge status={c.status} /></div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* ════════ MESSAGES ════════ */}
                {tab === 'messages' && (() => {
                  // Group rooms by context title (project name / gig name)
                  const grouped: Record<string, typeof rooms> = {};
                  rooms.forEach((room) => {
                    const key = room.context_title || (isAr ? 'محادثة مباشرة' : 'Direct');
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(room);
                  });
                  const activeRoomData = rooms.find((r) => r.id === activeRoom);

                  return (
                    <div className="flex gap-3 h-[600px]">
                      {/* Room list — grouped by project/context */}
                      <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <p className="font-bold text-sm text-gray-900">{t('nav.messages')}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isAr ? 'مرتبة حسب المشروع' : 'Grouped by project'}
                          </p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {rooms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-4 text-center">
                              <ChatBubbleLeftIcon className="w-8 h-8 mb-2" />
                              <p className="text-xs">{isAr ? 'لا توجد محادثات' : 'No conversations yet'}</p>
                            </div>
                          ) : Object.entries(grouped).map(([groupTitle, groupRooms]) => (
                            <div key={groupTitle}>
                              {/* Project group header */}
                              <div className="px-3 py-1.5 bg-gray-50 border-y border-gray-100 sticky top-0">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide truncate">
                                  {groupTitle}
                                </p>
                              </div>
                              {groupRooms.map((room) => {
                                const name = isFreelancer ? room.client_name : room.freelancer_name;
                                const avatar = isFreelancer ? room.client_avatar : room.freelancer_avatar;
                                const contextBadge = room.context_type === 'interview'
                                  ? (isAr ? 'مقابلة' : 'Interview')
                                  : room.context_type === 'contract'
                                  ? (isAr ? 'عقد' : 'Contract')
                                  : (isAr ? 'طلب' : 'Order');
                                return (
                                  <button key={room.id} onClick={() => setActiveRoom(room.id)}
                                    className={clsx(
                                      'w-full text-start px-3 py-2.5 hover:bg-gray-50 transition border-b border-gray-50 last:border-0',
                                      activeRoom === room.id && 'bg-primary-50 border-s-2 border-s-primary-500',
                                    )}>
                                    <div className="flex items-center gap-2.5">
                                      {avatar
                                        ? <img src={avatar} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                                        : <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shrink-0">
                                            <span className="text-white font-bold text-xs">{(name || '?')[0]?.toUpperCase()}</span>
                                          </div>
                                      }
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="text-xs font-semibold text-gray-900 truncate">{name}</p>
                                          <span className={clsx(
                                            'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                                            room.context_type === 'interview'
                                              ? 'bg-amber-100 text-amber-700'
                                              : room.context_type === 'contract'
                                              ? 'bg-primary-100 text-primary-700'
                                              : 'bg-green-100 text-green-700',
                                          )}>
                                            {contextBadge}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-gray-400 truncate">{room.last_message || '...'}</p>
                                      </div>
                                      {(room.unread_count ?? 0) > 0 && (
                                        <span className="w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                                          {room.unread_count}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Chat area */}
                      <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        {activeRoom ? (
                          <ChatRoom
                            roomId={activeRoom}
                            header={activeRoomData?.context_title ? (
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                  activeRoomData.context_type === 'interview' ? 'bg-amber-100 text-amber-700' :
                                  activeRoomData.context_type === 'contract'  ? 'bg-primary-100 text-primary-700' :
                                  'bg-green-100 text-green-700',
                                )}>
                                  {activeRoomData.context_type === 'interview' ? (isAr ? 'مقابلة' : 'Interview') :
                                   activeRoomData.context_type === 'contract'  ? (isAr ? 'عقد' : 'Contract') :
                                   (isAr ? 'طلب' : 'Order')}
                                </span>
                                <span className="text-sm font-semibold text-gray-700 truncate">
                                  {activeRoomData.context_title}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {isAr ? 'مع' : 'with'} {isFreelancer ? activeRoomData.client_name : activeRoomData.freelancer_name}
                                </span>
                              </div>
                            ) : undefined}
                          />
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <ChatBubbleLeftIcon className="w-12 h-12 mb-3" />
                            <p className="text-sm font-medium">{isAr ? 'اختر محادثة للبدء' : 'Select a conversation to start'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ════════ NOTIFICATIONS ════════ */}
                {tab === 'notifications' && (
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-bold text-gray-900">{t('notifications.title')}</h2>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead}
                          className="text-xs font-semibold text-primary-600 hover:text-primary-800 transition">
                          {t('notifications.mark_all_read')}
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center py-20 text-gray-400">
                        <BellIcon className="w-12 h-12 mb-3" />
                        <p>{t('notifications.no_notifications')}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {notifications.map((n) => {
                          const link = getNotificationLink(n);
                          return (
                          <div key={n.id} onClick={() => {
                            markRead(n.id);
                            if (link) push(link);
                          }}
                            className={clsx(
                              'bg-white rounded-2xl border p-4 cursor-pointer hover:shadow-sm transition-all',
                              n.is_read ? 'border-gray-100' : 'border-primary-200 bg-primary-50/40',
                            )}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <div className={clsx('w-2 h-2 rounded-full mt-1.5 shrink-0', n.is_read ? 'bg-gray-300' : 'bg-primary-500')} />
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{isAr ? n.title_ar : n.title_en}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">{isAr ? n.body_ar : n.body_en}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <p className="text-xs text-gray-400">{timeAgo(n.created_at, locale as string)}</p>
                                {link && (
                                  <span className="text-xs text-primary-600 font-medium">
                                    {isAr ? 'عرض ←' : 'View →'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ════════ WALLET ════════ */}
                {tab === 'wallet' && (
                  <div className="space-y-5">
                    {/* Wallet balance cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(isFreelancer ? [
                        { labelEn: 'Available to Withdraw', labelAr: 'متاح للسحب',       value: wallet?.available_balance || 0, Icon: BanknotesIcon,      gradient: 'from-primary-700 to-primary-600' },
                        { labelEn: 'Pending Clearance',     labelAr: 'قيد التحصيل',      value: wallet?.pending_balance  || 0, Icon: ClockIcon,          gradient: 'from-amber-500 to-orange-500'   },
                        { labelEn: 'Total Earned',          labelAr: 'إجمالي الأرباح',   value: wallet?.total_earned     || 0, Icon: ArrowTrendingUpIcon, gradient: 'from-blue-600 to-blue-500'      },
                        { labelEn: 'Total Withdrawn',       labelAr: 'إجمالي المسحوب',   value: wallet?.total_withdrawn  || 0, Icon: CheckCircleIcon,    gradient: 'from-gray-600 to-gray-500'      },
                      ] : [
                        { labelEn: 'Wallet Balance',        labelAr: 'رصيد المحفظة',     value: wallet?.balance          || 0, Icon: WalletIcon,         gradient: 'from-primary-700 to-primary-600' },
                        { labelEn: 'Held in Escrow',        labelAr: 'محجوز في الضمان',  value: wallet?.pending_balance  || 0, Icon: ClockIcon,          gradient: 'from-amber-500 to-orange-500'   },
                        { labelEn: 'Total Spent',           labelAr: 'إجمالي الإنفاق',   value: totalSpent,                    Icon: BanknotesIcon,      gradient: 'from-rose-600 to-rose-500'      },
                        { labelEn: 'Active Projects',       labelAr: 'المشاريع النشطة',  value: activeContracts.length,        Icon: DocumentTextIcon,   gradient: 'from-violet-600 to-violet-500', isCount: true },
                      ]).map((s: any) => (
                        <div key={s.labelEn} className={`bg-gradient-to-br ${s.gradient} text-white rounded-2xl p-5`}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-white/80">{isAr ? s.labelAr : s.labelEn}</p>
                            <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center">
                              <s.Icon className="w-4 h-4" />
                            </div>
                          </div>
                          <p className="text-2xl font-black">{s.isCount ? s.value : formatJOD(s.value)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Client: deposit options (CliQ + Stripe) */}
                    {isClient && (
                      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                        <h3 className="font-bold text-gray-900">
                          {isAr ? 'طرق الدفع عند الشراء' : 'Payment Methods at Checkout'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {isAr
                            ? 'عند إتمام الطلب، يمكنك الدفع بإحدى الطريقتين:'
                            : 'When placing an order, you can pay using one of two methods:'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* CliQ card */}
                          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">⚡</span>
                              <span className="font-bold text-blue-800 text-base">CliQ</span>
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                                {isAr ? 'يدوي' : 'Manual'}
                              </span>
                            </div>
                            <p className="text-xs text-blue-700">
                              {isAr
                                ? 'حوّل المبلغ عبر CliQ وارفع إيصال الدفع. سيتم تأكيد الطلب بعد مراجعة الفريق.'
                                : 'Transfer via CliQ and upload your receipt. Order confirmed after admin review.'}
                            </p>
                            <div className="bg-white rounded-xl px-3 py-2 text-xs space-y-1">
                              <p className="text-gray-500">{isAr ? 'المعرف:' : 'Alias:'} <span className="font-bold text-gray-900 dir-ltr">DOPAWORK.JO</span></p>
                              <p className="text-gray-500">{isAr ? 'الاسم:' : 'Name:'} <span className="font-bold text-gray-900">Dopa Work</span></p>
                            </div>
                          </div>

                          {/* Stripe / Card card */}
                          <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">💳</span>
                              <span className="font-bold text-violet-800 text-base">{isAr ? 'بطاقة ائتمان' : 'Credit / Debit Card'}</span>
                              <span className="text-[10px] bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full">
                                {isAr ? 'فوري' : 'Instant'}
                              </span>
                            </div>
                            <p className="text-xs text-violet-700">
                              {isAr
                                ? 'ادفع بأمان عبر Stripe. يبدأ العمل فوراً بعد تأكيد الدفع.'
                                : 'Pay securely via Stripe. Work starts immediately after payment confirmation.'}
                            </p>
                            <div className="bg-white rounded-xl px-3 py-2 text-xs text-gray-500">
                              Visa · Mastercard · Mada
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Freelancer: withdraw form */}
                    {isFreelancer && (
                      <div className="bg-white rounded-2xl border border-gray-100 p-5">
                        <h3 className="font-bold text-gray-900 mb-4">{t('dashboard.withdraw')}</h3>
                        <WithdrawForm wallet={wallet} t={t} isAr={isAr} />
                      </div>
                    )}

                    {/* Transaction history */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <h3 className="font-bold text-gray-900 mb-4">{t('dashboard.recent_transactions')}</h3>
                      {transactions.length === 0 ? (
                        <div className="flex flex-col items-center py-10 text-gray-400">
                          <BanknotesIcon className="w-10 h-10 mb-2" />
                          <p className="text-sm">{isAr ? 'لا توجد معاملات بعد' : 'No transactions yet'}</p>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {transactions.slice(0, 10).map((tx) => (
                            <div key={tx.id} className="flex justify-between items-center py-3 px-2 rounded-xl hover:bg-gray-50 transition">
                              <div>
                                <p className="text-sm font-medium text-gray-800">{isAr ? tx.description_ar : tx.description_en}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(tx.created_at, locale as string)}</p>
                              </div>
                              <div className="text-end">
                                <p className={clsx('font-bold text-sm',
                                  tx.type === 'deposit' || tx.type === 'release' ? 'text-emerald-600' : 'text-gray-600')}>
                                  {tx.type === 'release' ? '+' : ''}{formatJOD(tx.amount)}
                                </p>
                                <div className="mt-0.5"><Badge status={tx.status} /></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ════════ SUPPORT ════════ */}
                {tab === 'support' && (
                  <SupportTab isAr={isAr} t={t} />
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Support Tab ─────────────────────────────────────────────────────────────

function SupportTab({ isAr, t }: { isAr: boolean; t: any }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [createMode, setCreateMode] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ticketsApi.my().then((r) => setTickets(r.data?.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function submit() {
    if (!subject.trim() || !body.trim()) {
      toast.error(isAr ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await ticketsApi.create({ subject_en: subject, body_en: body, priority });
      toast.success(isAr ? 'تم إرسال التذكرة بنجاح' : 'Support ticket submitted successfully');
      setTickets((prev) => [res.data?.data ?? res.data, ...prev]);
      setSubject(''); setBody(''); setCreateMode(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || (isAr ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  }

  const statusColor: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">{isAr ? 'الدعم الفني' : 'Support'}</h2>
        {!createMode && (
          <button onClick={() => setCreateMode(true)}
            className="btn btn-primary btn-sm gap-2 text-sm px-4 py-2">
            <LifebuoyIcon className="w-4 h-4" />
            {isAr ? 'تذكرة جديدة' : 'New Ticket'}
          </button>
        )}
      </div>

      {createMode && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm">{isAr ? 'إنشاء تذكرة دعم' : 'Create Support Ticket'}</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {isAr ? 'الموضوع' : 'Subject'}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={isAr ? 'اكتب موضوع المشكلة...' : 'Briefly describe your issue...'}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {isAr ? 'التفاصيل' : 'Details'}
            </label>
            <textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={isAr ? 'اشرح مشكلتك بالتفصيل...' : 'Explain your issue in detail...'}
              className="input resize-none w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              {isAr ? 'الأولوية' : 'Priority'}
            </label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="input w-full">
              <option value="low">{isAr ? 'منخفضة' : 'Low'}</option>
              <option value="medium">{isAr ? 'متوسطة' : 'Medium'}</option>
              <option value="high">{isAr ? 'عالية' : 'High'}</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCreateMode(false)} className="btn btn-ghost flex-1">
              {t('common.cancel')}
            </button>
            <button onClick={submit} disabled={submitting || !subject.trim() || !body.trim()}
              className="btn btn-primary flex-1 gap-2">
              <LifebuoyIcon className="w-4 h-4" />
              {submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال التذكرة' : 'Submit Ticket')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400">
          <LifebuoyIcon className="w-12 h-12 mb-3" />
          <p className="font-medium text-sm">{isAr ? 'لا توجد تذاكر دعم' : 'No support tickets yet'}</p>
          <p className="text-xs mt-1">{isAr ? 'تواصل معنا إذا واجهت أي مشكلة' : 'Contact us if you encounter any issues'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((tk) => (
            <div key={tk.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{tk.subject_en}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tk.body_en}</p>
                </div>
                <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${statusColor[tk.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {tk.status === 'open' ? (isAr ? 'مفتوحة' : 'Open') :
                   tk.status === 'in_progress' ? (isAr ? 'جارٍ المعالجة' : 'In Progress') :
                   tk.status === 'resolved' ? (isAr ? 'تم الحل' : 'Resolved') :
                   (isAr ? 'مغلقة' : 'Closed')}
                </span>
              </div>
              {tk.priority && (
                <div className="mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tk.priority === 'high' ? 'bg-red-100 text-red-600' : tk.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                    {tk.priority === 'high' ? (isAr ? 'أولوية عالية' : 'High Priority') :
                     tk.priority === 'medium' ? (isAr ? 'أولوية متوسطة' : 'Medium Priority') :
                     (isAr ? 'أولوية منخفضة' : 'Low Priority')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Withdraw Form ──────────────────────────────────────────────────────────

function WithdrawForm({ wallet, t, isAr }: any) {
  const [method, setMethod] = useState('cliq');
  const { register, handleSubmit, setValue, formState: { isSubmitting, errors } } = useForm<any>();
  const available = Number(wallet?.available_balance ?? 0);

  // Keep react-hook-form in sync with controlled method state
  function selectMethod(m: string) {
    setMethod(m);
    setValue('method', m);
  }

  async function submit(data: any) {
    try {
      await withdrawalsApi.request(data);
      toast.success(isAr ? 'تم إرسال طلب السحب بنجاح' : 'Withdrawal request submitted');
    } catch (e: any) {
      toast.error(e.response?.data?.message || (isAr ? 'حدث خطأ' : 'An error occurred'));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {isAr ? 'المبلغ (دينار أردني)' : 'Amount (JOD)'}
        </label>
        <input
          {...register('amount', {
            required: isAr ? 'المبلغ مطلوب' : 'Amount is required',
            valueAsNumber: true,
            min: { value: 20, message: isAr ? 'الحد الأدنى للسحب 20 دينار' : 'Minimum withdrawal is 20 JOD' },
            max: { value: available, message: isAr ? 'المبلغ أكبر من الرصيد المتاح' : 'Amount exceeds available balance' },
            validate: (v) => v > 0 || (isAr ? 'يجب أن يكون المبلغ أكبر من صفر' : 'Amount must be greater than 0'),
          })}
          type="number" step="0.01" min="0"
          className={`input ${errors.amount ? 'border-red-400' : ''}`}
          placeholder="0.00"
        />
        {errors.amount && (
          <p className="text-xs text-red-500 mt-1">{errors.amount.message as string}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {isAr ? 'المتاح للسحب:' : 'Available:'} {formatJOD(available, isAr ? 'ar' : 'en')}
        </p>
      </div>

      {/* Method selector — two cards */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isAr ? 'طريقة السحب' : 'Withdrawal Method'}
        </label>
        <input type="hidden" {...register('method')} />
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'cliq',          labelEn: 'CliQ',          labelAr: 'CliQ',        icon: '⚡' },
            { value: 'bank_transfer', labelEn: 'Bank Transfer', labelAr: 'تحويل بنكي', icon: '🏦' },
          ].map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => selectMethod(m.value)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition ${
                method === m.value
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="text-lg">{m.icon}</span>
              {isAr ? m.labelAr : m.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* CliQ fields */}
      {method === 'cliq' && (
        <div className="space-y-3 bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-medium">
            {isAr
              ? 'أدخل معرف CliQ الخاص بك لتلقي المبلغ'
              : 'Enter your CliQ alias to receive the transfer'}
          </p>
          <input
            {...register('cliq_alias', { required: method === 'cliq' ? (isAr ? 'معرف CliQ مطلوب' : 'CliQ alias is required') : false })}
            placeholder={isAr ? 'مثال: اسمك أو رقمك المسجل في CliQ' : 'e.g. your registered CliQ alias or phone'}
            className="input"
            dir="ltr"
          />
          {errors.cliq_alias && (
            <p className="text-xs text-red-500">{errors.cliq_alias.message as string}</p>
          )}
        </div>
      )}

      {/* Bank Transfer fields */}
      {method === 'bank_transfer' && (
        <div className="space-y-3 bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-600 font-medium">
            {isAr ? 'بيانات الحساب البنكي' : 'Bank account details'}
          </p>
          <input
            {...register('bank_name', { required: method === 'bank_transfer' ? (isAr ? 'اسم البنك مطلوب' : 'Bank name is required') : false })}
            placeholder={isAr ? 'اسم البنك' : 'Bank Name'}
            className="input"
          />
          {errors.bank_name && <p className="text-xs text-red-500">{errors.bank_name.message as string}</p>}
          <input
            {...register('bank_iban', {
              required: method === 'bank_transfer' ? (isAr ? 'رقم IBAN مطلوب' : 'IBAN is required') : false,
              pattern: { value: /^JO\d{2}[A-Z]{4}\d{22}$/, message: isAr ? 'صيغة IBAN غير صحيحة (JO...)' : 'Invalid Jordanian IBAN (JO...)' },
            })}
            placeholder="IBAN (JO...)"
            className="input"
            dir="ltr"
          />
          {errors.bank_iban && <p className="text-xs text-red-500">{errors.bank_iban.message as string}</p>}
        </div>
      )}

      <button type="submit" disabled={isSubmitting || available < 20} className="btn btn-primary w-full">
        {isSubmitting ? t('common.loading') : (isAr ? 'تقديم طلب السحب' : 'Request Withdrawal')}
      </button>
      {available < 20 && (
        <p className="text-xs text-amber-600 text-center">
          {isAr ? 'الحد الأدنى للسحب 20 دينار أردني' : 'Minimum withdrawal is 20 JOD'}
        </p>
      )}
    </form>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
