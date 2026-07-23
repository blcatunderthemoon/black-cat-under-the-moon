import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../../styles/dashboard/Sidebar.module.css';
import { FORUM_DASHBOARD_NAV_ITEMS } from './ForumDashboardNav.js';

const MAIN_NAV_ITEMS = [
  { href: '/dashboard', icon: '◉', label: '總覽' },
  { href: '/dashboard/questionnaire-stats', icon: '◫', label: '問卷統計' },
  { href: '/dashboard/matching-analytics', icon: '◈', label: '配對分析' },
  { href: '/dashboard/scoring', icon: '⚡', label: '計分說明' },
  { href: '/dashboard/match-explorer', icon: '◎', label: '配對瀏覽器' },
  { href: '/dashboard/sent-pairs', icon: '✉', label: '已發送配對' },
  { href: '/dashboard/email-automation', icon: '📧', label: '郵件自動化' },
  { href: '/dashboard/export', icon: '⬡', label: '匯出下載' },
  { href: '/dashboard/experiment-lab', icon: '◇', label: '實驗室' },
  { href: '/dashboard/topic-banner', icon: '📌', label: '漂流瓶橫幅' },
  { href: '/dashboard/forum-banner', icon: '📣', label: '論壇橫幅' },
  { href: '/dashboard/forum-hit-topics', icon: '🔥', label: 'Hit Topics' },
];

const MEMBER_NAV_ITEMS = [
  { href: '/dashboard/premium', icon: '💎', label: 'Moonlight Passport' },
  { href: '/dashboard/users', icon: '👤', label: '用戶管理' },
];

function isNavActive(pathname, href) {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/dashboard/forum') {
    return pathname === '/dashboard/forum';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
        {MAIN_NAV_ITEMS.map((item) => {
          const { href, icon, label } = item;
          const isActive = isNavActive(router.pathname, href);
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

        <div className={styles.navDivider} />

        <p className={styles.navSectionLabel}>會員管理</p>
        {MEMBER_NAV_ITEMS.map((item) => {
          const { href, icon, label } = item;
          const isActive = isNavActive(router.pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${styles.navItemSub} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </Link>
          );
        })}

        <div className={styles.navDivider} />

        <p className={styles.navSectionLabel}>論壇管理</p>
        {FORUM_DASHBOARD_NAV_ITEMS.map((item) => {
          const { href, icon, label } = item;
          const isActive = isNavActive(router.pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${styles.navItemSub} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </Link>
          );
        })}

        <div className={styles.navDivider} />

        <Link
          href="/dashboard/test-data"
          className={`${styles.navItem} ${isNavActive(router.pathname, '/dashboard/test-data') ? styles.active : ''}`}
        >
          <span className={styles.navIcon}>⚙</span>
          資料管理
        </Link>
        <Link
          href="/dashboard/moderation"
          className={`${styles.navItem} ${isNavActive(router.pathname, '/dashboard/moderation') ? styles.active : ''}`}
        >
          <span className={styles.navIcon}>🛡</span>
          內容審核
        </Link>
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
