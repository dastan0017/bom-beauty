import { createBrowserRouter } from 'react-router';
import { AppShell, NAV } from '@/components/app-shell';
import { copy } from '@/content/copy';
import { AuthGate } from '@/features/auth/auth';
import { CustomersPage } from '@/features/customers/customers-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { LeadsPage } from '@/features/leads/leads-page';
import { OrdersPage } from '@/features/orders/orders-page';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';

const BUILT = new Set(['dash', 'orders', 'leads', 'customers']);

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrdersPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      ...NAV.filter((item) => !BUILT.has(item.key)).map((item) => ({
        path: item.to.slice(1),
        element: <PlaceholderPage title={copy.nav[item.key]} />,
      })),
      { path: '*', element: <PlaceholderPage title={copy.nothingFound} /> },
    ],
  },
]);
