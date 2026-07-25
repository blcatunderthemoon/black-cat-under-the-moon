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
import {
  ForumClockIcon,
  ForumLockIcon,
  ForumMoonIcon,
  ForumPawIcon,
  ForumPinIcon,
  UiUnlockIcon,
} from '../../components/UiIcons.js';
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

function normalizeHkPhone(raw) {
  return String(raw || '').replace(/[\s()\-]/g, '').replace(/^\+?852/, '');
}

function isValidHkPhone(raw) {
  return /^\d{8}$/.test(normalizeHkPhone(raw));
}

export default function GatheringDetailPage({ seo = null }) {
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
  const [confirmKind, setConfirmKind] = useState(null); // 'withdraw' | 'cancel' | 'report' | 'block' | null
  const [cancelReason, setCancelReason] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [safetyMsg, setSafetyMsg] = useState('');

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

  function reportGathering() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    setReportReason('');
    setSafetyMsg('');
    setConfirmKind('report');
  }

  async function runReportGathering() {
    if (!session?.access_token || !gathering) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gatherings/${id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          target_type: 'gathering',
          target_id: gathering.id,
          reason: reportReason.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setConfirmKind(null);
      setReportReason('');
      setSafetyMsg(res.ok
        ? (data.already_reported ? '你已舉報過呢個聚會。' : '已收到你的舉報，多謝你守護社群。')
        : (data.error || '舉報失敗'));
    } catch {
      setSafetyMsg('網絡錯誤');
    } finally {
      setBusy(false);
    }
  }

  function blockHost() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    if (!(gathering?.host_id || gathering?.host?.id)) return;
    setSafetyMsg('');
    setConfirmKind('block');
  }

  async function runBlockHost() {
    const hostId = gathering?.host_id || gathering?.host?.id;
    if (!session?.access_token || !hostId) return;
    setBusy(true);
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
      setConfirmKind(null);
      setSafetyMsg(res.ok ? '已封鎖主辦，對方無法再與你互動。' : (data.error || '封鎖失敗'));
    } catch {
      setSafetyMsg('網絡錯誤');
    } finally {
      setBusy(false);
    }
  }

  const phoneProvided = phone.trim() !== '';
  const phoneValid = isValidHkPhone(phone);
  const phoneError = phoneProvided && !phoneValid ? '電話號碼應為 8 位數字。' : '';

  return (
    <>
      <SeoHead
        title={gathering?.title || seo?.title || '聚會詳情'}
        description={gathering?.description || seo?.description || '月光聚會詳情 — 香港 Les 活動。'}
        path={id ? `/gatherings/${id}` : '/gatherings'}
        ogType="article"
        noindex={seo ? seo.indexable === false : false}
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
          <article className={`gathering-detail gathering-detail--simple${gathering.status === 'cancelled' ? ' gathering-detail--cancelled' : ''}`}>
            <Link href="/gatherings" className="gathering-detail__back">
              ← 返回月曆
            </Link>

            <div className="gathering-detail__sheet">
              {gathering.status === 'cancelled' && (
                <div className="gathering-detail__cancel-banner" role="status" aria-live="polite">
                  <p className="gathering-detail__cancel-banner-title">此聚會已取消</p>
                  <p className="gathering-detail__cancel-banner-body">
                    申請審批與報名已關閉
                    {gathering.cancel_reason ? ` · 原因：${gathering.cancel_reason}` : ''}
                  </p>
                </div>
              )}

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
                <div className={`gathering-detail__private gathering-detail__private--unlocked${gathering.status === 'cancelled' ? ' gathering-detail__private--cancelled' : (!isHost && gathering.my_attendance?.status === 'approved' ? ' gathering-detail__private--pass' : '')}`}>
                  <span className="gathering-detail__private-badge">
                    {gathering.status === 'cancelled'
                      ? '聚會已取消'
                      : (!isHost && gathering.my_attendance?.status === 'approved' ? (
                        <>
                          <UiUnlockIcon size={11} /> 已解鎖 · 專屬通行證
                        </>
                      ) : (
                        <>
                          <ForumLockIcon size={11} /> 僅獲批准者可見
                        </>
                      ))}
                  </span>
                  <p className="gathering-detail__private-label">私密地點／連結</p>
                  <p className="gathering-detail__private-value">
                    <span className="gathering-detail__private-pin" aria-hidden="true">
                      <ForumPinIcon size={14} />
                    </span>
                    {gathering.location_private}
                  </p>
                </div>
              ) : gathering.has_private_location && !isHost ? (
                <div className="gathering-detail__private gathering-detail__private--locked" aria-label="私密地點未解鎖">
                  <p className="gathering-detail__private-label">
                    <span className="gathering-detail__private-lock" aria-hidden="true">
                      <ForumLockIcon size={14} />
                    </span>
                    私密地點／連結
                  </p>
                  <div className="gathering-detail__private-locked-body">
                    <p className="gathering-detail__private-blur" aria-hidden="true">████ ██████ ███ ██</p>
                    <p className="gathering-detail__private-locked-note">
                      <ForumLockIcon size={12} /> 詳細地址將於主辦人批准後解鎖
                    </p>
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

            {!isHost && session && safetyMsg && (
              <p className="gathering-detail__safety-msg" role="status">{safetyMsg}</p>
            )}

            {msg && gathering.status !== 'cancelled' && !gathering.my_attendance?.status && (
              <p
                className={`gathering-detail__msg${/取消/.test(msg) ? ' gathering-detail__msg--cancel' : ''}`}
                role="status"
              >
                {msg}
              </p>
            )}

            {isHost ? (
              <section className="gathering-detail__host-panel">
                {gathering.status === 'cancelled' ? (
                  <p className="gathering-detail__host-closed">此聚會已取消，無法再審批申請。</p>
                ) : gathering.status === 'completed' ? (
                  <p className="gathering-detail__host-closed">聚會已結束，審批已關閉。</p>
                ) : (
                  <>
                    <h2>主辦人審批</h2>
                    <GatheringHostQueue
                      gatheringId={gathering.id}
                      knockQuestion={gathering.knock_question}
                      onChanged={() => load()}
                    />
                    <button type="button" className="gathering-detail__cancel" disabled={busy} onClick={cancelGathering}>
                      取消聚會
                    </button>
                  </>
                )}
              </section>
            ) : gathering.status === 'cancelled'
              && !(gathering.my_attendance?.status && gathering.my_attendance.status !== 'withdrawn') ? null : (
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
                        {(gathering.my_attendance.status === 'pending' || gathering.my_attendance.status === 'waitlist') && (
                          <ForumClockIcon size={20} />
                        )}
                        {gathering.my_attendance.status === 'approved' && <ForumPawIcon size={20} />}
                        {gathering.my_attendance.status === 'rejected' && <ForumMoonIcon size={20} />}
                      </span>
                      <p className="gathering-detail__attendance-copy">
                        {gathering.status === 'cancelled' && '此聚會已取消，無需再赴約。'}
                        {gathering.status !== 'cancelled' && gathering.my_attendance.status === 'pending' && '申請已送出！小黑貓正幫你將靈魂信件叼去俾主辦人，批准後會喺 Inbox 收到通知喔'}
                        {gathering.status !== 'cancelled' && gathering.my_attendance.status === 'approved' && '你已獲邀！私密地點／連結已喺上方解鎖，記得準時赴約'}
                        {gathering.status !== 'cancelled' && gathering.my_attendance.status === 'rejected' && '今次未獲邀。唔緊要，仲有好多月光聚會等緊你'}
                        {gathering.status !== 'cancelled' && gathering.my_attendance.status === 'waitlist' && '你而家喺候補名單，有位會第一時間通知你。'}
                      </p>
                    </div>
                    {gathering.my_attendance.knock_message && (
                      <div className="gathering-detail__attendance-knock">
                        <p className="gathering-detail__attendance-knock-label">你嘅敲門答案</p>
                        <p className="gathering-detail__attendance-knock-body">{gathering.my_attendance.knock_message}</p>
                      </div>
                    )}
                    {(gathering.status !== 'cancelled' && gathering.status !== 'completed')
                      && (gathering.my_attendance.status === 'pending' || gathering.my_attendance.status === 'approved') && (
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
                    {gathering.status === 'cancelled' && (
                      <p className="gathering-detail__attendance-closed">聚會已取消，無需再處理申請。</p>
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
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          maxLength={20}
                          required={!gathering.is_online}
                          autoComplete="tel"
                          placeholder="例如：91234567"
                          aria-invalid={phoneError ? 'true' : 'false'}
                        />
                        {phoneError && (
                          <span className="gathering-form__field-error" role="alert">{phoneError}</span>
                        )}
                      </label>
                    </div>
                    <p className="gathering-form__hint">
                      <ForumLockIcon size={12} />{' '}
                      {gathering.is_online
                        ? '電郵／電話只會喺主辦人批准後分享俾佢，僅用於聚會協調，唔會公開顯示；線上聚會電話可留空。'
                        : '電郵／電話只會喺主辦人批准後分享俾佢，僅用於聚會協調，唔會公開顯示。若你撤回或取消參與，聯絡資料亦會失效。'}
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
                        disabled={busy || !email.trim() || (!gathering.is_online && !phoneValid) || (phoneProvided && !phoneValid)}
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
            ? '確定要放棄呢個聚會名額嗎？小黑貓會好傷心喔'
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

        <GatheringConfirmOverlay
          open={confirmKind === 'report'}
          title="舉報呢個聚會？"
          sub="月光守護者會收到通知並跟進；達到門檻聚會會自動隱藏。如涉及即時危險，請先報警。"
          confirmLabel="送出舉報"
          cancelLabel="返回"
          variant="danger"
          busy={busy}
          showNote
          note={reportReason}
          onNoteChange={setReportReason}
          noteLabel="舉報原因（選填）"
          notePlaceholder="簡述發生咩事，例如：不當內容、騷擾、資料造假…"
          onConfirm={runReportGathering}
          onCancel={() => { if (!busy) { setConfirmKind(null); setReportReason(''); } }}
        />

        <GatheringConfirmOverlay
          open={confirmKind === 'block'}
          title="封鎖主辦？"
          sub="封鎖後你將無法再申請對方的聚會，雙方亦不會互相收到訊息。"
          confirmLabel="封鎖"
          cancelLabel="返回"
          variant="danger"
          busy={busy}
          onConfirm={runBlockHost}
          onCancel={() => { if (!busy) setConfirmKind(null); }}
        />
      </GatheringShell>
    </>
  );
}

function gatheringSeoDescription(row) {
  const base = (row.description || '').replace(/\s+/g, ' ').trim();
  const mode = row.is_online ? '線上聚會' : '線下聚會';
  const prefix = `香港 Les 月光聚會 · ${mode}`;
  if (!base) return `${prefix} — 一齊參與 Black Cat Under The Moon 社群活動。`;
  const body = base.length > 140 ? `${base.slice(0, 140)}…` : base;
  return `${prefix}｜${body}`;
}

export async function getServerSideProps({ params, res }) {
  const id = typeof params?.id === 'string' ? params.id : '';
  if (!id) return { notFound: true };

  try {
    const { getAdminClient } = await import('../../lib/server-auth.js');
    const admin = getAdminClient();
    const { data: row } = await admin
      .from('gatherings')
      .select('id, title, description, status, is_online, is_hidden')
      .eq('id', id)
      .maybeSingle();

    if (!row) return { props: { seo: null } };

    const indexable = !row.is_hidden && row.status !== 'cancelled';

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');

    return {
      props: {
        seo: {
          title: row.title || '聚會詳情',
          description: gatheringSeoDescription(row),
          indexable,
        },
      },
    };
  } catch (err) {
    console.error('[gatherings/id] SSR meta failed:', err?.message || err);
    return { props: { seo: null } };
  }
}
