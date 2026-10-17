import { createBrowserRouter } from 'react-router';
import { AppShell, NAV } from '@/components/app-shell';
import { copy } from '@/content/copy';
import { PlaceholderPage } from '@/features/placeholder/placeholder-page';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: NAV.map((item) =>
      item.to === '/'
        ? { index: true, element: <PlaceholderPage title={copy.nav[item.key]} /> }
        : { path: item.to.slice(1), element: <PlaceholderPage title={copy.nav[item.key]} /> },
    ),
  },
]);
