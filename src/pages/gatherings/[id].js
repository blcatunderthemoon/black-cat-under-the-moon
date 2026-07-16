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
        maxWidth="680px"
        redirectPath={id ? `/gatherings/${id}` : '/gatherings'}
      >
        {loading ? (
          <MoonLoading variant="hero" />
        ) : error || !gathering ? (
          <p className="gatherings-empty gatherings-empty--err">{error || '找不到聚會'}</p>
        ) : (
          <article className="gathering-detail">
            <div className="gathering-detail__badges">
              <span>{gathering.is_online ? '線上' : '線下'}</span>
              <span>{STATUS_LABEL[gathering.status] || gathering.status}</span>
            </div>
            <h1 className="gathering-detail__title">{gathering.title}</h1>
            <p className="gathering-detail__meta">{gathering.starts_at_hk}</p>
            <p className="gathering-detail__meta">{gathering.location_public}</p>
            {gathering.host && (
              <p className="gathering-detail__host">
                主辦：{gathering.host.display_name}
                {gathering.host.family_zh ? ` · ${gathering.host.family_zh}` : ''}
              </p>
            )}
            {!!gathering.tag_labels?.length && (
              <p className="gathering-detail__tags">{gathering.tag_labels.join(' ')}</p>
            )}
            {gathering.description && (
              <p className="gathering-detail__desc">{gathering.description}</p>
            )}
            <p className="gathering-detail__seats">
              人數 {gathering.approved_count}/{gathering.max_participants}
            </p>

            {gathering.location_private != null && gathering.location_private !== '' && (
              <div className="gathering-detail__private">
                <p className="gathering-detail__private-label">私密地點／連結</p>
                <p className="gathering-detail__private-value">{gathering.location_private}</p>
              </div>
            )}

            <GatheringSafetyNotice />

            {msg && <p className="gathering-detail__msg" role="status">{msg}</p>}

            {isHost ? (
              <section className="gathering-detail__host-panel">
                <h2>主辦人審批</h2>
                <GatheringHostQueue
                  gatheringId={gathering.id}
                  knockQuestion={gathering.knock_question}
                />
                {gathering.status !== 'cancelled' && gathering.status !== 'completed' && (
                  <button type="button" className="gathering-detail__danger" disabled={busy} onClick={cancelGathering}>
                    取消聚會
                  </button>
                )}
              </section>
            ) : (
              <section className="gathering-detail__rsvp">
                {gathering.my_attendance?.status ? (
                  <>
                    <p>你的狀態：{STATUS_LABEL[gathering.my_attendance.status] || gathering.my_attendance.status}</p>
                    {(gathering.my_attendance.status === 'pending' || gathering.my_attendance.status === 'approved') && (
                      <button type="button" disabled={busy} onClick={withdraw}>撤回</button>
                    )}
                  </>
                ) : gathering.status === 'open' && session ? (
                  <>
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
                      <span>電話 *</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={20}
                        required
                        autoComplete="tel"
                        placeholder="例如：91234567 或 +85291234567"
                      />
                    </label>
                    <p className="gathering-form__hint">僅主辦人可見，唔會公開顯示。</p>
                    {gathering.require_knock_message && (
                      <label className="gathering-form__field">
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
                          placeholder="回答主辦的敲門問題…"
                        />
                      </label>
                    )}
                    <button type="button" className="gatherings-hero__cta" disabled={busy || !email.trim() || !phone.trim()} onClick={apply}>
                      申請加入
                    </button>
                  </>
                ) : gathering.status === 'open' && !session ? (
                  <p className="gathering-detail__login-hint">
                    <Link href={`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`}>登入</Link>
                    {' '}後先可以申請。
                  </p>
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
