/**
 * /wishes/new — create a moonlight wish (ritual compose UI)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import WishShell from '../../components/wishes/WishShell.js';
import { ForumLockIcon, ForumSparkleIcon, ForumEyeIcon } from '../../components/ForumIcons.js';
import { useAuth } from '../../lib/auth-context.js';
import { getHongKongDateParts } from '../../lib/hong-kong-time.js';
import {
  WISH_CATEGORIES,
  WISH_TITLE_MIN,
  WISH_TITLE_MAX,
  WISH_BODY_MAX,
  WISH_ACTIVE_LIMIT,
  WISH_TARGET_MAX_DAYS,
} from '../../lib/wishes.js';

const EXAMPLES = [
  '今個月讀完一本妳遲咗好耐嘅書',
  '一星期返嚟餵貓兩餐滿勤',
  '寫三篇圍爐真心話（唔一定徵友）',
  '連續七日早睡，唔熬夜刷手機',
  '約一位同類見面傾偈一次',
];

const DEADLINE_CHIPS = [
  { id: '3d', label: '3 天內', days: 3 },
  { id: '1w', label: '1 星期內', days: 7 },
  { id: '2w', label: '2 星期內', days: 14 },
  { id: '1m', label: '1 個月內', days: 30 },
  { id: 'custom', label: '自訂日期', days: null },
];

function hkPlusDays(days) {
  const { year, month, day } = getHongKongDateParts();
  const d = new Date(Date.UTC(year, month - 1, day + days));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function hkToday() {
  return hkPlusDays(0);
}

function hkMaxDate() {
  return hkPlusDays(WISH_TARGET_MAX_DAYS);
}

function spawnWishSparks(originEl) {
  if (!originEl || typeof document === 'undefined') return;
  const rect = originEl.getBoundingClientRect();
  const root = document.createElement('div');
  root.className = 'wish-spark-layer';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 14; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'wish-spark';
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.35;
    const dist = 28 + Math.random() * 42;
    spark.style.left = `${cx}px`;
    spark.style.top = `${cy}px`;
    spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    spark.style.setProperty('--dy', `${Math.sin(angle) * dist - 12}px`);
    spark.style.setProperty('--delay', `${i * 12}ms`);
    root.appendChild(spark);
  }
  window.setTimeout(() => root.remove(), 900);
}

export default function WishNewPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const didRedirect = useRef(false);
  const submitBtnRef = useRef(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('習慣');
  const [visibility, setVisibility] = useState('public');
  const [deadlineChip, setDeadlineChip] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [activeCount, setActiveCount] = useState(null);
  const [firstCreateBonus, setFirstCreateBonus] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [hintIdx, setHintIdx] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || session || didRedirect.current) return;
    didRedirect.current = true;
    router.replace('/login?redirect=/wishes/new');
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/wishes?limit=20', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        const n = (data.wishes || []).filter((w) => w.status === 'active').length;
        setActiveCount(n);
        setFirstCreateBonus(Boolean(data.first_create_bonus_available));
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [session?.access_token]);

  useEffect(() => {
    if (title.trim()) return undefined;
    const t = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % EXAMPLES.length);
    }, 3400);
    return () => window.clearInterval(t);
  }, [title]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setHintIdx((i) => {
        let next = (i + 1) % EXAMPLES.length;
        if (next === placeholderIdx) next = (next + 1) % EXAMPLES.length;
        return next;
      });
    }, 4800);
    return () => window.clearInterval(t);
  }, [placeholderIdx]);

  const targetAt = useMemo(() => {
    if (deadlineChip === 'custom') return customDate || '';
    if (!deadlineChip) return '';
    const chip = DEADLINE_CHIPS.find((c) => c.id === deadlineChip);
    if (!chip?.days) return '';
    return hkPlusDays(chip.days);
  }, [deadlineChip, customDate]);

  const titleLen = Array.from(title).length;
  const quotaFull = activeCount != null && activeCount >= WISH_ACTIVE_LIMIT;
  const deadlineOk = deadlineChip !== 'custom' || Boolean(customDate);
  const canSubmit = titleLen >= WISH_TITLE_MIN && !quotaFull && !submitting && deadlineOk;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!session?.access_token || !canSubmit) return;
    spawnWishSparks(submitBtnRef.current);
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          body: body || null,
          category,
          visibility,
          target_at: targetAt ? `${targetAt}T23:59:59+08:00` : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '建立失敗');
        return;
      }
      router.replace(`/wishes/${data.wish.id}`);
    } catch {
      setError('網絡錯誤');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !session) {
    return (
      <WishShell title="設立心願" redirectPath="/wishes/new">
        <p className="wishes-status">載入中…</p>
      </WishShell>
    );
  }

  return (
    <>
      <SeoHead title="設立心願" path="/wishes/new" noindex />
      <WishShell title="設立心願" redirectPath="/wishes/new" backHref="/wishes" backLabel="心願牆">
        <div className="wish-compose">
        <header className="wish-compose__hero">
          <div className="wish-compose__hero-text">
            <p className="wish-compose__eyebrow">
              <ForumSparkleIcon size={12} />
              設立月光心願
            </p>
            <h1 className="wish-compose__title">寫下一件近期想完成的小事</h1>
            <p className="wish-compose__lead">讓同類為你打氣。慢節奏、低壓——唔係強制打卡，係一齊變好。</p>
          </div>
          <div
            className={`wish-compose__quota${quotaFull ? ' is-full' : ''}`}
            title={`同時最多 ${WISH_ACTIVE_LIMIT} 個進行中`}
          >
            <span className="wish-compose__quota-label">進行中</span>
            <span className="wish-compose__quota-value">
              {activeCount == null ? '…' : activeCount}
              <span className="wish-compose__quota-max"> / {WISH_ACTIVE_LIMIT}</span>
            </span>
          </div>
        </header>

        <form className="wish-form wish-form--compose" onSubmit={handleSubmit}>
          <fieldset className="wish-compose__field">
            <legend>心願內容</legend>
            <div className={`wish-compose__title-box${titleLen > 0 && titleLen < WISH_TITLE_MIN ? ' is-invalid' : ''}`}>
              <textarea
                className="wish-compose__title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, WISH_TITLE_MAX))}
                placeholder={EXAMPLES[placeholderIdx]}
                required
                minLength={WISH_TITLE_MIN}
                maxLength={WISH_TITLE_MAX}
                rows={2}
                aria-invalid={titleLen > 0 && titleLen < WISH_TITLE_MIN}
                aria-describedby={`wish-title-hint wish-title-count${titleLen > 0 && titleLen < WISH_TITLE_MIN ? ' wish-title-error' : ''}`}
              />
              <span
                id="wish-title-count"
                className={`wish-compose__count${titleLen > 0 && titleLen < WISH_TITLE_MIN ? ' is-short' : ''}${titleLen >= WISH_TITLE_MAX ? ' is-max' : ''}`}
              >
                {titleLen} / {WISH_TITLE_MAX}
              </span>
            </div>
            {titleLen > 0 && titleLen < WISH_TITLE_MIN && (
              <p id="wish-title-error" className="wish-compose__field-error" role="alert">
                心願內容至少要 {WISH_TITLE_MIN} 個字（而家 {titleLen} 字），再寫多幾句啦。
              </p>
            )}
            <p
              id="wish-title-hint"
              key={hintIdx}
              className="wish-compose__rotating-hint"
              aria-live="polite"
            >
              例如：{EXAMPLES[hintIdx]}
            </p>
          </fieldset>

          <fieldset className="wish-compose__field">
            <legend>說明 <span className="wish-compose__optional">選填</span></legend>
            <textarea
              className="wish-compose__body-input"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, WISH_BODY_MAX))}
              maxLength={WISH_BODY_MAX}
              placeholder="想點樣完成？有咩需要同類知道？"
              rows={3}
            />
          </fieldset>

          <fieldset className="wish-compose__field">
            <legend>心願類別</legend>
            <div className="wish-compose__pills" role="radiogroup" aria-label="心願類別">
              {WISH_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  className={`wish-compose__pill${category === c ? ' is-active' : ''}`}
                  data-cat={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="wish-compose__field">
            <legend>預計完成時間 <span className="wish-compose__optional">選填</span></legend>
            <div className="wish-compose__pills wish-compose__pills--deadline" role="radiogroup" aria-label="預計完成時間">
              <button
                type="button"
                role="radio"
                aria-checked={!deadlineChip}
                className={`wish-compose__pill${!deadlineChip ? ' is-active' : ''}`}
                onClick={() => { setDeadlineChip(''); setCustomDate(''); }}
              >
                不設期限
              </button>
              {DEADLINE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  role="radio"
                  aria-checked={deadlineChip === chip.id}
                  className={`wish-compose__pill${deadlineChip === chip.id ? ' is-active' : ''}`}
                  onClick={() => {
                    setDeadlineChip(chip.id);
                    if (chip.id !== 'custom') setCustomDate('');
                  }}
                >
                  {chip.id === 'custom' ? (
                    <>
                      <span aria-hidden="true">📅 </span>
                      {chip.label}
                    </>
                  ) : chip.label}
                </button>
              ))}
            </div>
            {deadlineChip === 'custom' && (
              <label className="wish-compose__custom-date is-open">
                <span className="wish-compose__custom-date-label">選擇日期</span>
                <input
                  type="date"
                  value={customDate}
                  min={hkToday()}
                  max={hkMaxDate()}
                  onChange={(e) => setCustomDate(e.target.value)}
                  required
                />
              </label>
            )}
            {targetAt && deadlineChip && deadlineChip !== 'custom' && (
              <p className="wish-compose__deadline-preview">目標日：{targetAt}</p>
            )}
          </fieldset>

          <fieldset className="wish-compose__field">
            <legend>可見設定</legend>
            <div className="wish-compose__vis" role="radiogroup" aria-label="可見設定">
              <button
                type="button"
                role="radio"
                aria-checked={visibility === 'public'}
                className={`wish-compose__vis-card${visibility === 'public' ? ' is-active' : ''}`}
                onClick={() => setVisibility('public')}
              >
                <span className="wish-compose__vis-check" aria-hidden="true">✓</span>
                <span className="wish-compose__vis-icon" aria-hidden="true">
                  <ForumEyeIcon size={18} />
                </span>
                <span className="wish-compose__vis-copy">
                  <strong>公開</strong>
                  <span>心願牆可見，接受大家打氣</span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={visibility === 'members'}
                className={`wish-compose__vis-card${visibility === 'members' ? ' is-active' : ''}`}
                onClick={() => setVisibility('members')}
              >
                <span className="wish-compose__vis-check" aria-hidden="true">✓</span>
                <span className="wish-compose__vis-icon" aria-hidden="true">
                  <ForumLockIcon size={18} />
                </span>
                <span className="wish-compose__vis-copy">
                  <strong>較安靜</strong>
                  <span>社群可見，安靜記錄</span>
                </span>
              </button>
            </div>
          </fieldset>

          {quotaFull && (
            <p className="wishes-error" style={{ textAlign: 'left' }}>
              同時最多 {WISH_ACTIVE_LIMIT} 個進行中。請先完成或放棄其中一個。
            </p>
          )}
          {error && <p className="wishes-error" style={{ textAlign: 'left' }}>{error}</p>}

          <div className="wish-form__actions wish-compose__actions">
            <Link href="/wishes" className="wishes-btn wishes-btn--ghost">← 返回</Link>
            <button
              ref={submitBtnRef}
              type="submit"
              className={`wishes-btn wishes-btn--primary wish-compose__cta${canSubmit ? ' is-ready' : ''}`}
              disabled={!canSubmit}
            >
              <ForumSparkleIcon size={14} />
              {submitting
                ? '許願中…'
                : visibility === 'public' && firstCreateBonus
                  ? '許下心願 (+1碎屑)'
                  : '許下心願'}
            </button>
          </div>
          {visibility === 'public' && firstCreateBonus && (
            <p className="wish-compose__cta-note">首次公開設立可獲 +1 月光碎屑（終身一次）。</p>
          )}
          {!firstCreateBonus && (
            <p className="wish-compose__cta-note">完成心願時可獲 +3 月光碎屑。</p>
          )}
        </form>
        </div>
      </WishShell>
    </>
  );
}
