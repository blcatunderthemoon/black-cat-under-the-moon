/**
 * Admin panel: preview Pure/age-filtered questionnaire respondents,
 * then create individual Gmail drafts or send invite emails in batches.
 * Used on /admin/moonlight-interest and /moonlight-interest001 (forum admin only).
 */

import { useState } from 'react';
import { useAuth, getBrowserClient } from '../../lib/auth-context.js';
import { dashboardHeaders } from '../../lib/dashboard-fetch.js';
import { HeaderMailIcon } from '../UiIcons.js';

const IDENTITY_FILTER_OPTIONS = ['Pure', 'TB', 'TBG', 'Bi', 'No Label', '仲探索緊'];
const DRAFT_CHUNK = 20;
const SEND_CHUNK = 8;
const SENT_EMAILS_STORAGE_KEY = 'bcutm:moonlight-interest001:sent-emails';
const DEFAULT_TEST_EMAIL = 'lhuen2010@gmail.com';

function loadSentEmails() {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SENT_EMAILS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.map((e) => String(e).toLowerCase()) : []);
  } catch {
    return new Set();
  }
}

function saveSentEmails(set) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SENT_EMAILS_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * @param {{ variant?: 'card' | 'plain' }} [props]
 */
export default function MoonlightInviteEmailPanel({ variant = 'card' }) {
  const { session } = useAuth();
  const [filterIdentities, setFilterIdentities] = useState(['Pure']);
  const [filterAgeMin, setFilterAgeMin] = useState('23');
  const [filterAgeMax, setFilterAgeMax] = useState('34');
  const [candidates, setCandidates] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sentEmails, setSentEmails] = useState(() => loadSentEmails());
  const [previewBusy, setPreviewBusy] = useState(false);
  const [draftTo, setDraftTo] = useState(DEFAULT_TEST_EMAIL);
  const [draftName, setDraftName] = useState('測試');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const [draftErr, setDraftErr] = useState('');

  const visibleCandidates = (candidates || []).filter(
    (c) => !sentEmails.has(String(c.email || '').toLowerCase()),
  );
  const selectedCount = selectedIds.length;

  function markEmailsSent(emails) {
    const newly = emails
      .map((e) => String(e || '').toLowerCase().trim())
      .filter(Boolean);
    if (!newly.length) return;

    const next = new Set(sentEmails);
    for (const e of newly) next.add(e);
    setSentEmails(next);
    saveSentEmails(next);

    setSelectedIds((prev) => {
      const byId = new Map((candidates || []).map((c) => [c.id, c]));
      return prev.filter((id) => {
        const row = byId.get(id);
        if (!row) return false;
        return !next.has(String(row.email || '').toLowerCase());
      });
    });
  }

  async function adminDraftFetch(payload) {
    const client = getBrowserClient();
    let token = session?.access_token || '';
    if (client) {
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) {
        token = data.session.access_token;
      }
    }

    const headers = dashboardHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
    if (!headers.Authorization && !headers['x-dashboard-key']) {
      throw new Error('請先以管理員帳號登入（登入已過期請重新登入）。');
    }

    const resp = await fetch('/api/dashboard/moonlight-interest-draft', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 401 || /Authentication required|Invalid or expired/i.test(data.error || '')) {
        throw new Error('登入已過期或無效，請重新登入管理員帳號後再試。');
      }
      if (resp.status === 403 || data.code === 'admin_required') {
        throw new Error(data.error || '需要論壇管理員權限。');
      }
      throw new Error([data.error, data.hint].filter(Boolean).join(' ') || '請求失敗');
    }
    return data;
  }

  async function handlePreviewCandidates(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    setPreviewBusy(true);
    try {
      const data = await adminDraftFetch({
        action: 'preview',
        identities: filterIdentities,
        age_min: filterAgeMin === '' ? null : Number(filterAgeMin),
        age_max: filterAgeMax === '' ? null : Number(filterAgeMax),
      });
      const list = (data.candidates || []).filter(
        (c) => !sentEmails.has(String(c.email || '').toLowerCase()),
      );
      setCandidates(list);
      setSelectedIds(list.map((c) => c.id));
      const hidden = (data.candidates || []).length - list.length;
      setDraftMsg(
        `搵到 ${list.length} 位可寄（已去重 email）`
        + `${hidden ? `，已隱藏 ${hidden} 位今次 session 已寄過` : ''}。`
        + '預設全選，可再剔走。',
      );
    } catch (err) {
      setCandidates(null);
      setSelectedIds([]);
      setDraftErr(err.message || '預覽失敗');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleCreateBatchDrafts(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    if (!selectedIds.length) {
      setDraftErr('請至少揀一位收件人。');
      return;
    }
    setDraftBusy(true);
    try {
      const chunk = selectedIds.slice(0, DRAFT_CHUNK);
      const data = await adminDraftFetch({
        action: 'create_batch',
        response_ids: chunk,
      });
      const doneIds = new Set((data.results || []).filter((r) => r.saved).map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !doneIds.has(id)));
      const remain = Math.max(0, selectedIds.length - chunk.length);
      setDraftMsg(
        (data.message || `已建立 ${doneIds.size} 封獨立草稿。`)
        + (remain > 0 ? ` 仲有 ${remain + (chunk.length - doneIds.size)} 人未處理，可再撳一次。` : ''),
      );
    } catch (err) {
      setDraftErr(err.message || '建立草稿失敗');
    } finally {
      setDraftBusy(false);
    }
  }

  async function handleSendBatch(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    if (!selectedIds.length) {
      setDraftErr('請至少揀一位收件人。');
      return;
    }
    const chunk = selectedIds.slice(0, SEND_CHUNK);
    const ok = window.confirm(
      `將真正發送 ${chunk.length} 封獨立邀請電郵（每封間隔約 2 秒）。\n`
      + `本批最多 ${SEND_CHUNK} 封，避免 server timeout。\n`
      + '大批一次 BCC 好易入 spam；分批獨立寄較穩。\n\n確定發送今批？',
    );
    if (!ok) return;

    setDraftBusy(true);
    try {
      const data = await adminDraftFetch({
        action: 'send_batch',
        response_ids: chunk,
      });
      const sentRows = (data.results || []).filter((r) => r.sent);
      const failedRows = (data.results || []).filter((r) => !r.sent);
      markEmailsSent(sentRows.map((r) => r.email));
      const remain = Math.max(0, selectedIds.length - sentRows.length);
      setDraftMsg(
        (data.message || `已發送 ${sentRows.length} 封。`)
        + (remain > 0 ? ` 仲剩約 ${remain} 人，建議隔 1–2 分鐘再撳下一批。` : ''),
      );
      if (failedRows.length) {
        setDraftErr(
          failedRows
            .map((r) => `${r.email || r.id}：${r.error || '發送失敗'}`)
            .join(' · '),
        );
      }
    } catch (err) {
      setDraftErr(
        (err.message || '發送失敗')
        + '（若剛寄過一批，可能係 Gmail 限速或請求 timeout；請隔幾分鐘再試，每批唔好超過 8 封。）',
      );
    } finally {
      setDraftBusy(false);
    }
  }

  async function handleCreateGmailDraft(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    setDraftBusy(true);
    try {
      const data = await adminDraftFetch({
        action: 'create_one',
        to: draftTo.trim() || undefined,
        recipient_name: draftName.trim() || undefined,
      });
      setDraftMsg(data.message || '已存入 Gmail 草稿（未發送）。');
    } catch (err) {
      setDraftErr(err.message || '建立草稿失敗');
    } finally {
      setDraftBusy(false);
    }
  }

  async function handleSendTestOne(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    const to = draftTo.trim().toLowerCase();
    if (!to) {
      setDraftErr('請填測試電郵（例如 lhuen2010@gmail.com）。');
      return;
    }
    const ok = window.confirm(`將真正發送 1 封測試邀請電郵至：\n${to}\n\n確定發送？`);
    if (!ok) return;

    setDraftBusy(true);
    try {
      const data = await adminDraftFetch({
        action: 'send_one',
        to,
        recipient_name: draftName.trim() || undefined,
      });
      setDraftMsg(data.message || `已發送測試電郵至 ${to}。`);
    } catch (err) {
      setDraftErr(err.message || '測試發送失敗');
    } finally {
      setDraftBusy(false);
    }
  }
  function toggleCandidate(id) {
    setSelectedIds((prev) => toggleInList(prev, id));
  }

  function selectAllCandidates() {
    setSelectedIds(visibleCandidates.map((c) => c.id));
  }

  function clearCandidateSelection() {
    setSelectedIds([]);
  }

  const shellClass = variant === 'card'
    ? 'mi-card mi-admin-draft'
    : 'mi-admin-draft mi-admin-draft--plain';

  return (
    <section className={shellClass} aria-labelledby="mi-admin-draft-title">
      <h2 id="mi-admin-draft-title" className={variant === 'card' ? 'mi-card__title' : 'mi-admin-draft__title'}>
        <HeaderMailIcon size={15} />
        邀請電郵 · Draft / Send
      </h2>
      <p className="mi-hint">
        篩選問卷用戶（預設 Pure · 23–34），一人一封寄
        {' '}
        <strong>Moonlight Gathering #001 邀請</strong>
        （每批最多 {SEND_CHUNK} 封、間隔約 2 秒；寄完請隔 1–2 分鐘再下一批，避免 Gmail／timeout）。
      </p>

      <form className="mi-fields" onSubmit={handlePreviewCandidates}>
        <fieldset className="mi-fieldset">
          <legend className="mi-legend">Label（identity）</legend>
          <div className="mi-chip-grid">
            {IDENTITY_FILTER_OPTIONS.map((opt) => (
              <label
                key={opt}
                className={`mi-chip${filterIdentities.includes(opt) ? ' is-selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={filterIdentities.includes(opt)}
                  onChange={() => setFilterIdentities((prev) => toggleInList(prev, opt))}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mi-admin-age-row">
          <label className="mi-field">
            <span className="mi-field__label">年齡下限</span>
            <input
              className="pixel-input"
              type="number"
              min={18}
              max={60}
              value={filterAgeMin}
              onChange={(e) => setFilterAgeMin(e.target.value)}
              placeholder="例如 23"
            />
          </label>
          <label className="mi-field">
            <span className="mi-field__label">年齡上限</span>
            <input
              className="pixel-input"
              type="number"
              min={18}
              max={60}
              value={filterAgeMax}
              onChange={(e) => setFilterAgeMax(e.target.value)}
              placeholder="例如 34"
            />
          </label>
        </div>

        <button
          type="submit"
          className="pixel-btn pixel-btn--ghost mi-submit"
          disabled={previewBusy || draftBusy}
        >
          <span className="pixel-btn__zh">
            {previewBusy ? '篩選中…' : '預覽符合條件嘅人'}
          </span>
        </button>
      </form>

      {candidates && (
        <div className="mi-admin-candidates">
          <div className="mi-admin-candidates__toolbar">
            <span className="mi-admin-candidates__count">
              已選 {selectedCount} / {visibleCandidates.length}
              {sentEmails.size > 0 ? ` · 已寄 ${sentEmails.size}` : ''}
            </span>
            <div className="mi-admin-candidates__actions">
              <button type="button" className="mi-link-btn" onClick={selectAllCandidates}>
                全選
              </button>
              <button type="button" className="mi-link-btn" onClick={clearCandidateSelection}>
                清空
              </button>
            </div>
          </div>
          <ul className="mi-admin-candidates__list">
            {visibleCandidates.map((c) => (
              <li key={c.id}>
                <label className={`mi-choice${selectedIds.includes(c.id) ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleCandidate(c.id)}
                  />
                  <span className="mi-admin-candidates__meta">
                    <span className="mi-admin-candidates__name">{c.name || '（無稱呼）'}</span>
                    <span className="mi-admin-candidates__sub">
                      {c.identity || '—'} · {c.age != null ? `${c.age} 歲` : '年齡不明'} · {c.email}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {visibleCandidates.length === 0 && (
            <p className="mi-hint">
              {(candidates || []).length === 0
                ? '呢組條件冇人（或冇有效 email）。'
                : '呢批人已全部寄過；重新預覽亦唔會再出現。'}
            </p>
          )}
          <div className="mi-admin-batch-actions">
            <button
              type="button"
              className="pixel-btn pixel-btn--ghost mi-submit"
              disabled={draftBusy || previewBusy || !selectedCount}
              onClick={handleCreateBatchDrafts}
            >
              <span className="pixel-btn__zh">
                {draftBusy
                  ? '處理中…'
                  : `建立獨立草稿（本批最多 ${DRAFT_CHUNK}）`}
              </span>
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn--primary mi-submit"
              disabled={draftBusy || previewBusy || !selectedCount}
              onClick={handleSendBatch}
            >
              <span className="pixel-btn__zh">
                {draftBusy
                  ? '發送中…'
                  : `分批發送（本批最多 ${SEND_CHUNK}・約 2 秒／封）`}
              </span>
            </button>
          </div>
        </div>
      )}

      <details className="mi-admin-manual" open>
        <summary>手動／測試一封（建議先寄去自己）</summary>
        <form className="mi-fields" onSubmit={handleCreateGmailDraft}>
          <label className="mi-field">
            <span className="mi-field__label">
              收件人電郵 <span className="mi-field__opt">測試用</span>
            </span>
            <input
              className="pixel-input"
              type="email"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              placeholder="lhuen2010@gmail.com"
            />
          </label>
          <label className="mi-field">
            <span className="mi-field__label">
              稱呼（信內問候） <span className="mi-field__opt">選填</span>
            </span>
            <input
              className="pixel-input"
              type="text"
              maxLength={40}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="例如：阿貓"
            />
          </label>
          <div className="mi-admin-batch-actions">
            <button
              type="button"
              className="pixel-btn pixel-btn--primary mi-submit"
              disabled={draftBusy}
              onClick={handleSendTestOne}
            >
              <span className="pixel-btn__zh">
                {draftBusy ? '發送中…' : '立即測試發送（真寄）'}
              </span>
            </button>
            <button
              type="submit"
              className="pixel-btn pixel-btn--ghost mi-submit"
              disabled={draftBusy}
            >
              <span className="pixel-btn__zh">
                {draftBusy ? '建立中…' : '只存 Gmail 草稿（不發送）'}
              </span>
            </button>
          </div>
        </form>
      </details>

      {draftErr && <p className="pixel-error mi-error">{draftErr}</p>}
      {draftMsg && <p className="mi-draft-ok">{draftMsg}</p>}
    </section>
  );
}
