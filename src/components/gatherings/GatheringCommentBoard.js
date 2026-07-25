/**
 * Moonlight Gatherings — participant discussion board (圍爐房).
 * Host + approved attendees only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth-context.js';
import LoadingText from '../LoadingText.js';
import { ForumFlameIcon, ForumPawIcon } from '../UiIcons.js';
import GatheringConfirmOverlay from './GatheringConfirmOverlay.js';

const MAX_BODY = 500;

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function GatheringCommentBoard({ gatheringId }) {
  const { session, profile, displayName } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [reportedIds, setReportedIds] = useState({});
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/comments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '無法載入留言');
        setComments([]);
        return;
      }
      setComments(data.comments || []);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [gatheringId, session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || posting || !session?.access_token) return;
    setPosting(true);
    setError('');

    // Optimistic: show the comment instantly, then reconcile with the server.
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      user_id: session.user?.id,
      body,
      created_at: new Date().toISOString(),
      display_name: displayName || '你',
      avatar_style: profile?.avatar_style || null,
      mirror_type: null,
      is_mine: true,
      can_delete: true,
      pending: true,
    };
    setComments((prev) => [...prev, optimistic]);
    setDraft('');
    requestAnimationFrame(() => {
      listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });

    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Roll back the optimistic comment and restore the draft.
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setDraft(body);
        setError(data.crisis ? '如果你正經歷困擾，請搵人傾傾。' : (data.error || '留言失敗'));
        return;
      }
      if (data.comment) {
        setComments((prev) => prev.map((c) => (c.id === tempId ? data.comment : c)));
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setDraft(body);
      setError('網絡錯誤');
    } finally {
      setPosting(false);
    }
  }

  async function remove(commentId) {
    if (!session?.access_token) return;
    setBusyId(commentId);
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '刪除失敗');
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError('網絡錯誤');
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  function openReport(comment) {
    setReportReason('');
    setError('');
    setReportTarget(comment);
  }

  async function runReport() {
    const comment = reportTarget;
    if (!comment || !session?.access_token) return;
    setBusyId(comment.id);
    setError('');
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          target_type: 'comment',
          target_id: comment.id,
          reason: reportReason.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '舉報失敗');
        return;
      }
      setReportedIds((prev) => ({ ...prev, [comment.id]: true }));
      if (data.auto_hidden) {
        setComments((prev) => prev.filter((c) => c.id !== comment.id));
      }
      setReportTarget(null);
      setReportReason('');
    } catch {
      setError('網絡錯誤');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="gathering-board">
      <header className="gathering-board__head">
        <h2 className="gathering-board__title">
          <span className="gathering-board__title-icon" aria-hidden="true">
            <ForumPawIcon size={16} />
          </span>
          聚會圍爐房
        </h2>
        <p className="gathering-board__lead">
          對呢個活動有問題？想同其他參加者相認？喺下面留言傾吓。
        </p>
      </header>

      <div
        className={`gathering-board__list${loading || comments.length === 0 ? ' is-empty' : ' has-msgs'}`}
        ref={listRef}
      >
        {loading ? (
          <LoadingText className="gathering-board__muted" />
        ) : comments.length === 0 ? (
          <div className="gathering-board__empty">
            <span className="gathering-board__empty-icon" aria-hidden="true">
              <ForumFlameIcon size={20} />
            </span>
            <p className="gathering-board__empty-title">仲未有留言</p>
            <p className="gathering-board__empty-hint">做第一個開火爐嘅人啦</p>
          </div>
        ) : (
          comments.map((c) => (
            <article
              key={c.id}
              className={`gathering-board__msg${c.is_mine ? ' is-mine' : ''}${c.pending ? ' is-pending' : ''}`}
            >
              <div className="gathering-board__msg-top">
                <span className="gathering-board__msg-name">
                  {c.display_name}
                  {c.is_mine && <span className="gathering-board__you"> · 你</span>}
                </span>
                <time className="gathering-board__msg-time" dateTime={c.created_at}>
                  {formatTime(c.created_at)}
                </time>
              </div>
              <p className="gathering-board__msg-body">{c.body}</p>
              <div className="gathering-board__msg-actions">
              {c.can_delete && (
                confirmId === c.id ? (
                  <div className="gathering-board__confirm">
                    <span>確定刪除？</span>
                    <button
                      type="button"
                      className="gathering-board__confirm-yes"
                      disabled={busyId === c.id}
                      onClick={() => remove(c.id)}
                    >
                      刪除
                    </button>
                    <button
                      type="button"
                      className="gathering-board__confirm-no"
                      onClick={() => setConfirmId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="gathering-board__del"
                    onClick={() => setConfirmId(c.id)}
                  >
                    刪除
                  </button>
                )
              )}
              {!c.is_mine && (
                reportedIds[c.id] ? (
                  <span className="gathering-board__reported">已舉報</span>
                ) : (
                  <button
                    type="button"
                    className="gathering-board__report"
                    disabled={busyId === c.id}
                    onClick={() => openReport(c)}
                  >
                    舉報
                  </button>
                )
              )}
              </div>
            </article>
          ))
        )}
      </div>

      {error && <p className="gathering-board__error" role="alert">{error}</p>}

      <form className="gathering-board__compose" onSubmit={post}>
        <label className="gathering-board__compose-label" htmlFor={`gathering-board-draft-${gatheringId}`}>
          寫留言
        </label>
        <textarea
          id={`gathering-board-draft-${gatheringId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_BODY}
          rows={3}
          placeholder="例如：使唔使自備嘢？準時準到？"
          aria-label="留言內容"
        />
        <div className="gathering-board__compose-foot">
          <span className="gathering-board__count">{draft.length}/{MAX_BODY}</span>
          <button
            type="submit"
            className="gathering-board__send"
            disabled={posting || !draft.trim()}
          >
            {posting ? '傳送中…' : '留言'}
          </button>
        </div>
      </form>

      <GatheringConfirmOverlay
        open={!!reportTarget}
        title="舉報呢則留言？"
        sub="月光守護者會收到通知並跟進；達到門檻留言會自動隱藏。"
        confirmLabel="送出舉報"
        cancelLabel="返回"
        variant="danger"
        busy={busyId === reportTarget?.id}
        showNote
        note={reportReason}
        onNoteChange={setReportReason}
        noteLabel="舉報原因（選填）"
        notePlaceholder="簡述問題，例如：騷擾、不當內容…"
        onConfirm={runReport}
        onCancel={() => {
          if (busyId !== reportTarget?.id) { setReportTarget(null); setReportReason(''); }
        }}
      />
    </section>
  );
}
