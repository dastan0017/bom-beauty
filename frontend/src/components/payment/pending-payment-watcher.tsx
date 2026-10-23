'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { clearPendingPayment, readPendingPayment } from '@/lib/pending-payment';
import { useCart } from '../cart/cart';

/**
 * Once per visit: an online cart order the customer paid without coming back to the site (closed Finik's tab) empties
 * the cart now. The payment page does the same itself, so it is skipped there.
 */
export function PendingPaymentWatcher() {
  const { clear } = useCart();
  const pathname = usePathname();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || pathname.startsWith('/pay/')) return;
    checked.current = true;
    const record = readPendingPayment();
    if (!record) return;
    // Loaded only when there is an order to check: the payment client brings the order schemas (zod, phone parsing),
    // which stay out of every page's first load (ARCHITECTURE §13).
    void import('@/lib/pay-client')
      .then(({ fetchPayPage }) => fetchPayPage(record.token))
      .then((result) => {
        if (!result.ok) return; // try again on the next visit
        const page = result.value;
        if (page?.status === 'paid' && record.fromCart) clear();
        if (!page || page.status === 'paid' || page.status === 'cancelled' || page.status === 'refunded') {
          clearPendingPayment(record.token);
        }
      })
      .catch(() => undefined);
  }, [pathname, clear]);

  return null;
}
