import { useCallback, useState } from 'react';
import { useAuthStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { ModelUsage } from './components/ModelUsage';
import styles from './DashboardPage.module.scss';

export function DashboardPage() {
  const connected = useAuthStore((state) => state.connectionStatus === 'connected');
  const [refreshSignal, setRefreshSignal] = useState(0);
  const refresh = useCallback(() => setRefreshSignal((value) => value + 1), []);
  useHeaderRefresh(refresh, connected);

  return (
    <div className={styles.page}>
      <ModelUsage refreshSignal={refreshSignal} />
    </div>
  );
}
