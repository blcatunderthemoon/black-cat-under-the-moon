import { useState, useCallback, useEffect, useMemo } from 'react';
import LoadingText from '../LoadingText.js';
import styles from '../../styles/dashboard/EmailAutomation.module.css';
import { useAdminApi } from '../../lib/admin-api-context.js';
import {
  automationPairKey,
  buildSameEmailPairsAlert,
  buildSelectedQuotaUsage,
  countAutomationPairsBySent,
  filterVisibleAutomationPairs,
  isAutomationPairSent,
  pairHasSameEmail,
  pairLimitedUsers,
  pairProjectedQuotaExceed,
} from '../../lib/email-automation-pair-filters.js';
import { MATCH_QUOTA_RESET_LABEL } from '../../lib/match-delivery-quota.js';

const DIM_KEYS = ['attraction', 'emotional', 'lifestyle', 'communication', 'relationship', 'conflictSafety'];
const DIM_LABELS = ['🔥 火花', '💞 情感', '📅 步調', '💬 溝通', '💑 期望', '🛡️ 安全感'];

function scoreColor(s) {
  if (s == null) return '#a89cc8';
  if (s >= 60) return '#4ade80';
  if (s >= 40) return '#fbbf24';
  return '#f87171';
}

/** Derive the stable pair key used as checkbox map key */
function pairKey(p) {
  return automationPairKey(p);
}

function MatchQuotaBadge({ quota, pendingInBatch = 0 }) {
  if (!quota) return null;
  if (quota.is_premium) {
    return <span className={styles.quotaBadgePremium}>🌙 無限制</span>;
  }
  const projected = quota.used + pendingInBatch;
  const full = quota.at_limit || projected >= quota.limit;
  const title = pendingInBatch > 0
    ? `本月已用 ${quota.used}，本次已選 ${pendingInBatch}。${MATCH_QUOTA_RESET_LABEL}`
    : MATCH_QUOTA_RESET_LABEL;
  return (
    <span
      className={`${styles.quotaBadge} ${full ? styles.quotaBadgeFull : ''}`}
      title={title}
    >
      本月 {quota.used}/{quota.limit}
      {pendingInBatch > 0 && (
        <span className={styles.quotaBadgePending}> +{pendingInBatch}</span>
      )}
    </span>
  );
}

function AutomationUserLabel({ user, userId }) {
  const id = user?.id ?? userId;
  const name = user?.name || (id != null ? `用戶 ${id}` : '—');
  const identity = user?.identity;
  return (
    <span>
      {id != null && <span className={styles.userIdTag}>#{id}</span>}
      {' '}
      {name}
      {identity && (
        <span className={styles.userIdentityTag}>
          {' '}({identity})
        </span>
      )}
    </span>
  );
}

export function EmailAutomationPanel() {
  const apiFetch = useAdminApi();
  // ── Filter ────────────────────────────────────────────────────────────────
  const [minScore, setMinScore] = useState('60');
  const [loadingPairs, setLoadingPairs] = useState(false);
  const [loadError, setLoadError] = useState('');

  // ── Pairs data ────────────────────────────────────────────────────────────
  const [pairs, setPairs] = useState(null);       // null = not loaded yet
  const [pairsTotal, setPairsTotal] = useState(0);
  const [pairsSummary, setPairsSummary] = useState(null);
  const [sentFilter, setSentFilter] = useState('unsent'); // 'unsent' | 'sent' | 'all'
  const [hideQuotaFull, setHideQuotaFull] = useState(true);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'premium'

  // ── Manual override ───────────────────────────────────────────────────────
  // When on, the monthly free-user quota is ignored: quota-full pairs become
  // selectable and sends are forced through with skip_quota_check.
  const [quotaOverride, setQuotaOverride] = useState(false);

  // ── Drafts data ───────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // ── Checkbox state ────────────────────────────────────────────────────────
  const [checked, setChecked] = useState({});     // { "aId:bId": true }

  // ── Action state ──────────────────────────────────────────────────────────
  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending]         = useState(false);
  const [sendResults, setSendResults] = useState(null);   // per-pair result map

  // ── Draft-row send/delete state ───────────────────────────────────────────
  const [draftActionId, setDraftActionId] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch helpers
  // ─────────────────────────────────────────────────────────────────────────

  const fetchPairs = useCallback(async () => {
    setLoadingPairs(true);
    setChecked({});
    setSendResults(null);
    setLoadError('');
    try {
      const params = new URLSearchParams({ mode: 'pairs', minScore: minScore || '0' });
      if (viewMode === 'premium') params.set('premium_only', '1');
      const res  = await apiFetch(`/api/dashboard/email-automation?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPairs(null);
        setPairsTotal(0);
        setPairsSummary(null);
        setLoadError(
          data.error
          || (res.status === 401 || res.status === 403
            ? '權限不足或登入已過期，請重新登入後再試。'
            : res.status === 503
              ? 'Dashboard 驗證未設定（DASHBOARD_SECRET），或服務暫不可用。'
              : `載入失敗（HTTP ${res.status}）`),
        );
        return;
      }
      setPairs(Array.isArray(data.pairs) ? data.pairs : []);
      setPairsTotal(data.total || 0);
      setPairsSummary(data.summary || null);
    } catch (err) {
      setPairs(null);
      setPairsSummary(null);
      setLoadError(err?.message || '網絡錯誤，請稍後再試。');
    } finally {
      setLoadingPairs(false);
    }
  }, [minScore, viewMode, apiFetch]);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res  = await apiFetch('/api/dashboard/email-automation?mode=drafts');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDrafts([]);
        setLoadError((prev) => prev || data.error || `草稿載入失敗（HTTP ${res.status}）`);
        return;
      }
      setDrafts(data.drafts || []);
    } catch {
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }, [apiFetch]);

  // Load both on first render
  const initialLoad = useCallback(() => {
    fetchPairs();
    fetchDrafts();
  }, [fetchPairs, fetchDrafts]);

  useEffect(() => {
    if (pairs !== null) fetchPairs();
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // Checkbox helpers
  // ─────────────────────────────────────────────────────────────────────────

  const isPairSelectable = (p) =>
    (quotaOverride || !p.quota_blocked) && !p.same_email_blocked && !pairHasSameEmail(p);

  // In override mode always reveal quota-full pairs so they can be picked.
  const effectiveHideQuotaFull = quotaOverride ? false : hideQuotaFull;
  const premiumOnly = viewMode === 'premium';

  const visiblePairs = useMemo(
    () => filterVisibleAutomationPairs(pairs, { sentFilter, hideQuotaFull: effectiveHideQuotaFull, premiumOnly }),
    [pairs, sentFilter, effectiveHideQuotaFull, premiumOnly],
  );

  // All currently-checked pairs (across every filter view) — used for quota
  // projection so hidden-but-selected pairs still count toward a user's limit.
  const checkedPairsAll = useMemo(
    () => (pairs || []).filter((p) => isPairSelectable(p) && checked[pairKey(p)]),
    [pairs, checked],
  );

  // Map<responseId, count> of free-user appearances in the current selection.
  const selectedQuotaUsage = useMemo(
    () => buildSelectedQuotaUsage(checkedPairsAll),
    [checkedPairsAll],
  );

  const describeQuotaExceed = (offending) => {
    const remaining = Math.max(0, offending.quota.limit - offending.quota.used);
    return (
      `此用戶（#${offending.id}）為免費會員，每月最多 ${offending.quota.limit} 次連線通知。\n`
      + `本月已使用 ${offending.quota.used} 次，剩餘 ${remaining} 次，`
      + '本次選取已達上限，無法再加入更多配對。\n\n'
      + `${MATCH_QUOTA_RESET_LABEL}。\n`
      + '如需超額發送，請升級對方為 Moonlight Passport，或改於下個月發送。'
    );
  };

  const toggleRow = (p) => {
    if (!isPairSelectable(p)) return;
    const key = pairKey(p);
    const isCurrentlyChecked = !!checked[key];

    // Unchecking is always allowed.
    if (isCurrentlyChecked) {
      setChecked((prev) => ({ ...prev, [key]: false }));
      return;
    }

    // Selecting: block if it would push a free user past their monthly limit —
    // unless manual override is on, in which case the quota is ignored.
    if (!quotaOverride) {
      const offending = pairProjectedQuotaExceed(p, selectedQuotaUsage);
      if (offending) {
        alert(describeQuotaExceed(offending));
        return;
      }
    }
    setChecked((prev) => ({ ...prev, [key]: true }));
  };

  const selectAll = () => {
    // Override mode: select every selectable pair, ignoring monthly quota.
    if (quotaOverride) {
      const next = {};
      visiblePairs.forEach((p) => {
        if (isPairSelectable(p)) next[pairKey(p)] = true;
      });
      setChecked(next);
      return;
    }
    // Greedily add pairs while respecting each free user's remaining quota.
    const runningUsage = new Map();
    const next = {};
    visiblePairs.forEach((p) => {
      if (!isPairSelectable(p)) return;
      if (pairProjectedQuotaExceed(p, runningUsage)) return;
      next[pairKey(p)] = true;
      for (const { id } of pairLimitedUsers(p)) {
        runningUsage.set(id, (runningUsage.get(id) || 0) + 1);
      }
    });
    setChecked(next);
  };

  const deselectAll = () => setChecked({});

  const { unsent: unsentCount, sent: sentCount, all: visibleTotalCount } = useMemo(
    () => countAutomationPairsBySent(pairs, { hideQuotaFull: effectiveHideQuotaFull, premiumOnly }),
    [pairs, effectiveHideQuotaFull, premiumOnly],
  );
  const selectedPairs = visiblePairs.filter((p) => isPairSelectable(p) && checked[pairKey(p)]);
  const selectedCount = selectedPairs.length;
  const skippedByQuota = useMemo(() => {
    if (quotaOverride) return 0;
    const runningUsage = new Map();
    let skipped = 0;
    visiblePairs.forEach((p) => {
      if (!isPairSelectable(p)) return;
      if (pairProjectedQuotaExceed(p, runningUsage)) {
        skipped += 1;
        return;
      }
      for (const { id } of pairLimitedUsers(p)) {
        runningUsage.set(id, (runningUsage.get(id) || 0) + 1);
      }
    });
    return skipped;
  }, [visiblePairs, quotaOverride]);

  // ─────────────────────────────────────────────────────────────────────────
  // Save draft
  // ─────────────────────────────────────────────────────────────────────────

  const resolvePairUsers = useCallback((pair) => {
    if (pair?.user_a?.email && pair?.user_b?.email) return pair;
    const key = automationPairKey(pair);
    if (!key) return pair;
    const fromPairs = pairs.find((p) => automationPairKey(p) === key);
    if (fromPairs) {
      return { ...pair, user_a: fromPairs.user_a, user_b: fromPairs.user_b };
    }
    const fromDraft = drafts.find((d) => automationPairKey(d) === key);
    if (fromDraft) {
      return { ...pair, user_a: fromDraft.user_a, user_b: fromDraft.user_b };
    }
    return pair;
  }, [pairs, drafts]);

  const handleSaveDraft = async () => {
    if (!selectedCount) return;
    const sameEmailAlert = buildSameEmailPairsAlert(selectedPairs);
    if (sameEmailAlert) {
      alert(sameEmailAlert);
      return;
    }
    setSavingDraft(true);
    try {
      const payload = selectedPairs.map((p) => ({
        userAId:         p.user_a_id,
        userBId:         p.user_b_id,
        match_score:     p.match_score,
        score_breakdown: p.score_breakdown || null,
      }));
      const res  = await apiFetch('/api/dashboard/create-gmail-drafts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pairs: payload }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`存入 Gmail 草稿失敗：${data.error}\n${data.hint || ''}`); return; }
      await Promise.all([fetchPairs(), fetchDrafts()]);
      setChecked({});
    } finally {
      setSavingDraft(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Send emails (for selected pairs OR a specific draft pair)
  // ─────────────────────────────────────────────────────────────────────────

  const doSend = async (pairsToSend, { deliverInbox = false } = {}) => {
    const enrichedPairs = pairsToSend.map(resolvePairUsers);
    const sameEmailAlert = buildSameEmailPairsAlert(enrichedPairs);
    if (sameEmailAlert) {
      alert(sameEmailAlert);
      return;
    }

    setSending(true);
    setSendResults(null);
    try {
      const payload = enrichedPairs.map((p) => ({
        userAId:         p.user_a_id ?? p.userAId,
        userBId:         p.user_b_id ?? p.userBId,
        match_score:     p.match_score,
        score_breakdown: p.score_breakdown || null,
      }));
      const res  = await apiFetch('/api/dashboard/send-emails', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pairs: payload, deliver_inbox: deliverInbox, skip_quota_check: quotaOverride }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(`發送失敗：${data.error || res.status}\n${data.hint || ''}`);
        return;
      }

      const hardFailures = (data.results || []).filter((r) => !r.recorded);
      const emailFailures = (data.results || []).filter(
        (r) => r.recorded && (r.deliveries || []).some((d) => d.delivered === false),
      );

      if (hardFailures.length) {
        const lines = hardFailures.map((r) => {
          if (r.error === 'same_email') {
            return `#${r.userAId}×#${r.userBId}: 雙方 Email 相同（${r.shared_email || '—'}）`;
          }
          const emailErrors = (r.deliveries || [])
            .filter((d) => d.delivered === false)
            .map((d) => d.error || d.reason)
            .filter(Boolean);
          const inboxReason = r.inbox?.reason;
          const inboxHint = r.inbox?.skipped ? '雙方均未註冊，略過 Inbox' : null;
          const inboxFail = r.inbox_delivered === false && (r.user_a_registered || r.user_b_registered)
            ? `Inbox 投送失敗（${inboxReason || r.error || '未知'}）`
            : null;
          return `#${r.userAId}×#${r.userBId}: ${emailErrors.join('; ') || inboxFail || inboxReason || inboxHint || r.error || '未知錯誤'}`;
        });
        alert(
          `部分配對未成功投送（可重新發送）：\n${lines.join('\n')}\n\n`
          + '若顯示 connect ETIMEDOUT 或 ENETUNREACH，代表本機無法連線 Gmail SMTP（常見：587 被封）。'
          + '請在 .env.local 設 GMAIL_SMTP_PORT=465 後重啟 dev server，'
          + '或改用「存入 Gmail 草稿」手動發送。',
        );
      } else if (emailFailures.length) {
        const lines = emailFailures.map((r) => {
          const emailErrors = (r.deliveries || [])
            .filter((d) => d.delivered === false)
            .map((d) => d.error || d.reason)
            .filter(Boolean);
          const inboxNote = r.inbox_delivered ? '（Inbox 已投送予已註冊用戶）' : '';
          return `#${r.userAId}×#${r.userBId}: 郵件失敗 ${emailErrors.join('; ')}${inboxNote}`;
        });
        alert(`部分配對郵件未送出，但 Inbox 可能已投送：\n${lines.join('\n')}`);
      }

      // Build a result map keyed by normalised pair key for inline display
      const resultMap = {};
      for (const r of data.results || []) {
        const [a, b] = r.userAId <= r.userBId ? [r.userAId, r.userBId] : [r.userBId, r.userAId];
        resultMap[`${a}:${b}`] = r;
      }
      setSendResults(resultMap);

      // Refresh data — jump to「已發送」so newly recorded pairs are visible
      const anyRecorded = (data.results || []).some((r) => r.recorded);
      await Promise.all([fetchPairs(), fetchDrafts()]);
      if (anyRecorded) setSentFilter('sent');
      setChecked({});
    } finally {
      setSending(false);
    }
  };

  const handleSendSelected = () => {
    if (!selectedCount) return;
    const hasRegistered = selectedPairs.some((p) => p.inbox_ready || p.user_a?.claimed || p.user_b?.claimed);
    const label = hasRegistered ? 'Email（雙方）+ Inbox（已註冊用戶）' : 'Email（雙方）';
    const overrideNote = quotaOverride ? '\n\n⚠ 手動發送模式已啟用：將忽略免費會員每月配額上限。' : '';
    if (!confirm(`確認發送 ${selectedCount} 對連線通知（${label}）？此操作不可撤回。${overrideNote}`)) return;
    doSend(selectedPairs, { deliverInbox: true });
  };

  const handleSendPremiumInstant = () => {
    const ready = (pairs || []).filter((p) => p.premium_instant_ready && !isAutomationPairSent(p));
    if (!ready.length) {
      alert('暫無可即時發送的 Moonlight Passport 連線（需雙方已認領問卷且配額未滿）');
      return;
    }
    if (!confirm(`確認即時發送 ${ready.length} 對 Moonlight Passport 連線（Email + Inbox）？`)) return;
    doSend(ready, { deliverInbox: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Draft actions
  // ─────────────────────────────────────────────────────────────────────────

  const handleDeleteDraft = async (draft) => {
    if (!confirm(`確認刪除此草稿？`)) return;
    setDraftActionId(draft.id);
    try {
      await apiFetch(`/api/dashboard/email-automation?draftId=${draft.id}`, { method: 'DELETE' });
      await fetchDrafts();
    } finally {
      setDraftActionId(null);
    }
  };

  const handleSendDraft = async (draft) => {
    if (!confirm('確認發送此連線通知？已註冊用戶會收到 Inbox 連線卡，雙方（如有信箱）均會收到 Email。')) return;
    setDraftActionId(draft.id);
    try {
      await doSend(draft, { deliverInbox: true });
    } finally {
      setDraftActionId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  function renderSendStatus(key) {
    if (!sendResults) return null;
    const r = sendResults[key];
    if (!r) return null;
    if (r.error) return <span className={`${styles.badge} ${styles.badgeError}`}>❌ 失敗</span>;
    // Draft result
    if (r.draftsCreated) {
      const allOk = r.draftsCreated.every((d) => d.saved || d.skipped);
      return allOk
        ? <span className={`${styles.badge} ${styles.badgeDraft}`}>📝 Gmail 草稿已建立</span>
        : <span className={`${styles.badge} ${styles.badgeError}`}>⚠ 部分失敗</span>;
    }
    // Send result
    const emailOk = (r.deliveries || []).every((d) => d.delivered || d.skipped);
    const inboxExpected = r.user_a_registered || r.user_b_registered;
    const inboxOk = !inboxExpected || r.inbox_delivered || r.inbox?.skipped;
    const allOk = emailOk && inboxOk;
    const recorded = r.recorded;
    if (!recorded) {
      const inboxFail = r.inbox_delivered === false && inboxExpected;
      return (
        <span className={`${styles.badge} ${styles.badgeError}`} title={r.inbox?.reason || r.error || ''}>
          {inboxFail ? '❌ Inbox 失敗' : '❌ 未投送'}
        </span>
      );
    }
    return allOk
      ? <span className={`${styles.badge} ${styles.badgeSuccess}`}>✅ 已送出</span>
      : <span className={`${styles.badge} ${styles.badgeError}`}>⚠ 部分失敗</span>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

        {/* ── Filter bar ─────────────────────────────────────────────────── */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>最低配對分數（0–100）</label>
            <input
              className={styles.filterInput}
              type="number"
              min={0}
              max={100}
              placeholder="例：60"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && initialLoad()}
            />
          </div>
          <button
            className={styles.loadBtn}
            onClick={initialLoad}
            disabled={loadingPairs}
          >
            {loadingPairs ? '計算中…' : '載入配對'}
          </button>
        </div>

        {loadError && (
          <div className={styles.loadError} role="alert">
            <strong>無法載入配對</strong>
            <p>{loadError}</p>
            <p className={styles.loadErrorHint}>
              請確認已用論壇管理員帳號登入；若剛改過環境變數／middleware，請重啟 server 後再試。
            </p>
          </div>
        )}

        {/* ── Moonlight Passport instant queue ───────────────────────────── */}
        {pairsSummary && (
          <div className={styles.premiumPanel}>
            <div className={styles.premiumPanelHead}>
              <div>
                <p className={styles.premiumPanelTitle}>⚡ Moonlight Passport 即時連線</p>
                <p className={styles.premiumPanelCopy}>
                  付費會員配額無限制。「Inbox 就緒」= 雙方已註冊。你撳發送 Email 時先會寄信；雙方都註冊先會一併投 Inbox。唔會自動寄。
                </p>
              </div>
              <button
                type="button"
                className={styles.premiumInstantBtn}
                onClick={handleSendPremiumInstant}
                disabled={sending || !pairsSummary.premium_instant_ready}
              >
                {sending ? '發送中…' : `即時發送全部（${pairsSummary.premium_instant_ready}）`}
              </button>
            </div>
            <div className={styles.premiumStats}>
              <span>🌙 含 Passport 配對：<strong>{pairsSummary.premium_pairs}</strong></span>
              <span>⚡ 可即時發送：<strong>{pairsSummary.premium_instant_ready}</strong></span>
              <span>⚠ 配額已滿：<strong>{pairsSummary.quota_blocked}</strong></span>
            </div>
          </div>
        )}

        {/* ── Manual override (ignore monthly quota) ─────────────────────── */}
        <div className={`${styles.overridePanel} ${quotaOverride ? styles.overridePanelActive : ''}`}>
          <label className={styles.overrideToggle}>
            <input
              type="checkbox"
              checked={quotaOverride}
              onChange={(e) => setQuotaOverride(e.target.checked)}
            />
            <span className={styles.overrideToggleLabel}>
              🛠 手動發送模式：忽略每月配額上限
            </span>
          </label>
          <p className={styles.overridePanelCopy}>
            啟用後可選取「配額已滿」的免費會員配對並強制發送連線通知，不受每月上限限制。
            此模式會顯示所有配額已滿的配對，請謹慎使用。
          </p>
        </div>

        {/* ── View mode tabs ─────────────────────────────────────────────── */}
        <div className={styles.viewTabs}>
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'all' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('all')}
          >
            全部配對
          </button>
          <button
            type="button"
            className={`${styles.viewTab} ${viewMode === 'premium' ? styles.viewTabActive : ''}`}
            onClick={() => setViewMode('premium')}
          >
            🌙 Moonlight Passport
          </button>
        </div>

        {pairs !== null && (
          <div className={styles.pairFilters}>
            <div className={styles.pairFiltersRow}>
              <span className={styles.pairFiltersLabel}>發送狀態</span>
              <div className={styles.pairFilterTabs} role="tablist" aria-label="發送狀態篩選">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sentFilter === 'unsent'}
                  className={`${styles.pairFilterTab} ${sentFilter === 'unsent' ? styles.pairFilterTabActive : ''}`}
                  onClick={() => setSentFilter('unsent')}
                >
                  未發送
                  <span className={styles.pairFilterCount}>{unsentCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sentFilter === 'sent'}
                  className={`${styles.pairFilterTab} ${sentFilter === 'sent' ? styles.pairFilterTabActive : ''}`}
                  onClick={() => setSentFilter('sent')}
                >
                  已發送
                  <span className={styles.pairFilterCount}>{sentCount}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sentFilter === 'all'}
                  className={`${styles.pairFilterTab} ${sentFilter === 'all' ? styles.pairFilterTabActive : ''}`}
                  onClick={() => setSentFilter('all')}
                >
                  全部
                  <span className={styles.pairFilterCount}>{visibleTotalCount}</span>
                </button>
              </div>
            </div>
            <label className={styles.pairFilterCheckbox}>
              <input
                type="checkbox"
                checked={hideQuotaFull}
                onChange={(e) => setHideQuotaFull(e.target.checked)}
              />
              隱藏配額已滿
            </label>
            <span className={styles.quotaResetHint} title={MATCH_QUOTA_RESET_LABEL}>
              免費會員配額：{MATCH_QUOTA_RESET_LABEL}
            </span>
          </div>
        )}

        {/* ── Global pairs table ─────────────────────────────────────────── */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>
              {viewMode === 'premium' ? 'Moonlight Passport 配對' : '全域配對清單'}
            </span>
            <div className={styles.bulkToolbar}>
              {pairs !== null && visiblePairs.length > 0 && (
                <>
                  <button type="button" className={styles.selectAllBtn} onClick={selectAll}>全選</button>
                  <button type="button" className={styles.selectAllBtn} onClick={deselectAll}>取消全選</button>
                </>
              )}
              {pairs !== null && (
                <span className={styles.countBadge}>
                  {visiblePairs.length}
                  {visiblePairs.length !== pairs.length ? ` / ${pairs.length}` : ''}
                  {' '}對
                </span>
              )}
              {skippedByQuota > 0 && (
                <span
                  className={`${styles.badge} ${styles.badgeQuota}`}
                  title="「全選」會自動略過會超出免費會員每月上限的配對"
                >
                  全選略過 {skippedByQuota} 對（配額上限）
                </span>
              )}
            </div>
          </div>

          <div className={styles.tableWrap}>
            {pairs === null ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🌙</span>
                設定分數門檻後點擊「載入配對」以查看所有符合條件的配對
              </div>
            ) : visiblePairs.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>🔍</span>
                {pairs.length > 0
                  ? (sentFilter === 'unsent'
                    ? '此篩選下暫無未發送配對 — 可切換至「已發送」或「全部」'
                    : sentFilter === 'sent'
                      ? '此篩選下暫無已發送配對'
                      : '篩選條件下暫無可顯示配對 — 可取消「隱藏配額已滿」查看配額已滿的未發送項目')
                  : '此分數門檻下暫無配對結果'}
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th></th>
                    <th>用戶 A</th>
                    <th>用戶 B</th>
                    <th>智能分</th>
                    {DIM_LABELS.map((l) => <th key={l}>{l}</th>)}
                    <th>狀態</th>
                    <th>發送結果</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePairs.map((p) => {
                    const key   = pairKey(p);
                    const selectable = isPairSelectable(p);
                    const isChk = selectable && !!checked[key];
                    // Projected-quota block: selecting this pair would exceed a
                    // free user's monthly limit given current batch selection.
                    const quotaProjection = !quotaOverride && !isChk && selectable
                      ? pairProjectedQuotaExceed(p, selectedQuotaUsage)
                      : null;
                    const batchBlocked = !!quotaProjection;
                    const pendingA = selectedQuotaUsage.get(Number(p.user_a_id)) || 0;
                    const pendingB = selectedQuotaUsage.get(Number(p.user_b_id)) || 0;
                    const b     = p.score_breakdown || {};
                    return (
                      <tr
                        key={key}
                        className={`${styles.tableRow} ${isChk ? styles.checked : ''} ${p.quota_blocked ? styles.quotaBlockedRow : ''} ${p.same_email_blocked ? styles.quotaBlockedRow : ''} ${(!selectable || batchBlocked) ? styles.rowNotSelectable : ''}`}
                        onClick={() => toggleRow(p)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={isChk}
                            disabled={!selectable || batchBlocked}
                            title={
                              p.same_email_blocked || pairHasSameEmail(p)
                                ? '雙方 Email 相同，無法發送'
                                : !selectable
                                  ? '配額已滿，無法選取'
                                  : batchBlocked
                                    ? `已達免費會員本月上限（${quotaProjection.quota.limit} 次），無法再選取此用戶的配對`
                                    : undefined
                            }
                            onChange={() => toggleRow(p)}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          <div className={styles.userCell}>
                            <AutomationUserLabel user={p.user_a} userId={p.user_a_id} />
                            <MatchQuotaBadge quota={p.user_a_quota} pendingInBatch={pendingA} />
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          <div className={styles.userCell}>
                            <AutomationUserLabel user={p.user_b} userId={p.user_b_id} />
                            <MatchQuotaBadge quota={p.user_b_quota} pendingInBatch={pendingB} />
                          </div>
                        </td>
                        <td>
                          <span className={styles.scoreBadge} style={{ color: scoreColor(p.match_score) }}>
                            {p.match_score}
                          </span>
                        </td>
                        {DIM_KEYS.map((k) => (
                          <td key={k} className={styles.dimScore}>{b[k] ?? '—'}</td>
                        ))}
                        <td>
                          {p.has_premium && (
                            <span className={`${styles.badge} ${styles.badgePremium}`}>🌙 Passport</span>
                          )}
                          {p.inbox_ready && !isAutomationPairSent(p) && (
                            <span
                              className={`${styles.badge} ${styles.badgeInbox}`}
                              title="雙方已註冊 — 撳發送 Email 時會寄信並投 Inbox；唔會自動寄"
                            >
                              Inbox 就緒
                            </span>
                          )}
                          {p.quota_blocked && !isAutomationPairSent(p) && (
                            <span className={`${styles.badge} ${styles.badgeQuota}`}>⚠ 配額已滿</span>
                          )}
                          {batchBlocked && !p.quota_blocked && !isAutomationPairSent(p) && (
                            <span className={`${styles.badge} ${styles.badgeQuota}`}>⚠ 本次已達上限</span>
                          )}
                          {(p.same_email_blocked || pairHasSameEmail(p)) && !isAutomationPairSent(p) && (
                            <span className={`${styles.badge} ${styles.badgeError}`}>⚠ 相同 Email</span>
                          )}
                          {isAutomationPairSent(p) && (
                            <span className={`${styles.badge} ${styles.badgeSent}`}>✉ 已發送</span>
                          )}
                          {isAutomationPairSent(p) && p.below_live_threshold && (
                            <span
                              className={`${styles.badge} ${styles.badgeDraft}`}
                              title="此配對已成功發送，但以目前分數門檻／過濾條件不會再出現在未發送清單"
                            >
                              歷史記錄
                            </span>
                          )}
                          {p.conduct_blocked && (
                            <span
                              className={`${styles.badge} ${styles.badgeError}`}
                              title={`Conduct 分數過低（A:${p.user_a_conduct ?? '—'} / B:${p.user_b_conduct ?? '—'}），唔會再入新配對`}
                            >
                              Conduct 過低
                            </span>
                          )}
                          {!isAutomationPairSent(p) && p.last_send_failed && (
                            <span
                              className={`${styles.badge} ${styles.badgeError}`}
                              title={
                                p.last_send_failed_at
                                  ? `上次發送失敗（${new Date(p.last_send_failed_at).toLocaleString('zh-HK')}），仍未成功投送，可重新發送。`
                                  : '上次發送失敗，仍未成功投送，可重新發送。'
                              }
                            >
                              ↻ 上次失敗·可重試
                            </span>
                          )}
                          {!isAutomationPairSent(p) && p.in_draft && (
                            <span className={`${styles.badge} ${styles.badgeDraft}`}>📝 草稿</span>
                          )}
                        </td>
                        <td>{renderSendStatus(key)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Draft queue ────────────────────────────────────────────────── */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>草稿佇列</span>
            {drafts !== null && (
              <span className={styles.countBadge}>{drafts.length} 個草稿</span>
            )}
          </div>

          <div className={styles.tableWrap}>
            {drafts === null ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>📝</span>
                {loadingDrafts ? <LoadingText as="span" /> : '點擊「載入配對」以同步草稿'}
              </div>
            ) : drafts.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>✨</span>
                草稿佇列是空的 — 從上方選取配對後點擊「存入草稿」
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>用戶 A</th>
                    <th>用戶 B</th>
                    <th>配對分數</th>
                    <th>建立時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => {
                    const dKey = `${Math.min(d.user_a_id, d.user_b_id)}:${Math.max(d.user_a_id, d.user_b_id)}`;
                    const busy = draftActionId === d.id || sending;
                    const draftSameEmail = pairHasSameEmail(d);
                    return (
                      <tr key={d.id} className={styles.tableRow}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          <AutomationUserLabel user={d.user_a} userId={d.user_a_id} />
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                          <AutomationUserLabel user={d.user_b} userId={d.user_b_id} />
                        </td>
                        <td>
                          <span className={styles.scoreBadge} style={{ color: scoreColor(d.match_score) }}>
                            {d.match_score ?? '—'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {d.created_at
                            ? new Date(d.created_at).toLocaleString('zh-HK', {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td>
                          <button
                            className={styles.draftSendBtn}
                            onClick={() => handleSendDraft(d)}
                            disabled={busy || draftSameEmail}
                            title={draftSameEmail ? '雙方 Email 相同，無法發送' : undefined}
                          >
                            {draftActionId === d.id && sending ? '發送中…' : '✉ 立即發送'}
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteDraft(d)}
                            disabled={busy}
                          >
                            刪除
                          </button>
                          {renderSendStatus(dKey)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      {/* ── Floating action bar ───────────────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className={styles.floatingBar}>
          <span className={styles.floatingBarLabel}>
            已選 {selectedCount} 對
            {quotaOverride && <span className={styles.floatingBarOverride}> · 忽略配額</span>}
          </span>
          <button
            className={styles.draftBtn}
            onClick={handleSaveDraft}
            disabled={savingDraft || sending}
          >
            {savingDraft ? '建立中…' : '📝 存入 Gmail 草稿'}
          </button>
          <button
            className={styles.sendBtn}
            onClick={handleSendSelected}
            disabled={sending || savingDraft}
          >
            {sending ? '發送中…' : quotaOverride ? '✉ 強制發送（忽略配額）' : '✉ 立即發送（Email + Inbox）'}
          </button>
        </div>
      )}
    </div>
  );
}
