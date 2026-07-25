/**
 * Shared forum team management panel (dashboard + website admin).
 */

import { useCallback, useEffect, useState } from 'react';
import { MODERATOR_ASSIGNABLE_TOPICS, formatModeratorTopicsLabel } from '../../lib/forum-moderator-assignments.js';
import LoadingText from '../LoadingText.js';
import { ForumTopicIcon } from '../ForumIcons.js';

const ROLE_LABELS = {
  member: '一般會員',
  moderator: '月光守護者（版主）',
  admin: '管理員',
};

function TopicScopeEditor({ user, disabled, onSave, busy }) {
  const isAdmin = user.forum_role === 'admin';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(user.moderator_topics || ['全部']);

  useEffect(() => {
    setDraft(user.moderator_topics?.length ? user.moderator_topics : ['全部']);
  }, [user.id, user.moderator_topics]);

  if (isAdmin) {
    return <span className="forum-admin-team__scope-label">全部版塊</span>;
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
    <div className="forum-admin-team__scope">
      <span className="forum-admin-team__scope-label">
        {formatModeratorTopicsLabel(user.moderator_topics, { emptyLabel: '全部版塊' })}
      </span>
      {!open ? (
        <button
          type="button"
          className="forum-admin-team__scope-btn"
          disabled={disabled || busy}
          onClick={() => setOpen(true)}
        >
          編輯版塊
        </button>
      ) : (
        <div className="forum-admin-team__topic-picker">
          <p className="forum-admin-team__topic-hint">選擇此版主負責的版塊（可多選；「全部」= 所有版塊）</p>
          <div className="forum-admin-team__topic-grid">
            {MODERATOR_ASSIGNABLE_TOPICS.map((topic) => {
              const checked = draft.includes(topic);
              return (
                <label key={topic} className={`forum-admin-team__topic-option${checked ? ' forum-admin-team__topic-option--on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTopic(topic)}
                    className="forum-admin-team__topic-check"
                  />
                  <ForumTopicIcon topic={topic} size={12} /> {topic}
                </label>
              );
            })}
          </div>
          <div className="forum-admin-team__topic-actions">
            <button type="button" className="forum-admin-team__scope-btn forum-admin-team__scope-btn--primary" disabled={busy} onClick={save}>
              儲存版塊
            </button>
            <button
              type="button"
              className="forum-admin-team__scope-btn"
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

export default function ForumTeamPanel({ apiFetch, onUnauthorized }) {
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
      const res = await apiFetch('/api/dashboard/forum-moderators?staff=1');
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          onUnauthorized();
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
  }, [apiFetch, onUnauthorized]);

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
    apiFetch(`/api/dashboard/users?q=${encodeURIComponent(searchQ)}&limit=20`)
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
      const res = await apiFetch('/api/dashboard/forum-moderators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          onUnauthorized();
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
        className="forum-admin-team__select"
        aria-label={`設定 ${user.display_name || user.email} 的論壇角色`}
      >
        <option value="member">一般會員</option>
        <option value="moderator">月光守護者（版主）</option>
        <option value="admin">管理員</option>
      </select>
    );
  }

  return (
    <div className="forum-admin-team">
      <p className="forum-admin-team__hint">
          指派 <strong>月光守護者</strong>（版主）或 <strong>管理員</strong>。
          版主可指定負責 <strong>全部版塊</strong> 或個別分類（如感情、社群）；
          管理員自動擁有全部版塊權限。變更會寫入審計日誌。
        </p>

        {msg && (
          <p className={`forum-admin-team__msg${msgOk ? ' forum-admin-team__msg--ok' : ' forum-admin-team__msg--err'}`} role="status">{msg}</p>
        )}

        <section className="forum-admin-team__section">
          <h2 className="forum-admin-team__section-title">現任團隊 ({staff.length})</h2>
          {loading ? (
            <LoadingText className="forum-admin-team__muted" />
          ) : staff.length === 0 ? (
            <p className="forum-admin-team__muted">尚未指派版主。請在下方搜尋用戶並指派角色。</p>
          ) : (
            <div className="forum-admin-team__table-wrap">
              <table className="forum-admin-team__table">
                <thead>
                  <tr>
                    <th>顯示名稱</th>
                    <th>Email</th>
                    <th>角色</th>
                    <th>負責版塊</th>
                    <th>狀態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((user) => (
                    <tr key={user.id}>
                      <td data-label="顯示名稱">{user.display_name || '—'}</td>
                      <td data-label="Email" className="forum-admin-team__email">{user.email || user.id.slice(0, 8)}</td>
                      <td data-label="角色">{ROLE_LABELS[user.forum_role] || user.forum_role}</td>
                      <td data-label="負責版塊">
                        <TopicScopeEditor
                          user={user}
                          disabled={busyId === user.id}
                          busy={busyId === user.id}
                          onSave={saveTopics}
                        />
                      </td>
                      <td data-label="狀態">{user.status || 'active'}</td>
                      <td data-label="操作">
                        <RoleSelect user={user} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="forum-admin-team__section">
          <h2 className="forum-admin-team__section-title">搜尋用戶並指派</h2>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="輸入 email 或顯示名稱（至少 2 字）…"
            className="forum-admin-team__input"
          />
          {searchLoading && <p className="forum-admin-team__muted">搜尋中…</p>}
          {!searchLoading && searchQ.length >= 2 && searchResults.length === 0 && (
            <p className="forum-admin-team__muted">找不到符合的用戶。</p>
          )}
          {searchResults.length > 0 && (
            <div className="forum-admin-team__table-wrap">
              <table className="forum-admin-team__table forum-admin-team__table--search">
                <thead>
                  <tr>
                    <th>顯示名稱</th>
                    <th>Email</th>
                    <th>目前角色</th>
                    <th>指派</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((user) => (
                    <tr key={user.id}>
                      <td data-label="顯示名稱">{user.display_name || '—'}</td>
                      <td data-label="Email" className="forum-admin-team__email">{user.email || '—'}</td>
                      <td data-label="目前角色">{ROLE_LABELS[user.forum_role || 'member']}</td>
                      <td data-label="指派">
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
  );
}
