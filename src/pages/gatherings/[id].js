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
import { normalizeGatheringPrivateLocation } from '../../lib/gathering-private-location.js';

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
  const [confirmKind, setConfirmKind] = useState(null); // 'apply' | 'withdraw' | 'cancel' | 'safety' | 'report' | 'block' | null
  const [cancelReason, setCancelReason] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [safetyMsg, setSafetyMsg] = useState('');
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [riskRemind, setRiskRemind] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [editingPrivate, setEditingPrivate] = useState(false);
  const [privateDraft, setPrivateDraft] = useState('');
  const [savingPrivate, setSavingPrivate] = useState(false);

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

  useEffect(() => {
    setEditingDesc(false);
    setDescDraft('');
    setSavingDesc(false);
  }, [id]);

  async function apply() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    if (!email.trim()) {
      setMsg('請填寫電郵。');
      return;
    }
    if (!gathering?.is_online && !phoneValid) {
      setMsg(phoneProvided ? '電話號碼應為 8 位數字。' : '線下聚會請填寫電話。');
      return;
    }
    if (phoneProvided && !phoneValid) {
      setMsg('電話號碼應為 8 位數字。');
      return;
    }
    if (gathering?.require_knock_message && !knock.trim()) {
      setMsg('請回答主辦的敲門暗號。');
      if (typeof document !== 'undefined') {
        document.getElementById('gathering-knock-answer')?.focus();
      }
      return;
    }
    if (!riskAccepted) {
      setRiskRemind(true);
      setMsg('請先勾選風險確認，同意自行承擔參加聚會的風險。');
      if (typeof document !== 'undefined') {
        const el = document.getElementById('gathering-risk-check');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.querySelector('input[type="checkbox"]')?.focus();
      }
      return;
    }
    setRiskRemind(false);
    setConfirmKind('apply');
  }

  async function runApply() {
    if (!session?.access_token) return;
    if (!riskAccepted) {
      setMsg('請先勾選風險確認，同意自行承擔參加聚會的風險。');
      setConfirmKind(null);
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
          risk_accepted: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '申請失敗');
        return;
      }
      setMsg(data.attendance?.status === 'approved' ? '已直接獲邀！' : '申請已送出，等候主辦人審核。');
      setConfirmKind(null);
      setRiskAccepted(false);
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

  function openSafetyMenu() {
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/gatherings/${id}`)}`);
      return;
    }
    setSafetyMsg('');
    setConfirmKind('safety');
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

  const canEditDescription = isHost
    && gathering
    && gathering.status !== 'cancelled'
    && gathering.status !== 'completed'
    && new Date(gathering.starts_at).getTime() > Date.now();

  const canEditPrivate = canEditDescription;

  function startEditDesc() {
    setDescDraft(gathering?.description || '');
    setEditingDesc(true);
    setMsg('');
  }

  function cancelEditDesc() {
    setEditingDesc(false);
    setDescDraft('');
  }

  async function saveDesc() {
    if (!session?.access_token || !id) return;
    setSavingDesc(true);
    setMsg('');
    try {
      const trimmed = descDraft.trim();
      const res = await fetch(`/api/gatherings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ description: trimmed || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '更新說明失敗');
        return;
      }
      if (data.gathering) {
        setGathering((prev) => (prev ? { ...prev, ...data.gathering } : data.gathering));
      } else {
        await load();
      }
      setEditingDesc(false);
      setDescDraft('');
      setMsg('說明已更新。');
    } catch {
      setMsg('網絡錯誤');
    } finally {
      setSavingDesc(false);
    }
  }

  function startEditPrivate() {
    setPrivateDraft(normalizeGatheringPrivateLocation(gathering?.location_private) || '');
    setEditingPrivate(true);
    setMsg('');
  }

  function cancelEditPrivate() {
    setEditingPrivate(false);
    setPrivateDraft('');
  }

  async function savePrivate() {
    if (!session?.access_token || !id) return;
    setSavingPrivate(true);
    setMsg('');
    try {
      const value = normalizeGatheringPrivateLocation(privateDraft);
      const res = await fetch(`/api/gatherings/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ location_private: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || '更新私密地點失敗');
        return;
      }
      if (data.gathering) {
        setGathering((prev) => (prev ? { ...prev, ...data.gathering } : data.gathering));
      } else {
        await load();
      }
      setEditingPrivate(false);
      setPrivateDraft('');
      setMsg(value ? '私密地點／連結已更新。' : '已清除私密地點／連結。');
    } catch {
      setMsg('網絡錯誤');
    } finally {
      setSavingPrivate(false);
    }
  }

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
            <div className="gathering-detail__topbar">
              <Link href="/gatherings" className="gathering-detail__back">
                ← 返回月曆
              </Link>
              {!isHost && session && (
                <button
                  type="button"
                  className="gathering-detail__safety-btn"
                  disabled={busy}
                  onClick={openSafetyMenu}
                >
                  舉報
                </button>
              )}
            </div>

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

              {(gathering.description || canEditDescription || editingDesc) && (
                <div className="gathering-detail__desc-block">
                  {canEditDescription && (
                    <div className="gathering-detail__desc-head">
                      <p className="gathering-detail__desc-label">聚會說明</p>
                      {!editingDesc && (
                        <button
                          type="button"
                          className="gathering-detail__desc-edit"
                          disabled={busy || savingDesc}
                          onClick={startEditDesc}
                        >
                          {gathering.description ? '編輯說明' : '新增說明'}
                        </button>
                      )}
                    </div>
                  )}
                  {editingDesc ? (
                    <>
                      <textarea
                        className="gathering-detail__desc-input"
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        maxLength={800}
                        rows={5}
                        placeholder="寫下聚會詳情、注意事項……"
                        disabled={savingDesc}
                        aria-label="聚會說明"
                      />
                      <div className="gathering-detail__desc-actions">
                        <span className="gathering-detail__desc-count">
                          {descDraft.trim().length}/800
                        </span>
                        <button
                          type="button"
                          className="gathering-detail__rsvp-ghost"
                          disabled={savingDesc}
                          onClick={cancelEditDesc}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className="gatherings-hero__cta gathering-detail__desc-save"
                          disabled={savingDesc}
                          onClick={saveDesc}
                        >
                          {savingDesc ? '儲存中…' : '儲存'}
                        </button>
                      </div>
                    </>
                  ) : gathering.description ? (
                    <p className="gathering-detail__desc">{gathering.description}</p>
                  ) : (
                    <p className="gathering-detail__desc gathering-detail__desc--empty">
                      尚未填寫說明。點「新增說明」寫畀參加者睇。
                    </p>
                  )}
                </div>
              )}

              {(() => {
                const approved = gathering.approved_count || 0;
                const max = gathering.max_participants || 0;
                const remaining = Math.max(0, max - approved);
                const pct = max > 0 ? Math.min(100, Math.round((approved / max) * 100)) : 0;
                const seatsFull = max > 0 && remaining === 0;
                return (
                  <div
                    className="gathering-detail__seats gathering-hud gathering-hud--gauge"
                    aria-label={`人數 ${approved}/${max}`}
                  >
                    <div className="gathering-hud__corners" aria-hidden="true" />
                    <div className="gathering-detail__seats-head">
                      <span>人數</span>
                      <strong className={seatsFull ? 'is-full' : undefined}>
                        {seatsFull ? `已滿額 · ${approved}/${max}` : `${approved}/${max || '—'}`}
                      </strong>
                    </div>
                    <div
                      className="gathering-detail__seats-track"
                      role="progressbar"
                      aria-valuenow={approved}
                      aria-valuemin={0}
                      aria-valuemax={max || 0}
                      aria-label={
                        seatsFull
                          ? `已滿額，共 ${max} 個位`
                          : `已報名 ${approved} 人，共 ${max} 個位，仲有 ${remaining} 個位`
                      }
                    >
                      <div
                        className={`gathering-detail__seats-fill${seatsFull ? ' is-full' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {(() => {
                // Three distinct states — do not mix:
                // 1) unfilled  — no real address/link saved
                // 2) hidden    — filled, but viewer not approved (locked)
                // 3) revealed  — host or approved guest can see the value
                const filled = !!gathering.has_private_location;
                const raw = normalizeGatheringPrivateLocation(gathering.location_private);
                const isApprovedGuest = !isHost && gathering.my_attendance?.status === 'approved';
                const canReveal = isHost || (isApprovedGuest && filled);
                const isCancelled = gathering.status === 'cancelled';
                const isUrl = raw ? /^https?:\/\/\S+/i.test(raw) : false;

                // Guests: only show card when something is actually filled (then locked or revealed).
                // Host: always show so they can fill / edit.
                if (!isHost && !filled) return null;

                // ── Hidden (filled but not unlocked) ──
                if (filled && !canReveal) {
                  return (
                    <div className="gathering-detail__private gathering-detail__private--locked" aria-label="私密地點已隱藏">
                      <div className="gathering-detail__private-head">
                        <p className="gathering-detail__private-label">私密地點／連結</p>
                        <span className="gathering-detail__private-badge">
                          <ForumLockIcon size={11} /> 已填寫 · 僅獲批准者可見
                        </span>
                      </div>
                      <div className="gathering-detail__private-locked-body">
                        <p className="gathering-detail__private-blur" aria-hidden="true">████ ██████ ███ ██</p>
                        <p className="gathering-detail__private-locked-note">
                          <span className="gathering-detail__private-lock" aria-hidden="true">
                            <ForumLockIcon size={12} />
                          </span>
                          主辦已填寫私密地點／連結，批准後先解鎖
                        </p>
                      </div>
                    </div>
                  );
                }

                // ── Unfilled (host only) ──
                if (!filled) {
                  return (
                    <div className="gathering-detail__private gathering-detail__private--empty gathering-detail__private--host">
                      <div className="gathering-detail__private-head">
                        <p className="gathering-detail__private-label">私密地點／連結</p>
                        {canEditPrivate && !editingPrivate && (
                          <button
                            type="button"
                            className="gathering-detail__desc-edit"
                            disabled={busy || savingPrivate}
                            onClick={startEditPrivate}
                          >
                            填寫
                          </button>
                        )}
                      </div>
                      {editingPrivate ? (
                        <>
                          <input
                            className="gathering-detail__private-input"
                            type="text"
                            value={privateDraft}
                            onChange={(e) => setPrivateDraft(e.target.value)}
                            maxLength={500}
                            placeholder={gathering.is_online ? 'Discord / Meet 連結' : '詳細地址'}
                            disabled={savingPrivate}
                            aria-label="私密地點或連結"
                          />
                          <div className="gathering-detail__desc-actions">
                            <span className="gathering-detail__desc-count">
                              {privateDraft.trim().length}/500
                            </span>
                            <button
                              type="button"
                              className="gathering-detail__rsvp-ghost"
                              disabled={savingPrivate}
                              onClick={cancelEditPrivate}
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              className="gatherings-hero__cta gathering-detail__desc-save"
                              disabled={savingPrivate}
                              onClick={savePrivate}
                            >
                              {savingPrivate ? '儲存中…' : '儲存'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="gathering-detail__private-empty">
                          尚未填寫 — 點「填寫」補上地址或連結，獲批參加者先睇到。
                        </p>
                      )}
                    </div>
                  );
                }

                // ── Revealed (host or approved guest) ──
                return (
                  <div
                    className={[
                      'gathering-detail__private',
                      'gathering-detail__private--unlocked',
                      isCancelled ? 'gathering-detail__private--cancelled' : '',
                      isApprovedGuest ? 'gathering-detail__private--pass' : '',
                      isHost ? 'gathering-detail__private--host' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="gathering-detail__private-head">
                      <p className="gathering-detail__private-label">私密地點／連結</p>
                      {canEditPrivate && !editingPrivate ? (
                        <button
                          type="button"
                          className="gathering-detail__desc-edit"
                          disabled={busy || savingPrivate}
                          onClick={startEditPrivate}
                        >
                          編輯
                        </button>
                      ) : (
                        <span className="gathering-detail__private-badge">
                          {isCancelled ? (
                            '聚會已取消'
                          ) : isHost ? (
                            <>
                              <ForumLockIcon size={11} /> 主辦可見 · 批准後參加者可睇
                            </>
                          ) : (
                            <>
                              <UiUnlockIcon size={11} /> 已解鎖 · 專屬通行證
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    {editingPrivate ? (
                      <>
                        <input
                          className="gathering-detail__private-input"
                          type="text"
                          value={privateDraft}
                          onChange={(e) => setPrivateDraft(e.target.value)}
                          maxLength={500}
                          placeholder={gathering.is_online ? 'Discord / Meet 連結' : '詳細地址'}
                          disabled={savingPrivate}
                          aria-label="私密地點或連結"
                        />
                        <div className="gathering-detail__desc-actions">
                          <span className="gathering-detail__desc-count">
                            {privateDraft.trim().length}/500
                          </span>
                          <button
                            type="button"
                            className="gathering-detail__rsvp-ghost"
                            disabled={savingPrivate}
                            onClick={cancelEditPrivate}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            className="gatherings-hero__cta gathering-detail__desc-save"
                            disabled={savingPrivate}
                            onClick={savePrivate}
                          >
                            {savingPrivate ? '儲存中…' : '儲存'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="gathering-detail__private-value">
                        <span className="gathering-detail__private-pin" aria-hidden="true">
                          <ForumPinIcon size={14} />
                        </span>
                        {isUrl ? (
                          <a
                            className="gathering-detail__private-link"
                            href={raw}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {raw}
                          </a>
                        ) : (
                          <span className="gathering-detail__private-text">{raw}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <GatheringSafetyNotice />

            {!isHost && session && safetyMsg && (
              <p className="gathering-detail__safety-msg" role="status">{safetyMsg}</p>
            )}

            {msg && gathering.status !== 'cancelled' && (isHost || !gathering.my_attendance?.status) && (
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
                    <div className="gathering-detail__host-head">
                      <h2>主辦人審批</h2>
                      <button
                        type="button"
                        className="gathering-detail__cancel"
                        disabled={busy}
                        onClick={cancelGathering}
                      >
                        取消聚會
                      </button>
                    </div>
                    <GatheringHostQueue
                      gatheringId={gathering.id}
                      knockQuestion={gathering.knock_question}
                      onChanged={() => load()}
                    />
                  </>
                )}
              </section>
            ) : gathering.status === 'cancelled'
              && !(gathering.my_attendance?.status && gathering.my_attendance.status !== 'withdrawn') ? null : (
              <section className="gathering-detail__rsvp">
                {gathering.my_attendance?.status
                  && gathering.my_attendance.status !== 'withdrawn' ? (
                  <div
                    className={[
                      'gathering-detail__attendance',
                      `gathering-detail__attendance--${gathering.my_attendance.status}`,
                      gathering.status === 'cancelled' ? 'gathering-detail__attendance--event-cancelled' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <header className="gathering-detail__attendance-head">
                      <p className="gathering-detail__attendance-kicker">你的狀態</p>
                      <p
                        className={[
                          'gathering-detail__rsvp-chip',
                          `gathering-detail__rsvp-chip--${gathering.my_attendance.status}`,
                          gathering.status === 'cancelled' ? 'gathering-detail__rsvp-chip--event-cancelled' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {gathering.status === 'cancelled'
                          ? '聚會已取消'
                          : (STATUS_LABEL[gathering.my_attendance.status] || gathering.my_attendance.status)}
                      </p>
                    </header>
                    <div className="gathering-detail__attendance-copy-row">
                      <span
                        className={`gathering-detail__attendance-icon gathering-detail__attendance-icon--${
                          gathering.status === 'cancelled' ? 'cancelled' : gathering.my_attendance.status
                        }`}
                        aria-hidden="true"
                      >
                        {gathering.status === 'cancelled' ? (
                          <ForumMoonIcon size={20} />
                        ) : (
                          <>
                            {(gathering.my_attendance.status === 'pending' || gathering.my_attendance.status === 'waitlist') && (
                              <ForumClockIcon size={20} />
                            )}
                            {gathering.my_attendance.status === 'approved' && <ForumPawIcon size={20} />}
                            {gathering.my_attendance.status === 'rejected' && <ForumMoonIcon size={20} />}
                          </>
                        )}
                      </span>
                      <p className="gathering-detail__attendance-copy">
                        {gathering.status === 'cancelled' && '無需再赴約；先前嘅申請／名額已失效。'}
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
                  </div>
                ) : gathering.status === 'open' && session ? (
                  <form
                    className="gathering-detail__apply"
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault();
                      apply();
                    }}
                  >
                    <header className="gathering-detail__apply-head">
                      <h2 className="gathering-detail__rsvp-title">申請加入</h2>
                      <p className="gathering-detail__apply-lead">
                        填聯絡同敲門答案，等主辦人批核。
                      </p>
                    </header>

                    <fieldset className="gathering-detail__apply-block">
                      <legend>聯絡資料</legend>
                      <div className="gathering-detail__apply-grid">
                        <label className="gathering-form__field">
                          <span>電郵 *</span>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            maxLength={120}
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
                            autoComplete="tel"
                            placeholder="例如：91234567"
                            aria-invalid={phoneError ? 'true' : 'false'}
                          />
                          {phoneError && (
                            <span className="gathering-form__field-error" role="alert">{phoneError}</span>
                          )}
                        </label>
                      </div>
                      <p className="gathering-detail__apply-privacy">
                        <span className="gathering-detail__apply-privacy-ico" aria-hidden="true">
                          <ForumLockIcon size={12} />
                        </span>
                        <span>
                          {gathering.is_online
                            ? '批准後先分享俾主辦，僅用於聚會協調；線上聚會電話可留空。'
                            : '批准後先分享俾主辦，僅用於聚會協調，唔會公開。撤回或取消後聯絡資料會失效。'}
                        </span>
                      </p>
                    </fieldset>

                    {gathering.require_knock_message && (
                      <fieldset className="gathering-detail__apply-block gathering-detail__apply-block--knock">
                        <legend>敲門暗號 *</legend>
                        {gathering.knock_question && (
                          <div className="gathering-detail__knock-card">
                            <p className="gathering-detail__knock-card-label">主辦提問</p>
                            <p className="gathering-detail__knock-q">{gathering.knock_question}</p>
                          </div>
                        )}
                        <label className="gathering-form__field gathering-detail__knock-field">
                          <textarea
                            id="gathering-knock-answer"
                            value={knock}
                            onChange={(e) => setKnock(e.target.value)}
                            maxLength={200}
                            rows={3}
                            placeholder="簡短回答主辦的問題…"
                            aria-label="你的敲門回答"
                          />
                        </label>
                      </fieldset>
                    )}

                    <label
                      id="gathering-risk-check"
                      className={`gathering-form__field gathering-form__check gathering-detail__risk-check${riskRemind && !riskAccepted ? ' is-remind' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={riskAccepted}
                        onChange={(e) => {
                          setRiskAccepted(e.target.checked);
                          if (e.target.checked) setRiskRemind(false);
                        }}
                        aria-invalid={riskRemind && !riskAccepted ? 'true' : 'false'}
                        aria-describedby={riskRemind && !riskAccepted ? 'gathering-risk-hint' : undefined}
                      />
                      <span>
                        我明白平台只係<span className="gathering-detail__risk-em">中介渠道</span>、唔係主辦；
                        已閱讀
                        {' '}
                        <Link href="/tos.html" target="_blank" rel="noopener noreferrer">使用條款</Link>
                        ，並<span className="gathering-detail__risk-em">自行承擔</span>
                        參加風險。提交後會再確認一次。
                      </span>
                    </label>
                    {riskRemind && !riskAccepted && (
                      <p id="gathering-risk-hint" className="gathering-detail__risk-hint" role="alert">
                        請先勾選上方風險確認，先可以提交申請。
                      </p>
                    )}

                    <div className="gathering-detail__apply-actions">
                      <button
                        type="submit"
                        className="gatherings-hero__cta gathering-detail__apply-cta"
                        disabled={
                          busy
                          || !email.trim()
                          || (!gathering.is_online && !phoneValid)
                          || (phoneProvided && !phoneValid)
                        }
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

            {(gathering.status !== 'cancelled'
              && (isHost || gathering.my_attendance?.status === 'approved')) && (
              <GatheringCommentBoard gatheringId={gathering.id} />
            )}
          </article>
        )}

        <GatheringConfirmOverlay
          open={confirmKind === 'apply'}
          title="確認自行承擔風險？"
          sub={(
            <>
              <p>本平台只係中介渠道，唔係呢場聚會嘅主辦方。</p>
              <p>聚會期間同前後發生嘅任何糾紛、人身／財物風險或其他後果，由你同相關用戶自行承擔；平台不作任何後果承擔。</p>
              <p>按確認即表示你同意繼續申請，並接受使用條款中關於月光聚會的規定。</p>
            </>
          )}
          confirmLabel="明白，繼續申請"
          cancelLabel="返回"
          busy={busy}
          onConfirm={runApply}
          onCancel={() => { if (!busy) setConfirmKind(null); }}
        />

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
          open={confirmKind === 'safety'}
          title="舉報或封鎖？"
          sub="遇到不當行為可舉報聚會，或封鎖主辦以免再接觸。涉及即時危險請先報警。"
          cancelLabel="返回"
          busy={busy}
          choices={[
            {
              id: 'report',
              label: '舉報聚會',
              variant: 'danger',
              onClick: reportGathering,
            },
            {
              id: 'block',
              label: '封鎖主辦',
              variant: 'danger',
              onClick: blockHost,
            },
          ]}
          onCancel={() => { if (!busy) setConfirmKind(null); }}
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
