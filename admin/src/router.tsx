import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { RouteError, RouteLoading } from '@/components/route-error';
import { copy } from '@/content/copy';
import { AuthGate } from '@/features/auth/auth';
import { OwnerOnly } from '@/features/auth/owner-only';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';

// Each screen is its own chunk, so the login screen and the first page load without the editors' code.

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    errorElement: <RouteError fullPage />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      {
        // Pathless: a failing screen is replaced inside the shell, the sidebar stays.
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/dashboard/dashboard-page')).DashboardPage,
            }),
          },
          { path: 'orders', lazy: orders },
          { path: 'orders/:id', lazy: orders },
          {
            path: 'leads',
            lazy: async () => ({ Component: (await import('@/features/leads/leads-page')).LeadsPage }),
          },
          {
            path: 'customers',
            lazy: async () => ({
              Component: (await import('@/features/customers/customers-page')).CustomersPage,
            }),
          },
          {
            path: 'products',
            lazy: async () => ({
              Component: (await import('@/features/products/products-page')).ProductsPage,
            }),
          },
          {
            path: 'products/:id',
            lazy: async () => ({
              Component: (await import('@/features/products/product-editor')).ProductEditorPage,
            }),
          },
          {
            path: 'programs',
            lazy: async () => ({
              Component: (await import('@/features/programs/programs-page')).ProgramsPage,
            }),
          },
          {
            path: 'programs/:id',
            lazy: async () => ({
              Component: (await import('@/features/programs/program-editor')).ProgramEditorPage,
            }),
          },
          {
            path: 'wholesale',
            lazy: async () => ({
              Component: (await import('@/features/wholesale/wholesale-page')).WholesalePage,
            }),
          },
          {
            path: 'reviews',
            lazy: async () => ({ Component: (await import('@/features/reviews/reviews-page')).ReviewsPage }),
          },
          { path: 'content', element: <Navigate to="/content/home" replace /> },
          {
            path: 'content/:key',
            lazy: async () => ({ Component: (await import('@/features/content/texts-page')).TextsPage }),
          },
          {
            path: 'appearance',
            lazy: async () => ({
              Component: (await import('@/features/appearance/appearance-page')).AppearancePage,
            }),
          },
          { path: 'settings', element: <Navigate to="/settings/shop" replace /> },
          {
            path: 'settings/:tab',
            lazy: async () => {
              const { SettingsPage } = await import('@/features/settings/settings-page');
              return {
                element: (
                  <OwnerOnly>
                    <SettingsPage />
                  </OwnerOnly>
                ),
              };
            },
          },
          { path: '*', element: <PlaceholderPage title={copy.nothingFound} /> },
        ],
      },
    ],
  },
]);

async function orders() {
  return { Component: (await import('@/features/orders/orders-page')).OrdersPage };
}
