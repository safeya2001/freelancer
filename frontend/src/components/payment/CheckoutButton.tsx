import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { paymentsApi } from '@/services/api';
import toast from 'react-hot-toast';

interface Props {
  type: 'order' | 'milestone';
  id: string;
  amount: number;
  label?: string;
  disabled?: boolean;
}

export default function CheckoutButton({ type, id, amount, label, disabled }: Props) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = type === 'order'
        ? await paymentsApi.checkoutOrder(id)
        : await paymentsApi.checkoutMilestone(id);
      window.location.href = res.data.data.checkout_url;
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={handleCheckout} disabled={disabled || loading}
        className="btn btn-primary w-full btn-lg">
        {loading ? t('common.loading') : (label || t('payment.fund_escrow'))}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <ShieldCheckIcon className="w-3.5 h-3.5" />
        {t('payment.secure_payment')}
      </p>
    </div>
  );
}
