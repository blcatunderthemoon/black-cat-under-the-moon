import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HeaderShieldIcon,
  HeaderMailIcon,
  HeaderForumIcon,
  ForumLockIcon,
  ForumEyeIcon,
  ForumMoonIcon,
} from './ForumIcons.js';

const ITEMS = [
  { href: '/forum/guardian', label: '檢舉佇列', Icon: HeaderForumIcon },
  { href: '/forum/guardian/team', label: '版主團隊', Icon: HeaderShieldIcon },
  { href: '/forum/guardian/monitor', label: '內容監控', Icon: ForumEyeIcon },
  { href: '/admin/moonlight-interest', label: 'Moonlight 調查', Icon: ForumMoonIcon },
  { href: '/admin/email-automation', label: '郵件自動化', Icon: HeaderMailIcon },
  { href: '/admin/login-lockout', label: '登入鎖定', Icon: ForumLockIcon },
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
        const Icon = item.Icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`forum-admin-nav__link${active ? ' forum-admin-nav__link--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="forum-admin-nav__icon" aria-hidden="true">
              <Icon size={14} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
