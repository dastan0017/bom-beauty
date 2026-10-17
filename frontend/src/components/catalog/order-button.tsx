'use client';

import { waLink } from '@bom/shared/web';
import type { ReactNode } from 'react';
import { copy } from '@/content/copy';
import { useOverlays, type OrderItem } from '../overlays/site-overlays';

/**
 * Opens the order sheet. Rendered as a wa.me link with a short default message, so ordering still works before
 * hydration or without JavaScript (docs/ARCHITECTURE.md §6.2).
 */
export function OrderButton({
  item,
  qty = 1,
  className,
  children,
}: {
  item: OrderItem;
  qty?: number;
  className?: string;
  children: ReactNode;
}) {
  const { openOrder, whatsapp } = useOverlays();
  return (
    <a
      href={waLink(whatsapp, `${copy.whatsappFallback}: ${item.title}`)}
      target="_blank"
      rel="noopener noreferrer"
      role="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openOrder(item, { qty });
      }}
    >
      {children}
    </a>
  );
}
