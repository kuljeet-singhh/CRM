import { Outlet } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useAuth } from '@/hooks/useAuth';
import { useBackgroundSync } from '@/hooks/useBackgroundSync';

export function AppShell() {
  const { user } = useAuth();
  useBackgroundSync(user?.mailProvider, user?.id, true);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
