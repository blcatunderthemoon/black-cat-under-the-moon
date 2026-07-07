import { useEffect, useState } from 'react';
import styles from '../../styles/dashboard/Header.module.css';

export default function Header({ pageTitle, breadcrumb, stats }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = () => setTime(
      new Date().toLocaleTimeString('zh-HK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.pageTitle}>{pageTitle || '儀表板'}</span>
        {breadcrumb && <span className={styles.breadcrumb}>{breadcrumb}</span>}
      </div>

      <div className={styles.right}>
        {stats && stats.length > 0 && (
          <div className={styles.statsStrip}>
            {stats.map((s, i) => (
              <div key={i} style={{ display: 'contents' }}>
                {i > 0 && <div className={styles.divider} />}
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{s.value}</span>
                  <span className={styles.statLabel}>{s.label}</span>
                </div>
              </div>
            ))}
            <div className={styles.divider} />
          </div>
        )}

        <div className={styles.statusBadge}>
          <span className={styles.statusDot} />
          系統正常
        </div>

        <span className={styles.timestamp}>{time}</span>
      </div>
    </div>
  );
}
