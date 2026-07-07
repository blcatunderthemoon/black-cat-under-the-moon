import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../../styles/dashboard/Sidebar.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', icon: '◉', label: '總覽' },
  { href: '/dashboard/questionnaire-stats', icon: '◫', label: '問卷統計' },
  { href: '/dashboard/matching-analytics', icon: '◈', label: '配對分析' },
  { href: '/dashboard/scoring', icon: '⚡', label: '計分說明' },
  { href: '/dashboard/match-explorer', icon: '◎', label: '配對瀏覽器' },
  { href: '/dashboard/sent-pairs', icon: '✉', label: '已發送配對' },
  { href: '/dashboard/email-automation', icon: '📧', label: '郵件自動化' },
  { href: '/dashboard/export', icon: '⬡', label: '匯出下載' },
  { href: '/dashboard/experiment-lab', icon: '◇', label: '實驗室' },
  null,
  { href: '/dashboard/forum', icon: '🌙', label: '月光圍爐' },
  { href: '/dashboard/test-data', icon: '⚙', label: '資料管理' },
  { href: '/dashboard/moderation', icon: '🛡', label: '內容審核' },
];

export default function Sidebar() {
  const router = useRouter();

  return (
    <div className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🌙</span>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>黑貓配對</span>
          <span className={styles.logoSub}>INTELLIGENCE DASHBOARD</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item, i) => {
          if (item === null) return <div key={`divider-${i}`} className={styles.navDivider} />;
          const { href, icon, label } = item;
          const isActive = href === '/dashboard'
            ? router.pathname === '/dashboard'
            : router.pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          Black Cat Under The Moon
          <br />
          v1.0 · Internal Tool
        </p>
      </div>
    </div>
  );
}
