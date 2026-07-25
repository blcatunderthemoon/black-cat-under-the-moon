/**
 * Host approval queue for a gathering.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth-context.js';
import LoadingText from '../LoadingText.js';
import { ForumPawIcon } from '../UiIcons.js';
import { maskEmail, maskPhone } from '../../lib/gathering-contact.js';

export default function GatheringHostQueue({ gatheringId, knockQuestion, onChanged }) {
  const { session } = useAuth();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [revealed, setRevealed] = useState({});

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/attendees?status=pending`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '無法載入申請');
        setAttendees([]);
        return;
      }
      setAttendees(data.attendees || []);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [gatheringId, session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(userId, action, extraBody) {
    if (!session?.access_token) return;
    setBusyId(userId);
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/attendees/${userId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: extraBody ? JSON.stringify(extraBody) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '操作失敗');
        return;
      }
      await load();
      if (typeof onChanged === 'function') onChanged(data);
    } catch {
      setError('網絡錯誤');
    } finally {
      setBusyId(null);
    }
  }

  async function blockApplicant(userId, name) {
    if (typeof window !== 'undefined'
      && !window.confirm(`確定要婉拒並封鎖 ${name || '此申請人'}？對方將無法再申請你的聚會。`)) {
      return;
    }
    await decide(userId, 'reject', { block: true });
  }

  function toggleReveal(userId) {
    setRevealed((prev) => ({ ...prev, [userId]: !prev[userId] }));
  }

  if (loading) return <LoadingText className="gathering-host-queue__muted" />;
  if (error) return <p className="gathering-host-queue__error">{error}</p>;
  if (!attendees.length) {
    return <p className="gathering-host-queue__muted">暫時冇待審核申請。</p>;
  }

  return (
    <ul className="gathering-host-queue">
      {attendees.map((a) => (
        <li key={a.id} className="gathering-host-queue__item">
          <div>
            <p className="gathering-host-queue__name">{a.display_name}</p>
            {(a.contact_email || a.contact_phone) && (
              <p className="gathering-host-queue__contact">
                {a.contact_email && (
                  <span>{revealed[a.user_id] ? a.contact_email : maskEmail(a.contact_email)}</span>
                )}
                {a.contact_email && a.contact_phone && <span aria-hidden="true"> · </span>}
                {a.contact_phone && (
                  <span>{revealed[a.user_id] ? a.contact_phone : maskPhone(a.contact_phone)}</span>
                )}
                <button
                  type="button"
                  className="gathering-host-queue__reveal"
                  onClick={() => toggleReveal(a.user_id)}
                >
                  {revealed[a.user_id] ? '隱藏' : '顯示'}
                </button>
              </p>
            )}
            {a.knock_message && (
              <blockquote className="gathering-host-queue__answer">
                {knockQuestion && <p className="gathering-host-queue__q">{knockQuestion}</p>}
                <p className="gathering-host-queue__knock">
                  <span className="gathering-host-queue__paw" aria-hidden="true">
                    <ForumPawIcon size={16} />
                  </span>
                  <span className="gathering-host-queue__knock-text">
                    <b>{a.display_name}</b> 嘅敲門暗號：「{a.knock_message}」
                  </span>
                </p>
              </blockquote>
            )}
          </div>
          <div className="gathering-host-queue__actions">
            <button
              type="button"
              className="gathering-host-queue__btn gathering-host-queue__btn--approve"
              disabled={busyId === a.user_id}
              onClick={() => decide(a.user_id, 'approve')}
            >
              批准
            </button>
            <button
              type="button"
              className="gathering-host-queue__btn gathering-host-queue__btn--reject"
              disabled={busyId === a.user_id}
              onClick={() => decide(a.user_id, 'reject')}
            >
              婉拒
            </button>
            <button
              type="button"
              className="gathering-host-queue__btn gathering-host-queue__btn--block"
              disabled={busyId === a.user_id}
              onClick={() => blockApplicant(a.user_id, a.display_name)}
              title="婉拒並封鎖此人"
            >
              封鎖
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
