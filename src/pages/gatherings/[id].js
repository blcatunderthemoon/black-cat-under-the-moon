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
    if (!window.confirm('確定撤回申請／退出聚會？')) return;
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
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelGathering() {
    if (!session?.access_token) return;
    const reason = window.prompt('取消原因（可留空）：') ?? null;
    if (reason === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/gatherings/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason: reason || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '取消失敗');
        return;
      }
      setMsg('聚會已取消。');
      await load();
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
          <article className="gathering-detail gathering-detail--quest">
            <Link href="/gatherings" className="gathering-detail__back">
              ← 返回月曆
            </Link>

            <header className="gathering-detail__hero gathering-hud">
              <div className="gathering-hud__corners" aria-hidden="true" />
              <p className="gathering-detail__quest-label">QUEST · 月光聚會</p>
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

            <dl className="gathering-detail__facts gathering-hud gathering-hud--stats">
              <div className="gathering-hud__corners" aria-hidden="true" />
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
              <div className="gathering-detail__desc-block gathering-hud">
                <div className="gathering-hud__corners" aria-hidden="true" />
                <p className="gathering-detail__desc-label">任務說明</p>
                <p className="gathering-detail__desc">{gathering.description}</p>
              </div>
            )}

            <div
              className="gathering-detail__seats gathering-hud gathering-hud--gauge"
              aria-label={`人數 ${gathering.approved_count}/${gathering.max_participants}`}
            >
              <div className="gathering-hud__corners" aria-hidden="true" />
              <div className="gathering-detail__seats-head">
                <span>PARTY</span>
                <strong>{gathering.approved_count}/{gathering.max_participants}</strong>
              </div>
              <div className="gathering-detail__seats-track">
                <div
                  className="gathering-detail__seats-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((gathering.approved_count || 0) / Math.max(1, gathering.max_participants || 1)) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>

            {gathering.location_private != null && gathering.location_private !== '' && (
              <div className="gathering-detail__private gathering-hud gathering-hud--loot">
                <div className="gathering-hud__corners" aria-hidden="true" />
                <p className="gathering-detail__private-label">已解鎖 · 私密地點／連結</p>
                <p className="gathering-detail__private-value">{gathering.location_private}</p>
              </div>
            )}

            <GatheringSafetyNotice />

            {msg && !gathering.my_attendance?.status && (
              <p className="gathering-detail__msg" role="status">{msg}</p>
            )}

            {isHost ? (
              <section className="gathering-detail__host-panel gathering-hud">
                <div className="gathering-hud__corners" aria-hidden="true" />
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
              <section className="gathering-detail__rsvp gathering-hud">
                <div className="gathering-hud__corners" aria-hidden="true" />
                {gathering.my_attendance?.status
                  && gathering.my_attendance.status !== 'withdrawn' ? (
                  <div className={`gathering-detail__attendance gathering-detail__attendance--${gathering.my_attendance.status}`}>
                    <header className="gathering-detail__attendance-head">
                      <p className="gathering-detail__attendance-kicker">任務狀態</p>
                      <p className={`gathering-detail__rsvp-chip gathering-detail__rsvp-chip--${gathering.my_attendance.status}`}>
                        {STATUS_LABEL[gathering.my_attendance.status] || gathering.my_attendance.status}
                      </p>
                    </header>
                    <p className="gathering-detail__attendance-copy">
                      {gathering.my_attendance.status === 'pending' && '申請已送出，等候主辦人審核。批核後會喺 Inbox 收到通知。'}
                      {gathering.my_attendance.status === 'approved' && '任務已接受！私密地點／連結已解鎖；記得準時同注意安全。'}
                      {gathering.my_attendance.status === 'rejected' && '今次未獲邀。可以睇其他月光聚會，或者稍後再申請其他場次。'}
                      {gathering.my_attendance.status === 'waitlist' && '你而家喺候補名單，有位會再通知你。'}
                    </p>
                    {msg ? (
                      <p className="gathering-detail__attendance-flash" role="status">{msg}</p>
                    ) : null}
                    {gathering.my_attendance.knock_message && (
                      <div className="gathering-detail__attendance-knock">
                        <p className="gathering-detail__attendance-knock-label">你嘅敲門答案</p>
                        <p className="gathering-detail__attendance-knock-body">{gathering.my_attendance.knock_message}</p>
                      </div>
                    )}
                    {(gathering.my_attendance.status === 'pending' || gathering.my_attendance.status === 'approved') && (
                      <div className="gathering-detail__attendance-actions">
                        <button type="button" className="gathering-detail__rsvp-ghost" disabled={busy} onClick={withdraw}>
                          {busy ? '處理中…' : '撤回申請'}
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
                      <h2 className="gathering-detail__rsvp-title">接受任務 · 申請加入</h2>
                      <p className="gathering-detail__apply-lead">填聯絡同敲門答案，等主辦人批核。</p>
                    </header>

                    <fieldset className="gathering-detail__apply-block">
                      <legend>聯絡資料 *</legend>
                      <div className="gathering-detail__apply-grid">
                        <label className="gathering-form__field">
                          <span>電郵</span>
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
                          <span>電話</span>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            maxLength={20}
                            required
                            autoComplete="tel"
                            placeholder="例如：91234567"
                          />
                        </label>
                      </div>
                      <p className="gathering-form__hint">僅主辦人可見，唔會公開顯示喺活動頁。</p>
                    </fieldset>

                    {gathering.require_knock_message && (
                      <fieldset className="gathering-detail__apply-block gathering-detail__apply-block--knock">
                        <legend>敲門暗號 *</legend>
                        {gathering.knock_question && (
                          <div className="gathering-detail__knock-card">
                            <p className="gathering-detail__knock-card-label">主辦問</p>
                            <p className="gathering-detail__knock-q">{gathering.knock_question}</p>
                          </div>
                        )}
                        <label className="gathering-form__field">
                          <span>你的回答</span>
                          <textarea
                            value={knock}
                            onChange={(e) => setKnock(e.target.value)}
                            maxLength={200}
                            rows={3}
                            required
                            placeholder="簡短回答主辦的問題…"
                          />
                        </label>
                      </fieldset>
                    )}

                    <div className="gathering-detail__apply-actions">
                      <button
                        type="submit"
                        className="gatherings-hero__cta gathering-detail__apply-cta"
                        disabled={busy || !email.trim() || !phone.trim()}
                      >
                        {busy ? '提交中…' : '申請加入'}
                      </button>
                    </div>
                  </form>
                ) : gathering.status === 'open' && !session ? (
                  <div className="gathering-detail__login-panel">
                    <p className="gathering-detail__login-lead">想參加呢場聚會？</p>
                    <p className="gathering-detail__login-hint">登入後先可以填聯絡資料同敲門答案。</p>
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
          </article>
        )}
      </GatheringShell>
    </>
  );
}
