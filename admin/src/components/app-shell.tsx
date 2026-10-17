import type { UserRole } from '@bom/shared';
import { NavLink, Outlet } from 'react-router';
import { Toaster } from 'sonner';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { useLogout, useUser } from '@/features/auth/auth';
import { useOrderCounters } from '@/api/orders';
import { cn } from '@/lib/utils';
import { ExternalIcon } from './ui';

export const NAV: readonly { key: keyof typeof copy.nav; to: string; roles?: readonly UserRole[] }[] = [
  { key: 'dash', to: '/' },
  { key: 'orders', to: '/orders' },
  { key: 'leads', to: '/leads' },
  { key: 'programs', to: '/programs' },
  { key: 'products', to: '/products' },
  { key: 'wholesale', to: '/wholesale' },
  { key: 'customers', to: '/customers' },
  { key: 'reviews', to: '/reviews' },
  { key: 'content', to: '/content' },
  { key: 'appearance', to: '/appearance' },
  { key: 'settings', to: '/settings', roles: ['owner'] },
];

const navItem = (active: boolean) =>
  cn(
    'flex items-center justify-between gap-2 rounded-control px-3 text-[15px] text-ink',
    active ? 'bg-nav-active font-semibold' : 'font-normal hover:bg-bg',
  );

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-blue px-1.5 text-xs font-semibold text-white">
      {count}
    </span>
  );
}

/** Layout from design/BomAdmin.dc.html: sidebar at ≥ 1024 px, sticky top bar with scrolling tabs below. */
export function AppShell() {
  const user = useUser();
  const logout = useLogout();
  const counters = useOrderCounters();
  const newOrders = counters.data?.new ?? 0;
  const items = NAV.filter((item) => !item.roles || item.roles.includes(user.role));
  const initials = user.name.trim().charAt(0).toUpperCase();

  const links = (className: string) =>
    items.map((item) => (
      <NavLink
        key={item.key}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) => cn(navItem(isActive), className)}
      >
        {copy.nav[item.key]}
        {item.key === 'orders' && <Badge count={newOrders} />}
      </NavLink>
    ));

  return (
    <div className="flex min-h-screen flex-col bg-bg lg:flex-row lg:items-start">
      <header className="sticky top-0 z-30 flex flex-col gap-2.5 border-b border-line bg-surface px-5 pt-3 pb-2.5 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/bom-lockup-full.png"
              alt={copy.brand.logoAlt}
              className="block h-[22px] w-auto"
            />
            <span className="rounded-md bg-subtle px-2 py-[3px] text-xs font-semibold text-muted">
              {copy.brand.badgeShort}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={env.VITE_SITE_URL}
              target="_blank"
              rel="noopener"
              aria-label={copy.openSite}
              className="flex h-[38px] items-center gap-2 rounded-control border border-line px-3 text-sm font-semibold whitespace-nowrap"
            >
              <span className="hidden sm:inline">{copy.openSite}</span>
              <ExternalIcon width={14} height={14} />
            </a>
            <button
              type="button"
              onClick={() => logout.mutate()}
              title={copy.logout}
              aria-label={`${user.name}, ${copy.logout}`}
              className="flex size-[34px] items-center justify-center rounded-full bg-subtle text-sm font-semibold"
            >
              {initials}
            </button>
          </div>
        </div>
        <nav aria-label={copy.brand.badge} className="flex [scrollbar-width:none] gap-1 overflow-x-auto">
          {links('h-[38px] flex-none whitespace-nowrap')}
        </nav>
      </header>

      <aside className="sticky top-0 hidden h-screen w-[clamp(208px,18vw,240px)] flex-none flex-col overflow-y-auto border-r border-line bg-surface px-3.5 pt-6 pb-5 lg:flex">
        <div className="flex flex-col items-start gap-2 px-2.5">
          <img
            src="/brand/bom-lockup-full.png"
            alt={copy.brand.logoAlt}
            className="block h-6 w-auto max-w-full"
          />
          <span className="rounded-md bg-subtle px-2 py-[3px] text-xs font-semibold text-muted">
            {copy.brand.badge}
          </span>
        </div>
        <nav aria-label={copy.brand.badge} className="mt-[30px] flex flex-col gap-0.5">
          {links('h-[42px]')}
        </nav>
        <div className="mt-auto flex flex-col gap-3.5 pt-6">
          <a
            href={env.VITE_SITE_URL}
            target="_blank"
            rel="noopener"
            className="flex h-[42px] items-center justify-between rounded-control border border-line px-3 text-sm font-semibold"
          >
            {copy.openSite}
            <ExternalIcon />
          </a>
          <div className="flex items-center gap-3 border-t border-line-2 px-2.5 pt-3.5">
            <span
              aria-hidden="true"
              className="flex size-9 flex-none items-center justify-center rounded-full bg-subtle text-sm font-semibold"
            >
              {initials}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-sm font-semibold">{user.name}</span>
              <span className="text-[13px] text-muted">{copy.roles[user.role]}</span>
            </div>
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="text-[13px] font-semibold text-muted hover:text-ink"
            >
              {copy.logout}
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-[clamp(20px,3vw,40px)] pt-[clamp(20px,2.4vw,30px)] pb-14">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
