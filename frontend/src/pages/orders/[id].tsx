import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import ChatRoom from '@/components/chat/ChatRoom';
import { ordersApi, documentsApi, paymentsApi, uploadsApi, disputesApi } from '@/services/api';
import { Order } from '@/types';
import { formatJOD } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import {
  CheckCircleIcon, ArrowPathIcon, DocumentArrowDownIcon,
  BanknotesIcon, ClockIcon, UserIcon, BriefcaseIcon,
  ShieldCheckIcon, ChatBubbleLeftRightIcon, ChevronRightIcon,
  ExclamationTriangleIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';

const STATUS_STEPS = ['pending', 'in_progress', 'delivered', 'completed'];

function StatusStepper({ status, isAr }: { status: string; isAr: boolean }) {
  const labels: Record<string, { en: string; ar: string }> = {
    pending:    { en: 'Pending',     ar: 'في الانتظار' },
    in_progress:{ en: 'In Progress', ar: 'جاري التنفيذ' },
    delivered:  { en: 'Delivered',   ar: 'تم التسليم' },
    completed:  { en: 'Completed',   ar: 'مكتمل' },
  };
  const currentIdx = STATUS_STEPS.indexOf(status);
  const isFailed = ['cancelled', 'disputed', 'revision_requested'].includes(status);

  return (
    <div className="flex items-center w-full">
      {STATUS_STEPS.map((step, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i && !isFailed;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                done  ? 'bg-primary-600 text-white' :
                active ? 'bg-primary-600 text-white ring-4 ring-primary-100' :
                         'bg-gray-100 text-gray-400',
              )}>
                {done
                  ? <CheckCircleSolid className="w-5 h-5" />
                  : <span className="text-xs font-bold">{i + 1}</span>
                }
              </div>
              <span className={clsx('text-[10px] font-medium whitespace-nowrap',
                done || active ? 'text-primary-700' : 'text-gray-400')}>
                {isAr ? labels[step].ar : labels[step].en}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={clsx('flex-1 h-0.5 mx-1 mb-4 transition-colors',
                done ? 'bg-primary-500' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailPage() {
  const { t } = useTranslation('common');
  const { locale, query } = useRouter();
  const isAr = locale === 'ar';
  const { user, isClient, isFreelancer } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliverModal, setDeliverModal] = useState(false);
  const [revisionModal, setRevisionModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'chat'>('details');
  const [actionLoading, setActionLoading] = useState(false);
  const [localPayMethod, setLocalPayMethod]     = useState('cliq');
  const [localPayStep, setLocalPayStep]         = useState<1 | 2 | 3>(1); // 1=select, 2=instructions, 3=submit proof
  const [localPayInstructions, setLocalPayInstructions] = useState<any>(null);
  const [localPayLoading, setLocalPayLoading]   = useState(false);
  const [userReference, setUserReference]       = useState('');
  const [proofFile, setProofFile]               = useState<File | null>(null);
  const [proofUploading, setProofUploading]     = useState(false);
  const [localPayDone, setLocalPayDone]         = useState(false);
  const [disputeModal, setDisputeModal]         = useState(false);
  const [disputeTitle, setDisputeTitle]         = useState('');
  const [disputeDesc, setDisputeDesc]           = useState('');
  const [disputeLoading, setDisputeLoading]     = useState(false);

  useEffect(() => {
    if (!query.id) return;
    ordersApi.get(query.id as string)
      .then((r) => setOrder(r.data.data))
      .finally(() => setLoading(false));
  }, [query.id]);

  async function deliver() {
    setActionLoading(true);
    try {
      await ordersApi.deliver(order!.id, { delivery_note: deliveryNote });
      toast.success(isAr ? 'تم تسليم الطلب بنجاح' : 'Order delivered successfully!');
      setDeliverModal(false);
      setOrder((o) => o ? { ...o, status: 'delivered' } : o);
    } catch {
      toast.error(isAr ? 'حدث خطأ' : 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  async function complete() {
    setActionLoading(true);
    try {
      await ordersApi.complete(order!.id);
      toast.success(isAr ? 'تم إكمال الطلب وإصدار الدفعة' : 'Order completed & payment released!');
      setOrder((o) => o ? { ...o, status: 'completed' } : o);
    } catch {
      toast.error(isAr ? 'حدث خطأ' : 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  async function requestRevision() {
    setActionLoading(true);
    try {
      await ordersApi.revision(order!.id, revisionNote);
      toast.success(isAr ? 'تم طلب المراجعة' : 'Revision requested');
      setRevisionModal(false);
      setOrder((o) => o ? { ...o, status: 'revision_requested' } : o);
    } catch {
      toast.error(isAr ? 'حدث خطأ' : 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  async function openDispute() {
    if (!disputeTitle.trim() || !disputeDesc.trim()) {
      toast.error(isAr ? 'يرجى ملء جميع الحقول' : 'Please fill in all fields');
      return;
    }
    setDisputeLoading(true);
    try {
      await disputesApi.open({ order_id: order!.id, title_en: disputeTitle, description_en: disputeDesc });
      toast.success(isAr ? 'تم فتح النزاع بنجاح' : 'Dispute opened successfully');
      setDisputeModal(false);
      setOrder((o) => o ? { ...o, status: 'disputed' } : o);
    } catch (e: any) {
      toast.error(e.response?.data?.message || (isAr ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setDisputeLoading(false);
    }
  }

  // Step 1 → 2: show platform payment instructions
  function showInstructions() {
    const method = localPayMethod;
    const amount = order!.price;
    const ref = `LOC-${Date.now().toString(36).toUpperCase()}`;
    setLocalPayInstructions({ method, amount, ref });
    setLocalPayStep(2);
  }

  // Step 3: submit proof + reference → create pending transaction
  async function submitProof() {
    if (!userReference.trim()) {
      toast.error(isAr ? 'يرجى إدخال رقم مرجعي من تطبيق البنك' : 'Please enter the reference number from your bank app');
      return;
    }
    setProofUploading(true);
    try {
      let proofUrl: string | undefined;
      if (proofFile) {
        const uploadRes = await uploadsApi.single(proofFile);
        proofUrl = uploadRes.data?.data?.url;
      }
      await paymentsApi.initiateLocal({
        order_id:        order!.id,
        payment_method:  localPayMethod,
        user_reference:  userReference.trim(),
        proof_image_url: proofUrl,
      });
      setLocalPayDone(true);
      toast.success(isAr ? 'تم إرسال طلب الإيداع — في انتظار موافقة الإدارة' : 'Deposit request submitted — awaiting admin approval');
    } catch (e: any) {
      toast.error(e.response?.data?.message || (isAr ? 'حدث خطأ' : 'An error occurred'));
    } finally {
      setProofUploading(false);
    }
  }

  async function downloadReceipt(txId: string) {
    try {
      const res = await documentsApi.paymentProof(txId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `receipt-${order!.id.slice(0, 8)}.pdf`; a.click();
    } catch {
      toast.error(isAr ? 'فشل تحميل الإيصال' : 'Failed to download receipt');
    }
  }

  if (loading) {
    return (
      <Layout title="Order">
        <div className="section-container py-8 space-y-4">
          <div className="skeleton h-8 w-1/3 rounded-xl" />
          <div className="skeleton h-48 rounded-2xl" />
          <div className="skeleton h-32 rounded-2xl" />
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout title="Not Found">
        <div className="section-container py-24 text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-700">{isAr ? 'الطلب غير موجود' : 'Order not found'}</p>
          <Link href="/dashboard" className="btn btn-primary mt-6 inline-flex">
            {isAr ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
          </Link>
        </div>
      </Layout>
    );
  }

  const platform_fee = order.price - order.freelancer_amount;
  const isCompleted = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';

  return (
    <Layout title={`Order #${order.id.slice(0, 8).toUpperCase()}`} fullWidth>
      <div className="section-container py-8">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
          <Link href="/dashboard" className="hover:text-primary-600 transition-colors">
            {isAr ? 'لوحة التحكم' : 'Dashboard'}
          </Link>
          <ChevronRightIcon className={clsx('w-4 h-4', isAr && 'rotate-180')} />
          <span className="text-gray-700 font-medium">
            {isAr ? 'طلب' : 'Order'} #{order.id.slice(0, 8).toUpperCase()}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main Column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Order Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Top bar */}
              <div className={clsx(
                'px-6 py-4 flex items-center justify-between',
                isCompleted ? 'bg-emerald-50 border-b border-emerald-100' :
                isCancelled ? 'bg-red-50 border-b border-red-100' :
                              'bg-primary-50 border-b border-primary-100',
              )}>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                    {isAr ? 'رقم الطلب' : 'Order ID'}
                  </p>
                  <p className="font-black text-gray-900 text-lg tracking-tight">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <Badge status={order.status} label={t(`orders.${order.status}`)} />
              </div>

              <div className="p-6">
                <h1 className="text-lg font-bold text-gray-900 mb-5">{order.gig_title}</h1>

                {/* Status stepper */}
                {!isCancelled && (
                  <div className="mb-6">
                    <StatusStepper status={order.status} isAr={isAr} />
                  </div>
                )}

                {/* Financial breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-3.5">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <BanknotesIcon className="w-3.5 h-3.5" />
                      {isAr ? 'إجمالي السعر' : 'Total Price'}
                    </p>
                    <p className="font-black text-primary-700 text-lg">{formatJOD(order.price)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3.5">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5" />
                      {t('payment.freelancer_receives')}
                    </p>
                    <p className="font-bold text-gray-800 text-lg">{formatJOD(order.freelancer_amount)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3.5">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <ClockIcon className="w-3.5 h-3.5" />
                      {isAr ? 'الموعد النهائي' : 'Deadline'}
                    </p>
                    <p className="font-bold text-gray-800 text-sm">
                      {order.deadline ? new Date(order.deadline).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB') : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Escrow Info */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center">
                  <LockClosedIcon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">
                    {isAr ? 'الدفع المحمي (Escrow)' : 'Protected Escrow Payment'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {isAr
                      ? 'المبلغ محفوظ بأمان حتى اكتمال العمل'
                      : 'Funds are safely held until work is approved'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-blue-50 py-3 px-2">
                  <p className="text-xs text-blue-600 font-semibold mb-0.5">{isAr ? 'مدفوع في الضمان' : 'In Escrow'}</p>
                  <p className="font-black text-blue-700">{formatJOD(order.price)}</p>
                </div>
                <div className="rounded-xl bg-amber-50 py-3 px-2">
                  <p className="text-xs text-amber-600 font-semibold mb-0.5">{isAr ? 'رسوم المنصة' : 'Platform Fee'}</p>
                  <p className="font-black text-amber-700">{formatJOD(platform_fee)}</p>
                </div>
                <div className={clsx('rounded-xl py-3 px-2', isCompleted ? 'bg-emerald-50' : 'bg-gray-50')}>
                  <p className={clsx('text-xs font-semibold mb-0.5', isCompleted ? 'text-emerald-600' : 'text-gray-500')}>
                    {isAr ? (isCompleted ? 'تم الصرف' : 'للمستقل') : (isCompleted ? 'Released' : 'Freelancer Gets')}
                  </p>
                  <p className={clsx('font-black', isCompleted ? 'text-emerald-700' : 'text-gray-700')}>
                    {formatJOD(order.freelancer_amount)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Tab: Details / Chat */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Tab bar */}
              <div className="flex border-b border-gray-100">
                {[
                  { id: 'details', labelEn: 'Details', labelAr: 'التفاصيل' },
                  ...(order.chat_room_id ? [{ id: 'chat', labelEn: 'Messages', labelAr: 'الرسائل' }] : []),
                ].map(({ id, labelEn, labelAr }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={clsx(
                      'flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 -mb-px',
                      activeTab === id
                        ? 'border-primary-600 text-primary-700'
                        : 'border-transparent text-gray-500 hover:text-gray-800',
                    )}
                  >
                    {id === 'chat' && <ChatBubbleLeftRightIcon className="w-4 h-4" />}
                    {isAr ? labelAr : labelEn}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'details' ? (
                  <motion.div key="details"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="p-5"
                  >
                    {(order as any).requirements && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                          {isAr ? 'متطلبات العميل' : 'Client Requirements'}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 whitespace-pre-wrap">
                          {(order as any).requirements}
                        </p>
                      </div>
                    )}
                    {!(order as any).requirements && (
                      <p className="text-sm text-gray-400 text-center py-6">
                        {isAr ? 'لا توجد متطلبات محددة' : 'No specific requirements provided'}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="chat"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="h-96"
                  >
                    <ChatRoom roomId={order.chat_room_id!} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Actions */}
            {(
              (isFreelancer && order.status === 'in_progress') ||
              (isClient && order.status === 'delivered') ||
              isCompleted ||
              ['in_progress', 'delivered', 'revision_requested'].includes(order.status)
            ) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
              >
                <h2 className="font-bold text-gray-900 mb-4 text-sm">
                  {isAr ? 'الإجراءات المتاحة' : 'Available Actions'}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {isFreelancer && order.status === 'in_progress' && (
                    <button
                      onClick={() => setDeliverModal(true)}
                      className="btn btn-primary gap-2"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      {t('orders.deliver')}
                    </button>
                  )}
                  {isClient && order.status === 'delivered' && (
                    <>
                      <button
                        onClick={complete}
                        disabled={actionLoading}
                        className="btn btn-primary gap-2"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        {isAr ? 'قبول وإصدار الدفعة' : 'Approve & Release Payment'}
                      </button>
                      <button
                        onClick={() => setRevisionModal(true)}
                        disabled={actionLoading}
                        className="btn btn-outline gap-2"
                      >
                        <ArrowPathIcon className="w-4 h-4" />
                        {t('orders.request_revision')}
                      </button>
                    </>
                  )}
                  {isCompleted && (
                    <button
                      onClick={() => downloadReceipt(order.id)}
                      className="btn btn-outline gap-2"
                    >
                      <DocumentArrowDownIcon className="w-4 h-4" />
                      {t('payment.download_receipt')}
                    </button>
                  )}
                  {['in_progress', 'delivered', 'revision_requested'].includes(order.status) && (
                    <button
                      onClick={() => setDisputeModal(true)}
                      className="btn btn-outline gap-2 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      {isAr ? 'فتح نزاع' : 'Open Dispute'}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* ── Local Payment Panel (client + pending order) ── */}
            {isClient && order.status === 'pending' && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 }}
                className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <BanknotesIcon className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-gray-900 text-sm">
                    {isAr ? 'تمويل الطلب' : 'Fund this Order'}
                  </h3>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`flex items-center gap-1 ${s < 3 ? 'flex-1' : ''}`}>
                      <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${localPayStep >= s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
                      {s < 3 && <div className={`flex-1 h-0.5 ${localPayStep > s ? 'bg-primary-500' : 'bg-gray-200'}`} />}
                    </div>
                  ))}
                </div>

                {/* Step 1: choose method */}
                {localPayStep === 1 && (
                  <>
                    <p className="text-xs text-gray-500">{isAr ? 'اختر طريقة الدفع' : 'Choose payment method'}</p>
                    <div className="space-y-2">
                      {[
                        { value: 'cliq',          label: 'CliQ' },
                        { value: 'zain_cash',     label: 'Zain Cash' },
                        { value: 'orange_money',  label: 'Orange Money' },
                        { value: 'bank_transfer', label: isAr ? 'تحويل بنكي' : 'Bank Transfer' },
                      ].map((m) => (
                        <label key={m.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${localPayMethod === m.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="radio" name="localPayMethod" value={m.value}
                            checked={localPayMethod === m.value}
                            onChange={() => setLocalPayMethod(m.value)}
                            className="accent-primary-600" />
                          <span className="text-sm font-medium text-gray-700">{m.label}</span>
                        </label>
                      ))}
                    </div>
                    <button onClick={showInstructions} className="btn btn-primary w-full">
                      {isAr ? 'التالي: عرض تعليمات الدفع' : 'Next: View Payment Instructions'}
                    </button>
                  </>
                )}

                {/* Step 2: show platform instructions */}
                {localPayStep === 2 && localPayInstructions && (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                        {isAr ? 'حوّل المبلغ إلى الحساب أدناه' : 'Transfer to the account below'}
                      </p>
                      {localPayInstructions.method === 'cliq' && (
                        <div className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                          <span className="font-medium text-gray-500">CliQ Alias</span>
                          <span className="font-bold text-gray-800 font-mono">DOPAWORK.JO</span>
                        </div>
                      )}
                      {localPayInstructions.method === 'bank_transfer' && (
                        <div className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                          <span className="font-medium text-gray-500">IBAN</span>
                          <span className="font-bold text-gray-800 font-mono">JO00XXXX0000000000000000</span>
                        </div>
                      )}
                      {['zain_cash', 'orange_money'].includes(localPayInstructions.method) && (
                        <div className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                          <span className="font-medium text-gray-500">{isAr ? 'رقم الهاتف' : 'Mobile'}</span>
                          <span className="font-bold text-gray-800 font-mono">+962 7X XXX XXXX</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                        <span className="font-medium text-gray-500">{isAr ? 'المبلغ' : 'Amount'}</span>
                        <span className="font-bold text-primary-700">{formatJOD(localPayInstructions.amount)}</span>
                      </div>
                      <p className="text-xs text-amber-700 font-medium">
                        {isAr ? 'بعد التحويل، اضغط "التالي" لرفع إثبات الدفع.' : 'After transferring, click "Next" to upload your proof.'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setLocalPayStep(1)} className="btn btn-outline flex-1 text-sm">
                        {isAr ? 'رجوع' : 'Back'}
                      </button>
                      <button onClick={() => setLocalPayStep(3)} className="btn btn-primary flex-1 text-sm">
                        {isAr ? 'التالي: رفع الإثبات' : 'Next: Upload Proof'}
                      </button>
                    </div>
                  </>
                )}

                {/* Step 3: upload proof + reference */}
                {localPayStep === 3 && !localPayDone && (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {isAr ? '* الرقم المرجعي من تطبيق البنك' : '* Reference number from your bank app'}
                        </label>
                        <input
                          type="text"
                          value={userReference}
                          onChange={(e) => setUserReference(e.target.value)}
                          placeholder={isAr ? 'مثال: TXN-123456789' : 'e.g. TXN-123456789'}
                          className="input text-sm"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {isAr ? 'لقطة شاشة الحوالة (موصى بها)' : 'Transfer screenshot (recommended)'}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                          className="text-xs text-gray-500 w-full"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setLocalPayStep(2)} className="btn btn-outline flex-1 text-sm">
                        {isAr ? 'رجوع' : 'Back'}
                      </button>
                      <button onClick={submitProof} disabled={proofUploading || !userReference.trim()} className="btn btn-primary flex-1 text-sm">
                        {proofUploading ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال طلب الإيداع' : 'Submit Deposit Request')}
                      </button>
                    </div>
                  </>
                )}

                {/* Done */}
                {localPayDone && (
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">{isAr ? 'تم استلام طلبك!' : 'Request received!'}</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {isAr ? 'سيتحقق الأدمن من الحوالة ويفعّل الطلب خلال وقت قصير.' : 'Admin will verify your transfer and activate the order shortly.'}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Parties */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
                {isAr ? 'أطراف العقد' : 'Contract Parties'}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <UserIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-blue-500 uppercase">{isAr ? 'العميل' : 'Client'}</p>
                    <p className="text-sm font-semibold text-gray-800">{order.client_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-xl">
                  <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                    <BriefcaseIcon className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary-500 uppercase">{isAr ? 'المستقل' : 'Freelancer'}</p>
                    <p className="text-sm font-semibold text-gray-800">{order.freelancer_name}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Protection badge */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-gradient-to-br from-primary-900 to-primary-700 rounded-2xl p-5 text-white"
            >
              <ShieldCheckIcon className="w-8 h-8 text-primary-200 mb-3" />
              <p className="font-bold mb-1">{isAr ? 'مدفوعاتك محمية' : 'Your Payment is Protected'}</p>
              <p className="text-xs text-primary-200 leading-relaxed">
                {isAr
                  ? 'تُحتجز الأموال في الضمان ولا تُحرَّر إلا بعد موافقتك على العمل المنجز.'
                  : 'Funds are held in escrow and only released when you approve the completed work.'}
              </p>
            </motion.div>

            {/* Completed confirmation */}
            {isCompleted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center"
              >
                <CheckCircleSolid className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-emerald-800 text-sm">
                  {isAr ? 'تم إكمال الطلب' : 'Order Completed'}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {isAr
                    ? `تم صرف ${formatJOD(order.freelancer_amount)} للمستقل`
                    : `${formatJOD(order.freelancer_amount)} released to freelancer`}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Deliver Modal ── */}
      <Modal open={deliverModal} onClose={() => setDeliverModal(false)} title={t('orders.deliver')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {isAr
              ? 'أضف ملاحظة للعميل توضح ما تم تسليمه.'
              : 'Add a note to the client explaining what was delivered.'}
          </p>
          <textarea
            rows={5}
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder={isAr ? 'ملاحظة التسليم...' : 'Describe what you delivered...'}
            className="input resize-none w-full"
          />
          <div className="flex gap-3">
            <button onClick={() => setDeliverModal(false)} className="btn btn-ghost flex-1">
              {t('common.cancel')}
            </button>
            <button onClick={deliver} disabled={actionLoading} className="btn btn-primary flex-1 gap-2">
              <CheckCircleIcon className="w-4 h-4" />
              {t('orders.deliver')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Revision Modal ── */}
      <Modal open={revisionModal} onClose={() => setRevisionModal(false)} title={t('orders.request_revision')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {isAr
              ? 'اشرح للمستقل ما يحتاج إلى تعديل.'
              : 'Explain to the freelancer what needs to be changed.'}
          </p>
          <textarea
            rows={5}
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder={isAr ? 'اكتب ملاحظات المراجعة...' : 'Describe what needs to be revised...'}
            className="input resize-none w-full"
          />
          <div className="flex gap-3">
            <button onClick={() => setRevisionModal(false)} className="btn btn-ghost flex-1">
              {t('common.cancel')}
            </button>
            <button onClick={requestRevision} disabled={actionLoading} className="btn btn-primary flex-1 gap-2">
              <ArrowPathIcon className="w-4 h-4" />
              {t('common.submit')}
            </button>
          </div>
        </div>
      </Modal>
      {/* ── Dispute Modal ── */}
      <Modal open={disputeModal} onClose={() => setDisputeModal(false)}
        title={isAr ? 'فتح نزاع' : 'Open Dispute'}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              {isAr
                ? 'فتح نزاع يُعلم الأدمن وسيتم مراجعة الطلب. يُرجى وصف المشكلة بوضوح.'
                : 'Opening a dispute notifies admin and the order will be reviewed. Please describe the issue clearly.'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isAr ? 'عنوان النزاع' : 'Dispute Title'}
            </label>
            <input
              type="text"
              value={disputeTitle}
              onChange={(e) => setDisputeTitle(e.target.value)}
              placeholder={isAr ? 'مثال: العمل المسلم لا يطابق المتطلبات' : 'e.g. Delivered work does not match requirements'}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isAr ? 'وصف المشكلة' : 'Describe the Issue'}
            </label>
            <textarea
              rows={4}
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              placeholder={isAr ? 'اشرح المشكلة بالتفصيل...' : 'Explain the issue in detail...'}
              className="input resize-none w-full"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDisputeModal(false)} className="btn btn-ghost flex-1">
              {t('common.cancel')}
            </button>
            <button onClick={openDispute} disabled={disputeLoading || !disputeTitle.trim() || !disputeDesc.trim()}
              className="btn flex-1 gap-2 bg-red-600 hover:bg-red-700 text-white">
              <ExclamationTriangleIcon className="w-4 h-4" />
              {disputeLoading ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'فتح النزاع' : 'Open Dispute')}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
