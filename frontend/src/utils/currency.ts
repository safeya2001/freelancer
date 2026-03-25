/**
 * Format an amount as Jordanian Dinar with exactly 2 decimal places.
 *
 * We intentionally use style:'decimal' (not 'currency') because JOD is an
 * ISO 4217 3-decimal currency and many runtimes enforce 3 fractional digits
 * for it even when minimumFractionDigits/maximumFractionDigits are overridden.
 * Using 'decimal' gives us guaranteed 2-decimal output; we append the symbol manually.
 */
export function formatJOD(amount: number | string, locale: string = 'ar'): string {
  const num = Number(amount ?? 0);
  const n = isNaN(num) ? 0 : num;
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return locale === 'ar' ? `${formatted} د.أ` : `JOD\u00a0${formatted}`;
}

export function calcCommission(amount: number, rate = 10): { gross: number; commission: number; net: number } {
  const commission = Math.round(amount * (rate / 100) * 100) / 100;
  return { gross: amount, commission, net: Math.round((amount - commission) * 100) / 100 };
}
