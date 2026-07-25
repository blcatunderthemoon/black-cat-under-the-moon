import { useCallback, useEffect, useState } from 'react';
import { forumAdminFetch } from '../../lib/forum-admin-fetch.js';
import {
  ForumMoonIcon,
  ForumBookIcon,
  ForumLockIcon,
  HeaderChatIcon,
  HeaderShieldIcon,
  HeaderUserPlusIcon,
  HeaderForumIcon,
} from '../ForumIcons.js';

function formatStat(value) {
  if (value == null) return '—';
  return value.toLocaleString('zh-HK');
}

function StatCard({ icon, label, value, sub, tone = 'default' }) {
  return (
    <div className={`forum-admin-stat forum-admin-stat--${tone}`}>
      <span className="forum-admin-stat__icon" aria-hidden="true">{icon}</span>
      <div className="forum-admin-stat__body">
        <span className="forum-admin-stat__value">{formatStat(value)}</span>
        <span className="forum-admin-stat__label">{label}</span>
        {sub && <span className="forum-admin-stat__sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function ForumAdminSiteStats({ accessToken }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const res = await forumAdminFetch(accessToken, '/api/admin/site-stats');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '無法載入統計');
        setStats(null);
        return;
      }
      setStats(data);
    } catch {
      setError('無法載入統計');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="forum-admin-stats" aria-labelledby="forum-admin-stats-title">
      <div className="forum-admin-stats__head">
        <h2 id="forum-admin-stats-title" className="forum-admin-stats__title">網站總覽</h2>
        <button type="button" className="forum-admin-stats__refresh" onClick={load} disabled={loading}>
          {loading ? '更新中…' : '重新整理'}
        </button>
      </div>

      {error && (
        <p className="forum-admin-stats__error" role="alert">{error}</p>
      )}

      <div className="forum-admin-stats__grid">
        <StatCard
          icon={<HeaderUserPlusIcon size={18} />}
          label="註冊會員"
          value={stats?.members_total}
          sub={stats?.members_this_month != null ? `本月 +${formatStat(stats.members_this_month)}` : null}
          tone="accent"
        />
        <StatCard icon={<HeaderForumIcon size={18} />} label="問卷回覆" value={stats?.questionnaires_total} />
        <StatCard icon={<ForumMoonIcon size={18} />} label="論壇貼文" value={stats?.forum_posts_total} />
        <StatCard icon={<HeaderChatIcon size={18} />} label="論壇留言" value={stats?.forum_comments_total} />
        <StatCard icon={<ForumBookIcon size={18} />} label="故事作品" value={stats?.story_posts_total} />
        <StatCard icon={<HeaderShieldIcon size={18} />} label="Passport 會員" value={stats?.premium_members_total} tone="gold" />
        <StatCard
          icon={<ForumLockIcon size={18} />}
          label="待處理檢舉"
          value={stats?.pending_reports_total}
          sub={stats ? `貼文 ${formatStat(stats.pending_posts)} · 留言 ${formatStat(stats.pending_comments)}` : null}
          tone={stats?.pending_reports_total > 0 ? 'warn' : 'calm'}
        />
      </div>
    </section>
  );
}
