import Link from 'next/link';
import { useRouter } from 'next/router';

const ITEMS = [
  { href: '/forum/guardian', label: '檢舉佇列', icon: '📋' },
  { href: '/forum/guardian/team', label: '版主團隊', icon: '🛡️' },
  { href: '/forum/guardian/monitor', label: '內容監控', icon: '🔍' },
  { href: '/admin/email-automation', label: '郵件自動化', icon: '📧' },
  { href: '/admin/login-lockout', label: '登入鎖定', icon: '🔓' },
];

export default function ForumAdminNav({ layout = 'horizontal' }) {
  const router = useRouter();

  return (
    <nav
      className={`forum-admin-nav${layout === 'sidebar' ? ' forum-admin-nav--sidebar' : ''}`}
      aria-label="論壇管理"
    >
      {ITEMS.map((item) => {
        const active = router.pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`forum-admin-nav__link${active ? ' forum-admin-nav__link--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="forum-admin-nav__icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
