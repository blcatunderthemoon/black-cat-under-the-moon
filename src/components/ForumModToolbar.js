import { useState } from 'react';
import Link from 'next/link';
import { displayTopic, TOPIC_STYLES, forumTopicLabel } from '../lib/forum-categories.js';
import { forumModFetch } from '../lib/forum-mod-api.js';
import ForumModConfirmOverlay from './ForumModConfirmOverlay.js';

/**
 * Post-level guardian toolbar (front-end moderators).
 */
export default function ForumModToolbar({
  post,
  accessToken,
  onUpdated,
  showQueueLink = true,
  className = '',
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [confirmHideOpen, setConfirmHideOpen] = useState(false);

  const topicCanonical = displayTopic(post.topic);
  const topicLabel = forumTopicLabel(post.topic);
  const topicEmoji = TOPIC_STYLES[topicCanonical]?.emoji || '';
  const isHidden = post.is_hidden || post.visibility === 'hidden';

  async function modAction(method, path, body, successText) {
    if (!accessToken || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const { ok, data } = await forumModFetch(path, {
        method,
        body,
        accessToken,
      });
      if (!ok) {
        setMsgOk(false);
        setMsg(data.error || '操作失敗');
        return false;
      }
      setMsgOk(true);
      setMsg(successText || '✓ 已更新');
      setShowNote(false);
      setNote('');
      await onUpdated?.();
      return true;
    } catch {
      setMsgOk(false);
      setMsg('操作失敗');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleHide() {
    setConfirmHideOpen(true);
  }

  async function confirmHide() {
    const ok = await modAction(
      'POST',
      `/api/forum/moderation/posts/${post.id}/hide`,
      { note: note.trim() || undefined },
      '🌑 已夜幕降臨',
    );
    if (ok) setConfirmHideOpen(false);
  }

  function handleUnhide() {
    modAction('POST', `/api/forum/moderation/posts/${post.id}/unhide`, undefined, '🌕 已恢復月光');
  }

  function handlePin() {
    const next = !post.is_pinned;
    modAction(
      'POST',
      `/api/forum/moderation/posts/${post.id}/pin`,
      { pinned: next },
      next ? '📌 已圍爐置頂' : '已取消置頂',
    );
  }

  function handleHighlight() {
    const next = !post.is_highlighted;
    modAction(
      'POST',
      `/api/forum/moderation/posts/${post.id}/highlight`,
      { highlighted: next },
      next ? '✨ 已月光加冕' : '已取消加冕',
    );
  }

  return (
    <>
      <ForumModConfirmOverlay
        open={confirmHideOpen}
        title="夜幕降臨"
        sub="此帖將從前台隱藏，資料仍保留。你之後可以恢復月光。"
        icon="🌑"
        confirmLabel="確認夜幕降臨"
        showNote
        note={note}
        onNoteChange={setNote}
        busy={busy}
        onConfirm={confirmHide}
        onCancel={() => setConfirmHideOpen(false)}
      />
    <div className={`forum-mod-toolbar${className ? ` ${className}` : ''}`}>
      <div className="forum-mod-toolbar__head">
        <p className="forum-mod-toolbar__title">🛡️ 守護者工具列</p>
        {showQueueLink && (
          <Link href="/forum/guardian" className="forum-mod-toolbar__queue-link">
            檢舉佇列
          </Link>
        )}
      </div>

      <div className="forum-mod-toolbar__meta">
        <span className="forum-mod-toolbar__topic">
          {topicEmoji ? `${topicEmoji} ` : ''}{topicLabel}
        </span>
        {isHidden && <span className="forum-mod-toolbar__badge">🌑 夜幕降臨</span>}
        {post.is_pinned && <span className="forum-mod-toolbar__badge">📌 置頂</span>}
        {post.is_highlighted && <span className="forum-mod-toolbar__badge forum-mod-toolbar__badge--crown">✨ 加冕</span>}
      </div>

      <div className="forum-mod-toolbar__actions">
        {isHidden ? (
          <button type="button" className="forum-mod-toolbar__btn forum-mod-toolbar__btn--success" disabled={busy} onClick={handleUnhide}>
            恢復月光
          </button>
        ) : (
          <button type="button" className="forum-mod-toolbar__btn" disabled={busy} onClick={handleHide}>
            夜幕降臨
          </button>
        )}
        <button type="button" className="forum-mod-toolbar__btn" disabled={busy} onClick={handlePin}>
          {post.is_pinned ? '取消置頂' : '圍爐置頂'}
        </button>
        <button type="button" className="forum-mod-toolbar__btn" disabled={busy} onClick={handleHighlight}>
          {post.is_highlighted ? '取消加冕' : '月光加冕'}
        </button>
        {!isHidden && (
          <button
            type="button"
            className="forum-mod-toolbar__btn forum-mod-toolbar__btn--ghost"
            disabled={busy}
            onClick={() => setShowNote((v) => !v)}
          >
            {showNote ? '收起備註' : '備註'}
          </button>
        )}
      </div>

      {showNote && !isHidden && (
        <textarea
          className="forum-mod-toolbar__note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="可選：記錄此次治理原因（僅版主可見）"
          maxLength={500}
          rows={2}
        />
      )}

      {msg && (
        <p className={`forum-mod-toolbar__msg${msgOk ? ' forum-mod-toolbar__msg--ok' : ' forum-mod-toolbar__msg--err'}`} role="status">
          {msg}
        </p>
      )}
    </div>
    </>
  );
}
