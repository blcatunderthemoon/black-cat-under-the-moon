/**
 * /dashboard/forum/team — assign forum_role (月光守護者 / 管理員)
 */

import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/dashboard/Layout';
import ForumDashboardNav from '../../../components/dashboard/ForumDashboardNav';
import { dashFetch, handleDashboardUnauthorized } from '../../../lib/dashboard-fetch.js';

const ROLE_LABELS = {
  member: '一般會員',
  moderator: '🛡️ 月光守護者（版主）',
  admin: '🛡️ 管理員',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ForumTeamPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQ(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await dashFetch('/api/dashboard/forum-moderators?staff=1');
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          handleDashboardUnauthorized();
          return;
        }
        setMsgOk(false);
        setMsg(data.error || '載入失敗');
        setStaff([]);
        return;
      }
      setStaff(data.staff || []);
    } catch {
      setMsgOk(false);
      setMsg('網路錯誤，請重試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (!searchQ || searchQ.length < 2) {
      setSearchResults([]);
      return undefined;
    }

    let cancelled = false;
    setSearchLoading(true);
    dashFetch(`/api/dashboard/users?q=${encodeURIComponent(searchQ)}&limit=20`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setSearchResults([]);
          return;
        }
        setSearchResults(data.users || []);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => { cancelled = true; };
  }, [searchQ]);

  async function setRole(userId, forumRole, displayName) {
    const label = ROLE_LABELS[forumRole] || forumRole;
    if (forumRole === 'member' && !window.confirm(`確定撤銷「${displayName || userId}」的版主權限？`)) {
      return;
    }
    setBusyId(userId);
    setMsg('');
    try {
      const res = await dashFetch('/api/dashboard/forum-moderators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, forum_role: forumRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          handleDashboardUnauthorized();
          return;
        }
        setMsgOk(false);
        setMsg(data.error || '更新失敗');
        return;
      }
      setMsgOk(true);
      setMsg(`✓ 已將 ${displayName || '用戶'} 設為 ${label}`);
      await loadStaff();
      if (searchQ) {
        setSearchResults((prev) => prev.map((u) => (
          u.id === userId ? { ...u, forum_role: forumRole } : u
        )));
      }
    } catch {
      setMsgOk(false);
      setMsg('網路錯誤，請重試');
    } finally {
      setBusyId(null);
    }
  }

  function RoleSelect({ user }) {
    const current = user.forum_role || 'member';
    return (
      <select
        value={current}
        disabled={busyId === user.id}
        onChange={(e) => setRole(user.id, e.target.value, user.display_name)}
        style={s.select}
        aria-label={`設定 ${user.display_name || user.email} 的論壇角色`}
      >
        <option value="member">一般會員</option>
        <option value="moderator">月光守護者（版主）</option>
        <option value="admin">管理員</option>
      </select>
    );
  }

  return (
    <Layout pageTitle="版主團隊" breadcrumb="儀表板 / 月光圍爐 / 版主團隊">
      <div style={s.page}>
        <ForumDashboardNav />

        <p style={s.hint}>
          指派 <strong>月光守護者</strong>（版主）或 <strong>管理員</strong>。版主可於前台使用守護者工具列；管理員另可硬刪內容。
          變更會寫入審計日誌。
        </p>

        {msg && (
          <p style={{ ...s.msg, color: msgOk ? '#4ade80' : '#ff6b9d' }} role="status">{msg}</p>
        )}

        <section style={s.section}>
          <h2 style={s.sectionTitle}>現任團隊 ({staff.length})</h2>
          {loading ? (
            <p style={s.muted}>載入中…</p>
          ) : staff.length === 0 ? (
            <p style={s.muted}>尚未指派版主。請在下方搜尋用戶並指派角色。</p>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>顯示名稱</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>角色</th>
                    <th style={s.th}>狀態</th>
                    <th style={s.th}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((user) => (
                    <tr key={user.id}>
                      <td style={s.td}>{user.display_name || '—'}</td>
                      <td style={s.td}>{user.email || user.id.slice(0, 8)}</td>
                      <td style={s.td}>{ROLE_LABELS[user.forum_role] || user.forum_role}</td>
                      <td style={s.td}>{user.status || 'active'}</td>
                      <td style={s.td}>
                        <RoleSelect user={user} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>搜尋用戶並指派</h2>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="輸入 email 或顯示名稱（至少 2 字）…"
            style={s.input}
          />
          {searchLoading && <p style={s.muted}>搜尋中…</p>}
          {!searchLoading && searchQ.length >= 2 && searchResults.length === 0 && (
            <p style={s.muted}>找不到符合的用戶。</p>
          )}
          {searchResults.length > 0 && (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>顯示名稱</th>
                    <th style={s.th}>Email</th>
                    <th style={s.th}>目前角色</th>
                    <th style={s.th}>指派</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((user) => (
                    <tr key={user.id}>
                      <td style={s.td}>{user.display_name || '—'}</td>
                      <td style={s.td}>{user.email || '—'}</td>
                      <td style={s.td}>{ROLE_LABELS[user.forum_role || 'member']}</td>
                      <td style={s.td}>
                        <RoleSelect user={{ ...user, forum_role: user.forum_role || 'member' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

const s = {
  page: { color: '#e8e3f5', fontFamily: 'Noto Sans TC, sans-serif' },
  hint: { margin: '0 0 16px', fontSize: 13, color: '#9490b0', lineHeight: 1.6 },
  msg: { margin: '0 0 16px', fontSize: 14 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 16, margin: '0 0 12px', color: '#bd93f9' },
  muted: { color: '#6e6a88', fontSize: 14 },
  input: {
    width: '100%',
    maxWidth: 420,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #2a2850',
    background: '#0b0d22',
    color: '#e8e3f5',
    fontSize: 14,
    marginBottom: 12,
    boxSizing: 'border-box',
  },
  select: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #2a2850',
    background: '#050914',
    color: '#e8e3f5',
    fontSize: 13,
    minWidth: 160,
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '1px solid #2a2850',
    color: '#9490b0',
    fontWeight: 600,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #1a1830',
    verticalAlign: 'middle',
  },
};
