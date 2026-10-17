import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { copy } from '@/content/copy';
import { AppearancePage } from '@/features/appearance/appearance-page';
import { AuthGate } from '@/features/auth/auth';
import { TextsPage } from '@/features/content/texts-page';
import { CustomersPage } from '@/features/customers/customers-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { LeadsPage } from '@/features/leads/leads-page';
import { OrdersPage } from '@/features/orders/orders-page';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';
import { ProductEditorPage } from '@/features/products/product-editor';
import { ProductsPage } from '@/features/products/products-page';
import { ProgramEditorPage } from '@/features/programs/program-editor';
import { ProgramsPage } from '@/features/programs/programs-page';
import { ReviewsPage } from '@/features/reviews/reviews-page';
import { SettingsPage } from '@/features/settings/settings-page';
import { WholesalePage } from '@/features/wholesale/wholesale-page';
import { OwnerOnly } from '@/features/auth/owner-only';

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
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:id', element: <ProductEditorPage /> },
      { path: 'programs', element: <ProgramsPage /> },
      { path: 'programs/:id', element: <ProgramEditorPage /> },
      { path: 'wholesale', element: <WholesalePage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: 'content', element: <Navigate to="/content/home" replace /> },
      { path: 'content/:key', element: <TextsPage /> },
      { path: 'appearance', element: <AppearancePage /> },
      { path: 'settings', element: <Navigate to="/settings/shop" replace /> },
      {
        path: 'settings/:tab',
        element: (
          <OwnerOnly>
            <SettingsPage />
          </OwnerOnly>
        ),
      },
      { path: '*', element: <PlaceholderPage title={copy.nothingFound} /> },
    ],
  },
]);
