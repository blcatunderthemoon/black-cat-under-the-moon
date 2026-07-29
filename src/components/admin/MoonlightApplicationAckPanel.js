/**
 * Admin panel: draft / send "application received" emails
 * to moonlight_interest participation-form applicants.
 */

import { useState } from 'react';
import { useAuth, getBrowserClient } from '../../lib/auth-context.js';
import { dashboardHeaders } from '../../lib/dashboard-fetch.js';
import { HeaderMailIcon } from '../UiIcons.js';

const DRAFT_CHUNK = 20;
const SEND_CHUNK = 8;
const SENT_EMAILS_STORAGE_KEY = 'bcutm:moonlight-interest001:ack-sent-emails';
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

export default function MoonlightApplicationAckPanel({ variant = 'card' }) {
  const { session } = useAuth();
  const [candidates, setCandidates] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sentEmails, setSentEmails] = useState(() => loadSentEmails());
  const [previewBusy, setPreviewBusy] = useState(false);
  const [draftTo, setDraftTo] = useState(DEFAULT_TEST_EMAIL);
  const [draftName, setDraftName] = useState('測試');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const [draftErr, setDraftErr] = useState('');
  const [skippedConduct, setSkippedConduct] = useState(0);

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

  async function adminAckFetch(payload) {
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

    const resp = await fetch('/api/dashboard/moonlight-interest-ack', {
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

  async function handlePreview(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    setPreviewBusy(true);
    try {
      const data = await adminAckFetch({ action: 'preview' });
      setSkippedConduct(Number(data.skipped_conduct_count) || 0);
      const list = (data.candidates || []).filter(
        (c) => !sentEmails.has(String(c.email || '').toLowerCase()),
      );
      setCandidates(list);
      setSelectedIds(list.slice(0, SEND_CHUNK).map((c) => c.id));
      const hidden = (data.candidates || []).length - list.length;
      setDraftMsg(
        `搵到 ${list.length} 位可寄申請人`
        + `${hidden ? `，已隱藏 ${hidden} 位今次 session 已寄過` : ''}`
        + `${data.skipped_conduct_count ? `，略過 ${data.skipped_conduct_count} 位 conduct_score=0` : ''}。`
        + ` 預設已選最頂 ${Math.min(SEND_CHUNK, list.length)} 位。`,
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
      setDraftErr('請至少揀一位申請人。');
      return;
    }
    setDraftBusy(true);
    try {
      const chunk = selectedIds.slice(0, DRAFT_CHUNK);
      const data = await adminAckFetch({
        action: 'create_batch',
        application_ids: chunk,
      });
      const doneIds = new Set((data.results || []).filter((r) => r.saved).map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !doneIds.has(id)));
      setDraftMsg(data.message || `已建立 ${doneIds.size} 封草稿。`);
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
      setDraftErr('請至少揀一位申請人。');
      return;
    }
    const chunk = selectedIds.slice(0, SEND_CHUNK);
    const ok = window.confirm(
      `將真正發送 ${chunk.length} 封「已收到申請」電郵（每封間隔約 2 秒）。\n\n確定發送今批？`,
    );
    if (!ok) return;

    setDraftBusy(true);
    try {
      const data = await adminAckFetch({
        action: 'send_batch',
        application_ids: chunk,
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
      setDraftErr(err.message || '發送失敗');
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
      const data = await adminAckFetch({
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
      setDraftErr('請填測試電郵。');
      return;
    }
    const ok = window.confirm(`將真正發送 1 封「已收到申請」測試電郵至：\n${to}\n\n確定發送？`);
    if (!ok) return;

    setDraftBusy(true);
    try {
      const data = await adminAckFetch({
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

  function selectNextBatch() {
    setSelectedIds(visibleCandidates.slice(0, SEND_CHUNK).map((c) => c.id));
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
    <section className={shellClass} aria-labelledby="mi-admin-ack-title">
      <h2 id="mi-admin-ack-title" className={variant === 'card' ? 'mi-card__title' : 'mi-admin-draft__title'}>
        <HeaderMailIcon size={15} />
        Thank you 確認信 · Draft / Send
      </h2>
      <p className="mi-hint">
        寄俾已填
        {' '}
        <strong>參加表</strong>
        {' '}
        嘅人（感謝／已收到申請）：達一定人數會邀請入 TG group；名額先到先得。
        每批最多 {SEND_CHUNK} 封；
        {' '}
        <strong>conduct_score = 0</strong>
        {' '}
        會自動略過。
      </p>

      <form className="mi-fields" onSubmit={handlePreview}>
        <button
          type="submit"
          className="pixel-btn pixel-btn--ghost mi-submit"
          disabled={previewBusy || draftBusy}
        >
          <span className="pixel-btn__zh">
            {previewBusy ? '載入中…' : '載入參加表申請人'}
          </span>
        </button>
      </form>

      {candidates && (
        <div className="mi-admin-candidates">
          <div className="mi-admin-candidates__toolbar">
            <span className="mi-admin-candidates__count">
              已選 {selectedCount} / {visibleCandidates.length}
              {sentEmails.size > 0 ? ` · 已寄 ${sentEmails.size}` : ''}
              {skippedConduct > 0 ? ` · 略過 conduct0 ${skippedConduct}` : ''}
            </span>
            <div className="mi-admin-candidates__actions">
              <button type="button" className="mi-link-btn" onClick={selectNextBatch}>
                選 {SEND_CHUNK} 封
              </button>
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
                      {c.telegram ? `@${c.telegram}` : '無 TG'}
                      {' · '}
                      {c.email}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {visibleCandidates.length === 0 && (
            <p className="mi-hint">
              {(candidates || []).length === 0
                ? '暫時冇可寄嘅參加表申請（或全部已略過）。'
                : '呢批人已全部寄過確認信；重新載入亦唔會再出現。'}
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
