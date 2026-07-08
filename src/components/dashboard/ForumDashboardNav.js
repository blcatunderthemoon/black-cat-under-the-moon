import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '../../styles/dashboard/ForumDashboardNav.module.css';

const ITEMS = [
  { href: '/dashboard/forum', label: '檢舉佇列', icon: '📋' },
  { href: '/dashboard/forum/team', label: '版主團隊', icon: '🛡️' },
  { href: '/dashboard/forum-monitor', label: '內容監控', icon: '🔍' },
];

export default function ForumDashboardNav() {
  const router = useRouter();

  return (
    <nav className={styles.nav} aria-label="月光圍爐治理">
      {ITEMS.map((item) => {
        const active = router.pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.link} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.icon} aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
