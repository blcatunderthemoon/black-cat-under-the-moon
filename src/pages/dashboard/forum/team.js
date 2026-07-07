/**
 * /dashboard/forum/team — assign forum_role + topic scope (月光守護者 / 管理員)
 */

import { useCallback, useEffect, useState } from 'react';
import Layout from '../../../components/dashboard/Layout';
import ForumDashboardNav from '../../../components/dashboard/ForumDashboardNav';
import { dashFetch, handleDashboardUnauthorized } from '../../../lib/dashboard-fetch.js';
import { MODERATOR_ASSIGNABLE_TOPICS, formatModeratorTopicsLabel } from '../../../lib/forum-moderator-assignments.js';
import { TOPIC_STYLES } from '../../../lib/forum-categories.js';

const ROLE_LABELS = {
  member: '一般會員',
  moderator: '🛡️ 月光守護者（版主）',
  admin: '🛡️ 管理員',
};

function topicChipLabel(topic) {
  const emoji = TOPIC_STYLES[topic]?.emoji;
  return emoji ? `${emoji} ${topic}` : topic;
}

function TopicScopeEditor({ user, disabled, onSave, busy }) {
  const isAdmin = user.forum_role === 'admin';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(user.moderator_topics || ['全部']);

  useEffect(() => {
    setDraft(user.moderator_topics?.length ? user.moderator_topics : ['全部']);
  }, [user.id, user.moderator_topics]);

  if (isAdmin) {
    return <span style={s.scopeLabel}>全部版塊</span>;
  }

  function toggleTopic(topic) {
    setDraft((prev) => {
      if (topic === '全部') return ['全部'];
      const withoutAll = prev.filter((t) => t !== '全部');
      if (withoutAll.includes(topic)) {
        const next = withoutAll.filter((t) => t !== topic);
        return next.length ? next : ['全部'];
      }
      return [...withoutAll, topic];
    });
  }

  async function save() {
    const ok = await onSave(user.id, draft, user.display_name);
    if (ok) setOpen(false);
  }

  return (
    <div style={s.scopeWrap}>
      <span style={s.scopeLabel}>
        {formatModeratorTopicsLabel(user.moderator_topics, { emptyLabel: '全部版塊' })}
      </span>
      {!open ? (
        <button
          type="button"
          style={s.scopeBtn}
          disabled={disabled || busy}
          onClick={() => setOpen(true)}
        >
          編輯版塊
        </button>
      ) : (
        <div style={s.topicPicker}>
          <p style={s.topicPickerHint}>選擇此版主負責的版塊（可多選；「全部」= 所有版塊）</p>
          <div style={s.topicGrid}>
            {MODERATOR_ASSIGNABLE_TOPICS.map((topic) => {
              const checked = draft.includes(topic);
              return (
                <label key={topic} style={{ ...s.topicOption, ...(checked ? s.topicOptionOn : {}) }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTopic(topic)}
                    style={s.topicCheck}
                  />
                  {topicChipLabel(topic)}
                </label>
              );
            })}
          </div>
          <div style={s.topicActions}>
            <button type="button" style={s.scopeBtnPrimary} disabled={busy} onClick={save}>
              儲存版塊
            </button>
            <button
              type="button"
              style={s.scopeBtn}
              disabled={busy}
              onClick={() => {
                setDraft(user.moderator_topics?.length ? user.moderator_topics : ['全部']);
                setOpen(false);
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

  async function patchModerator(body, displayName, successLabel) {
    setBusyId(body.user_id);
    setMsg('');
    try {
      const res = await dashFetch('/api/dashboard/forum-moderators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          handleDashboardUnauthorized();
          return false;
        }
        setMsgOk(false);
        setMsg(data.error || '更新失敗');
        return false;
      }
      setMsgOk(true);
      setMsg(`✓ 已更新 ${displayName || '用戶'}：${successLabel}`);
      await loadStaff();
      if (searchQ) {
        setSearchResults((prev) => prev.map((u) => (
          u.id === body.user_id
            ? {
              ...u,
              forum_role: data.forum_role ?? u.forum_role,
              moderator_topics: data.moderator_topics ?? u.moderator_topics,
            }
            : u
        )));
      }
      return true;
    } catch {
      setMsgOk(false);
      setMsg('網路錯誤，請重試');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function setRole(userId, forumRole, displayName) {
    const label = ROLE_LABELS[forumRole] || forumRole;
    if (forumRole === 'member' && !window.confirm(`確定撤銷「${displayName || userId}」的版主權限？`)) {
      return;
    }

    const body = { user_id: userId, forum_role: forumRole };
    if (forumRole === 'moderator') {
      body.moderator_topics = ['全部'];
    }

    await patchModerator(body, displayName, label);
  }

  async function saveTopics(userId, topics, displayName) {
    return patchModerator(
      { user_id: userId, moderator_topics: topics },
      displayName,
      `負責版塊：${formatModeratorTopicsLabel(topics)}`,
    );
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
          指派 <strong>月光守護者</strong>（版主）或 <strong>管理員</strong>。
          版主可指定負責 <strong>全部版塊</strong> 或個別分類（如感情、社群）；
          管理員自動擁有全部版塊權限。變更會寫入審計日誌。
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
                    <th style={s.th}>負責版塊</th>
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
                      <td style={s.td}>
                        <TopicScopeEditor
                          user={user}
                          disabled={busyId === user.id}
                          busy={busyId === user.id}
                          onSave={saveTopics}
                        />
                      </td>
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
    verticalAlign: 'top',
  },
  scopeWrap: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 },
  scopeLabel: { fontSize: 12, color: '#d4c5f9', lineHeight: 1.5 },
  scopeBtn: {
    alignSelf: 'flex-start',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #2a2850',
    background: 'transparent',
    color: '#bd93f9',
    fontSize: 12,
    cursor: 'pointer',
  },
  scopeBtnPrimary: {
    alignSelf: 'flex-start',
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #7c5cbf',
    background: '#2a1848',
    color: '#f0e8ff',
    fontSize: 12,
    cursor: 'pointer',
  },
  topicPicker: {
    padding: 10,
    borderRadius: 8,
    border: '1px solid #2a2850',
    background: '#0a0c1a',
  },
  topicPickerHint: { margin: '0 0 8px', fontSize: 11, color: '#9490b0', lineHeight: 1.5 },
  topicGrid: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  topicOption: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid #2a2850',
    fontSize: 11,
    color: '#c4b5fd',
    cursor: 'pointer',
  },
  topicOptionOn: {
    borderColor: '#7c5cbf',
    background: 'rgba(124, 92, 191, 0.2)',
    color: '#f0e8ff',
  },
  topicCheck: { margin: 0 },
  topicActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
};
