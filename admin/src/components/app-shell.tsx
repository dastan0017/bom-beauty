import { NavLink, Outlet } from 'react-router';
import { copy } from '@/content/copy';
import { env } from '@/env';
import { cn } from '@/lib/utils';

export const NAV = [
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
  { key: 'settings', to: '/settings' },
] as const;

const navItem = (active: boolean) =>
  cn(
    'flex items-center rounded-control px-3 text-[15px] text-ink',
    active ? 'bg-nav-active font-semibold' : 'font-normal',
  );

/** Layout from design/BomAdmin.dc.html: sidebar at ≥ 1024 px, sticky top bar with scrolling tabs below. */
export function AppShell() {
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
          <a
            href={env.VITE_SITE_URL}
            className="flex h-[38px] items-center rounded-control border border-line px-3 text-sm font-semibold whitespace-nowrap"
          >
            {copy.openSite}
          </a>
        </div>
        <nav className="flex [scrollbar-width:none] gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(navItem(isActive), 'h-[38px] flex-none whitespace-nowrap')}
            >
              {copy.nav[item.key]}
            </NavLink>
          ))}
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
        <nav className="mt-[30px] flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => cn(navItem(isActive), 'h-[42px]')}
            >
              {copy.nav[item.key]}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3.5 pt-6">
          <a
            href={env.VITE_SITE_URL}
            className="flex h-[42px] items-center justify-between rounded-control border border-line px-3 text-sm font-semibold"
          >
            {copy.openSite}
          </a>
          <div className="flex items-center gap-3 border-t border-line-2 px-2.5 pt-3.5">
            <span aria-hidden="true" className="size-9 rounded-full bg-subtle" />
            <div className="flex flex-col gap-px">
              <span className="text-sm font-semibold">{copy.owner.name}</span>
              <span className="text-[13px] text-muted">{copy.owner.role}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-[clamp(20px,3vw,40px)] pt-[clamp(20px,2.4vw,30px)] pb-14">
        <Outlet />
      </main>
    </div>
  );
}
