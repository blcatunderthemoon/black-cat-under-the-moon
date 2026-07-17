/**
 * /gatherings/[id] — gathering detail + RSVP + host queue
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import GatheringShell from '../../components/gatherings/GatheringShell.js';
import GatheringSafetyNotice from '../../components/gatherings/GatheringSafetyNotice.js';
import GatheringHostQueue from '../../components/gatherings/GatheringHostQueue.js';
import GatheringCommentBoard from '../../components/gatherings/GatheringCommentBoard.js';
import GatheringConfirmOverlay from '../../components/gatherings/GatheringConfirmOverlay.js';
import MoonLoading from '../../components/MoonLoading.js';
import { useAuth } from '../../lib/auth-context.js';

const STATUS_LABEL = {
  open: '招募中',
  full: '已滿額',
  completed: '已結束',
  cancelled: '已取消',
  pending: '審核中',
  approved: '已獲邀',
  rejected: '未獲邀',
  withdrawn: '已撤回',
};

export default function GatheringDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { session, loading: authLoading } = useAuth();
  const [gathering, setGathering] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [knock, setKnock] = useState('');
  const [email, setEmail] = useState(() => session?.user?.email || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmKind, setConfirmKind] = useState(null); // 'withdraw' | 'cancel' | null
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
  }, [session?.user?.email, email]);

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/gatherings/${id}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '載入失敗');
        setGathering(null);
        return;
      }
      setGathering(data.gathering);
      setIsHost(!!data.is_host);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [id, session?.access_token]);

  useEffect(() => {
    if (!router.isReady || authLoading) return;
    load();
  }, [router.isReady, authLoading, load]);

  async function apply() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/gatherings/${id}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          knock_message: knock || null,
          email,
          phone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '申請失敗');
        return;
      }
      setMsg(data.attendance?.status === 'approved' ? '已直接獲邀！' : '申請已送出，等候主辦人審核。');
      await load();
    } catch {
      setMsg('網絡錯誤');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!session?.access_token) return;
    setConfirmKind('withdraw');
  }

  async function runWithdraw() {
    if (!session?.access_token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gatherings/${id}/withdraw`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '撤回失敗');
        return;
      }
      setMsg('已撤回。');
      setConfirmKind(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelGathering() {
    if (!session?.access_token) return;
    setCancelReason('');
    setConfirmKind('cancel');
  }

  async function runCancelGathering() {
    if (!session?.access_token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gatherings/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason: cancelReason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '取消失敗');
        return;
      }
      setMsg('聚會已取消。');
      setConfirmKind(null);
      setCancelReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reportGathering() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    if (typeof window !== 'undefined'
      && !window.confirm('確定舉報呢個聚會？守護者會收到通知。')) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`/api/gatherings/${id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ target_type: 'gathering', target_id: gathering.id }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok
        ? (data.already_reported ? '你已舉報過呢個聚會。' : '已收到你的舉報，多謝你守護社群。')
        : (data.error || '舉報失敗'));
    } catch {
      setMsg('網絡錯誤');
    } finally {
      setBusy(false);
    }
  }

  async function blockHost() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    const hostId = gathering?.host_id || gathering?.host?.id;
    if (!hostId) return;
    if (typeof window !== 'undefined'
      && !window.confirm('封鎖主辦後，你將無法再申請對方的聚會，雙方亦不會互相收到訊息。確定？')) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/inbox/actions?action=block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'block', blocked_id: hostId }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? '已封鎖主辦。' : (data.error || '封鎖失敗'));
    } catch {
      setMsg('網絡錯誤');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title={gathering?.title || '聚會詳情'}
        description={gathering?.description || '月光聚會詳情'}
        path={id ? `/gatherings/${id}` : '/gatherings'}
      />
      <GatheringShell
        title="聚會詳情"
        maxWidth="720px"
        redirectPath={id ? `/gatherings/${id}` : '/gatherings'}
      >
        {loading ? (
          <MoonLoading variant="hero" />
        ) : error || !gathering ? (
          <p className="gatherings-empty gatherings-empty--err">{error || '找不到聚會'}</p>
        ) : (
          <article className="gathering-detail gathering-detail--simple">
            <Link href="/gatherings" className="gathering-detail__back">
              ← 返回月曆
            </Link>

            <div className="gathering-detail__sheet">
              <header className="gathering-detail__hero">
                <div className="gathering-detail__badges">
                  <span className={`gathering-detail__badge gathering-detail__badge--${gathering.is_online ? 'online' : 'offline'}`}>
                    {gathering.is_online ? '線上' : '線下'}
                  </span>
                  <span className={`gathering-detail__badge gathering-detail__badge--status-${gathering.status}`}>
                    {STATUS_LABEL[gathering.status] || gathering.status}
                  </span>
                </div>
                <h1 className="gathering-detail__title">{gathering.title}</h1>
              </header>

              <dl className="gathering-detail__facts">
                <div className="gathering-detail__fact">
                  <dt>時間</dt>
                  <dd>{gathering.starts_at_hk}</dd>
                </div>
                <div className="gathering-detail__fact">
                  <dt>地點</dt>
                  <dd>{gathering.location_public}</dd>
                </div>
                {gathering.host && (
                  <div className="gathering-detail__fact">
                    <dt>主辦</dt>
                    <dd>
                      {gathering.host.display_name}
                      {gathering.host.family_zh ? (
                        <span className="gathering-detail__host-family"> · {gathering.host.family_zh}</span>
                      ) : null}
                    </dd>
                  </div>
                )}
              </dl>

              {!!gathering.tag_labels?.length && (
                <div className="gathering-detail__tags" aria-label="標籤">
                  {gathering.tag_labels.map((label) => (
                    <span key={label} className="gathering-detail__tag">{label}</span>
                  ))}
                </div>
              )}

              {gathering.description && (
                <p className="gathering-detail__desc">{gathering.description}</p>
              )}

              <div
                className="gathering-detail__seats"
                aria-label={`人數 ${gathering.approved_count}/${gathering.max_participants}`}
              >
                <div className="gathering-detail__seats-head">
                  <span>人數</span>
                  <strong>{gathering.approved_count}/{gathering.max_participants}</strong>
                </div>
                <div
                  className="gathering-detail__seats-cells"
                  role="img"
                  aria-label={`已報名 ${gathering.approved_count} 人，共 ${gathering.max_participants} 個位`}
                >
                  {Array.from({ length: Math.max(0, Math.min(30, gathering.max_participants || 0)) }).map((_, i) => (
                    <span
                      key={i}
                      className={`gathering-detail__seat-cell${i < (gathering.approved_count || 0) ? ' is-filled' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {gathering.location_private != null && gathering.location_private !== '' ? (
                <div className={`gathering-detail__private gathering-detail__private--unlocked${!isHost && gathering.my_attendance?.status === 'approved' ? ' gathering-detail__private--pass' : ''}`}>
                  <span className="gathering-detail__private-badge">
                    {!isHost && gathering.my_attendance?.status === 'approved' ? '🔓 已解鎖 · 專屬通行證' : '🔒 僅獲批准者可見'}
                  </span>
                  <p className="gathering-detail__private-label">私密地點／連結</p>
                  <p className="gathering-detail__private-value">
                    <span className="gathering-detail__private-pin" aria-hidden="true">📍</span>
                    {gathering.location_private}
                  </p>
                </div>
              ) : gathering.has_private_location && !isHost ? (
                <div className="gathering-detail__private gathering-detail__private--locked" aria-label="私密地點未解鎖">
                  <p className="gathering-detail__private-label">
                    <span className="gathering-detail__private-lock" aria-hidden="true">🔒</span>
                    私密地點／連結
                  </p>
                  <div className="gathering-detail__private-locked-body">
                    <p className="gathering-detail__private-blur" aria-hidden="true">████ ██████ ███ ██</p>
                    <p className="gathering-detail__private-locked-note">🔒 詳細地址將於主辦人批准後解鎖 🐈‍⬛</p>
                  </div>
                </div>
              ) : null}
            </div>

            <GatheringSafetyNotice />

            {!isHost && session && (
              <div className="gathering-detail__safety-actions">
                <button
                  type="button"
                  className="gathering-detail__safety-btn"
                  disabled={busy}
                  onClick={reportGathering}
                >
                  舉報聚會
                </button>
                <button
                  type="button"
                  className="gathering-detail__safety-btn is-block"
                  disabled={busy}
                  onClick={blockHost}
                >
                  封鎖主辦
                </button>
              </div>
            )}

            {msg && !gathering.my_attendance?.status && (
              <p className="gathering-detail__msg" role="status">{msg}</p>
            )}

            {isHost ? (
              <section className="gathering-detail__host-panel">
                <h2>主辦人審批</h2>
                <GatheringHostQueue
                  gatheringId={gathering.id}
                  knockQuestion={gathering.knock_question}
                  onChanged={() => load()}
                />
                {gathering.status !== 'cancelled' && gathering.status !== 'completed' && (
                  <button type="button" className="gathering-detail__danger" disabled={busy} onClick={cancelGathering}>
                    取消聚會
                  </button>
                )}
              </section>
            ) : (
              <section className="gathering-detail__rsvp">
                {gathering.my_attendance?.status
                  && gathering.my_attendance.status !== 'withdrawn' ? (
                  <div className={`gathering-detail__attendance gathering-detail__attendance--${gathering.my_attendance.status}`}>
                    <header className="gathering-detail__attendance-head">
                      <p className="gathering-detail__attendance-kicker">你的狀態</p>
                      <p className={`gathering-detail__rsvp-chip gathering-detail__rsvp-chip--${gathering.my_attendance.status}`}>
                        {STATUS_LABEL[gathering.my_attendance.status] || gathering.my_attendance.status}
                      </p>
                    </header>
                    <div className="gathering-detail__attendance-copy-row">
                      <span
                        className={`gathering-detail__attendance-icon gathering-detail__attendance-icon--${gathering.my_attendance.status}`}
                        aria-hidden="true"
                      >
                        {gathering.my_attendance.status === 'pending' && '⏳'}
                        {gathering.my_attendance.status === 'approved' && '🐾'}
                        {gathering.my_attendance.status === 'rejected' && '🌙'}
                        {gathering.my_attendance.status === 'waitlist' && '⏳'}
                      </span>
                      <p className="gathering-detail__attendance-copy">
                        {gathering.my_attendance.status === 'pending' && '申請已送出！小黑貓正幫你將靈魂信件叼去俾主辦人，批准後會喺 Inbox 收到通知喔 🐈‍⬛✨'}
                        {gathering.my_attendance.status === 'approved' && '你已獲邀！私密地點／連結已喺上方解鎖，記得準時赴約 🐾'}
                        {gathering.my_attendance.status === 'rejected' && '今次未獲邀。唔緊要，仲有好多月光聚會等緊你 🌙'}
                        {gathering.my_attendance.status === 'waitlist' && '你而家喺候補名單，有位會第一時間通知你。'}
                      </p>
                    </div>
                    {gathering.my_attendance.knock_message && (
                      <div className="gathering-detail__attendance-knock">
                        <p className="gathering-detail__attendance-knock-label">你嘅敲門答案</p>
                        <p className="gathering-detail__attendance-knock-body">{gathering.my_attendance.knock_message}</p>
                      </div>
                    )}
                    {(gathering.my_attendance.status === 'pending' || gathering.my_attendance.status === 'approved') && (
                      <div className="gathering-detail__attendance-actions">
                        <button
                          type="button"
                          className={`gathering-detail__rsvp-ghost${gathering.my_attendance.status === 'approved' ? ' gathering-detail__rsvp-ghost--quiet' : ''}`}
                          disabled={busy}
                          onClick={withdraw}
                        >
                          {busy ? '處理中…' : (gathering.my_attendance.status === 'approved' ? '取消參與' : '撤回申請')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : gathering.status === 'open' && session ? (
                  <form
                    className="gathering-detail__apply"
                    onSubmit={(e) => {
                      e.preventDefault();
                      apply();
                    }}
                  >
                    <header className="gathering-detail__apply-head">
                      <h2 className="gathering-detail__rsvp-title">申請加入</h2>
                      <p className="gathering-detail__apply-lead">填聯絡同敲門答案，等主辦人批核。</p>
                    </header>

                    <div className="gathering-detail__apply-grid">
                      <label className="gathering-form__field">
                        <span>電郵 *</span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          maxLength={120}
                          required
                          autoComplete="email"
                          placeholder="you@example.com"
                        />
                      </label>
                      <label className="gathering-form__field">
                        <span>{gathering.is_online ? '電話（選填）' : '電話 *'}</span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          maxLength={20}
                          required={!gathering.is_online}
                          autoComplete="tel"
                          placeholder="例如：91234567"
                        />
                      </label>
                    </div>
                    <p className="gathering-form__hint">
                      {gathering.is_online
                        ? '🔒 電郵／電話只會喺主辦人批准後分享俾佢，僅用於聚會協調，唔會公開顯示；線上聚會電話可留空。'
                        : '🔒 電郵／電話只會喺主辦人批准後分享俾佢，僅用於聚會協調，唔會公開顯示。若你撤回或取消參與，聯絡資料亦會失效。'}
                    </p>

                    {gathering.require_knock_message && (
                      <label className="gathering-form__field gathering-detail__knock-field">
                        <span>敲門暗號 *</span>
                        {gathering.knock_question && (
                          <p className="gathering-detail__knock-q">{gathering.knock_question}</p>
                        )}
                        <textarea
                          value={knock}
                          onChange={(e) => setKnock(e.target.value)}
                          maxLength={200}
                          rows={3}
                          required
                          placeholder="簡短回答主辦的問題…"
                        />
                      </label>
                    )}

                    <div className="gathering-detail__apply-actions">
                      <button
                        type="submit"
                        className="gatherings-hero__cta gathering-detail__apply-cta"
                        disabled={busy || !email.trim() || (!gathering.is_online && !phone.trim())}
                      >
                        {busy ? '提交中…' : '申請加入'}
                      </button>
                    </div>
                  </form>
                ) : gathering.status === 'open' && !session ? (
                  <div className="gathering-detail__login-panel">
                    <p className="gathering-detail__login-lead">想參加呢場聚會？</p>
                    <p className="gathering-detail__login-hint">登入後先可以申請。</p>
                    <Link
                      href={`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`}
                      className="gatherings-hero__cta"
                    >
                      登入後申請
                    </Link>
                  </div>
                ) : (
                  <p className="gatherings-empty">此聚會目前無法報名。</p>
                )}
              </section>
            )}

            {(isHost || gathering.my_attendance?.status === 'approved') && (
              <GatheringCommentBoard gatheringId={gathering.id} />
            )}
          </article>
        )}

        <GatheringConfirmOverlay
          open={confirmKind === 'withdraw'}
          title={gathering?.my_attendance?.status === 'approved' ? '確定取消參與？' : '確定撤回申請？'}
          sub={gathering?.my_attendance?.status === 'approved'
            ? '確定要放棄呢個聚會名額嗎？小黑貓會好傷心喔 🐈‍⬛'
            : '退出後若聚會仍喺招募，可以重新申請。'}
          confirmLabel={gathering?.my_attendance?.status === 'approved' ? '取消參與' : '撤回申請'}
          cancelLabel="繼續留下"
          variant="danger"
          busy={busy}
          onConfirm={runWithdraw}
          onCancel={() => { if (!busy) setConfirmKind(null); }}
        />

        <GatheringConfirmOverlay
          open={confirmKind === 'cancel'}
          title="確定取消聚會？"
          sub="已獲邀／審核中嘅參加者會收到 Inbox 通知。"
          confirmLabel="取消聚會"
          cancelLabel="返回"
          variant="danger"
          busy={busy}
          showNote
          note={cancelReason}
          onNoteChange={setCancelReason}
          noteLabel="取消原因"
          notePlaceholder="可留空"
          onConfirm={runCancelGathering}
          onCancel={() => { if (!busy) { setConfirmKind(null); setCancelReason(''); } }}
        />
      </GatheringShell>
    </>
  );
}
