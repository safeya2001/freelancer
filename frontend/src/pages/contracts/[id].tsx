import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import Badge from '@/components/ui/Badge';
import ChatRoom from '@/components/chat/ChatRoom';
import CheckoutButton from '@/components/payment/CheckoutButton';
import { contractsApi, milestonesApi } from '@/services/api';
import { Contract, Milestone } from '@/types';
import { formatJOD } from '@/utils/currency';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import clsx from 'clsx';

export default function ContractDetailPage() {
  const { t } = useTranslation('common');
  const { locale, query } = useRouter();
  const isAr = locale === 'ar';
  const { user, isClient, isFreelancer } = useAuth();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitModal, setSubmitModal] = useState<string | null>(null);
  const [revisionModal, setRevisionModal] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!query.id) return;
    contractsApi.get(query.id as string)
      .then((r) => setContract(r.data.data))
      .finally(() => setLoading(false));
  }, [query.id]);

  function reload() {
    contractsApi.get(query.id as string).then((r) => setContract(r.data.data));
  }

  async function submitMilestone(milestoneId: string) {
    await milestonesApi.submit(milestoneId, { delivery_note_en: note });
    toast.success(isAr ? 'تم تسليم المرحلة' : 'Milestone submitted!');
    setSubmitModal(null); setNote(''); reload();
  }

  async function approveMilestone(milestoneId: string) {
    await milestonesApi.approve(milestoneId);
    toast.success(isAr ? 'تمت الموافقة وإصدار الدفعة' : 'Approved & payment released!');
    reload();
  }

  async function requestRevision(milestoneId: string) {
    await milestonesApi.revision(milestoneId, note);
    toast.success(isAr ? 'تم طلب المراجعة' : 'Revision requested');
    setRevisionModal(null); setNote(''); reload();
  }

  if (loading) return <Layout title="Contract"><div className="card animate-pulse h-64" /></Layout>;
  if (!contract) return <Layout title="Not Found"><p className="text-center py-20">Contract not found</p></Layout>;

  const statusColor: Record<string, string> = {
    pending: 'bg-gray-100', in_progress: 'bg-yellow-50', submitted: 'bg-blue-50',
    approved: 'bg-green-50', revision_requested: 'bg-orange-50',
  };

  return (
    <Layout title={contract.title_en}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="card">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-xl font-bold">{contract.title_en}</h1>
              <Badge status={contract.status} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs text-gray-400">{isAr ? 'الإجمالي' : 'Total'}</p><p className="font-bold text-primary-700">{formatJOD(contract.total_amount)}</p></div>
              <div><p className="text-xs text-gray-400">{t('payment.commission')}</p><p className="font-semibold">{formatJOD(contract.commission_amount)}</p></div>
              <div><p className="text-xs text-gray-400">{t('payment.freelancer_receives')}</p><p className="font-semibold">{formatJOD(contract.freelancer_amount)}</p></div>
            </div>
          </div>

          {/* Milestones */}
          <div className="card">
            <h2 className="section-title">{t('contracts.milestones')}</h2>
            <div className="space-y-3">
              {contract.milestones?.map((ms, idx) => (
                <div key={ms.id} className={clsx('rounded-xl p-4 border border-gray-100', statusColor[ms.status])}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-700 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{isAr ? ms.title_ar || ms.title_en : ms.title_en}</p>
                        {ms.due_date && <p className="text-xs text-gray-400">Due: {new Date(ms.due_date).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="font-bold text-primary-700">{formatJOD(ms.amount)}</p>
                      <Badge status={ms.status} label={t(`contracts.${ms.status}`)} />
                    </div>
                  </div>

                  {/* Milestone actions */}
                  <div className="flex flex-wrap gap-2">
                    {/* Client: fund escrow when pending */}
                    {isClient && ms.status === 'pending' && (
                      <CheckoutButton type="milestone" id={ms.id} amount={ms.amount}
                        label={t('contracts.fund_escrow')} />
                    )}
                    {/* Freelancer: start / submit */}
                    {isFreelancer && ms.status === 'in_progress' && (
                      <button onClick={() => setSubmitModal(ms.id)} className="btn btn-primary btn-sm">
                        {t('contracts.submit_milestone')}
                      </button>
                    )}
                    {/* Client: approve / revision */}
                    {isClient && ms.status === 'submitted' && (
                      <>
                        <button onClick={() => approveMilestone(ms.id)} className="btn btn-primary btn-sm">
                          {t('contracts.approve_milestone')}
                        </button>
                        <button onClick={() => setRevisionModal(ms.id)} className="btn btn-outline btn-sm">
                          {t('contracts.request_revision')}
                        </button>
                      </>
                    )}
                    {ms.delivery_note_en && (
                      <p className="text-xs text-gray-500 w-full mt-1">📝 {ms.delivery_note_en}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          {contract.chat_room_id && (
            <div className="card !p-0 overflow-hidden h-96">
              <div className="p-4 border-b font-semibold text-sm">{t('nav.messages')}</div>
              <div className="h-[calc(100%-52px)]">
                <ChatRoom roomId={contract.chat_room_id} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl" />
                <div>
                  <p className="text-xs text-gray-400">{isAr ? 'العميل' : 'Client'}</p>
                  <p className="text-sm font-semibold">{contract.client_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl" />
                <div>
                  <p className="text-xs text-gray-400">{isAr ? 'المستقل' : 'Freelancer'}</p>
                  <p className="text-sm font-semibold">{contract.freelancer_name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit milestone modal */}
      <Modal open={!!submitModal} onClose={() => setSubmitModal(null)} title={t('contracts.submit_milestone')}>
        <div className="space-y-4">
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            className="input resize-none w-full" placeholder={isAr ? 'ملاحظة التسليم...' : 'Delivery note...'} />
          <div className="flex gap-3">
            <button onClick={() => setSubmitModal(null)} className="btn btn-ghost flex-1">{t('common.cancel')}</button>
            <button onClick={() => submitMilestone(submitModal!)} className="btn btn-primary flex-1">{t('common.submit')}</button>
          </div>
        </div>
      </Modal>

      {/* Revision modal */}
      <Modal open={!!revisionModal} onClose={() => setRevisionModal(null)} title={t('contracts.request_revision')}>
        <div className="space-y-4">
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)}
            className="input resize-none w-full" placeholder={isAr ? 'اكتب ملاحظات المراجعة...' : 'What needs to change?'} />
          <div className="flex gap-3">
            <button onClick={() => setRevisionModal(null)} className="btn btn-ghost flex-1">{t('common.cancel')}</button>
            <button onClick={() => requestRevision(revisionModal!)} className="btn btn-primary flex-1">{t('common.submit')}</button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale!, ['common'])) },
});
