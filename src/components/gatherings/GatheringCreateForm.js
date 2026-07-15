/**
 * Create gathering form.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context.js';
import { defaultStartsLocalForHkDate } from '../../lib/gathering-calendar.js';
import {
  GATHERING_CUSTOM_TAG_MAX_LEN,
  GATHERING_MAX_TAGS,
  gatheringTagLabel,
  isPresetGatheringTag,
  normalizeGatheringTagToken,
} from '../../lib/gathering-tags.js';
import {
  HK_DISTRICTS,
  GATHERING_LOCATION_ONLINE,
} from '../../lib/gathering-districts.js';
import GatheringSafetyNotice from './GatheringSafetyNotice.js';
import LoadingText from '../LoadingText.js';

function toLocalInputValue(date = new Date(Date.now() + 2 * 60 * 60 * 1000)) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function GatheringCreateForm({ meta }) {
  const router = useRouter();
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [customTagDraft, setCustomTagDraft] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [startsAt, setStartsAt] = useState(toLocalInputValue());
  const [locationPublic, setLocationPublic] = useState('');
  const [locationPrivate, setLocationPrivate] = useState('');
  const [hostEmail, setHostEmail] = useState(() => session?.user?.email || '');
  const [hostPhone, setHostPhone] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(meta?.gates?.default_max_participants || 8);
  const [requireKnock, setRequireKnock] = useState(true);
  const [knockQuestion, setKnockQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const customTags = tags.filter((t) => !isPresetGatheringTag(t));
  const atTagLimit = tags.length >= GATHERING_MAX_TAGS;
  const districts = meta?.districts?.length ? meta.districts : HK_DISTRICTS;
  const onlineLabel = meta?.location_online || GATHERING_LOCATION_ONLINE;

  useEffect(() => {
    if (session?.user?.email && !hostEmail) {
      setHostEmail(session.user.email);
    }
  }, [session?.user?.email, hostEmail]);

  useEffect(() => {
    if (meta?.gates?.default_max_participants) {
      setMaxParticipants(meta.gates.default_max_participants);
    }
  }, [meta]);

  useEffect(() => {
    if (isOnline) {
      setLocationPublic(onlineLabel);
      return;
    }
    setLocationPublic((prev) => (prev === onlineLabel ? '' : prev));
  }, [isOnline, onlineLabel]);

  useEffect(() => {
    if (!router.isReady) return;
    const dateKey = typeof router.query.date === 'string' ? router.query.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const local = defaultStartsLocalForHkDate(dateKey);
    if (local) setStartsAt(local);
  }, [router.isReady, router.query.date]);

  function toggleTag(id) {
    setTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : (
      prev.length >= GATHERING_MAX_TAGS ? prev : [...prev, id]
    )));
  }

  function addCustomTag() {
    const token = normalizeGatheringTagToken(customTagDraft);
    if (!token) {
      setError(`自訂標籤需 1–${GATHERING_CUSTOM_TAG_MAX_LEN} 字（文字／數字）。`);
      return;
    }
    if (tags.includes(token)) {
      setCustomTagDraft('');
      setError('');
      return;
    }
    if (tags.length >= GATHERING_MAX_TAGS) {
      setError(`最多揀／加 ${GATHERING_MAX_TAGS} 個標籤。`);
      return;
    }
    setTags((prev) => [...prev, token]);
    setCustomTagDraft('');
    setError('');
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!session?.access_token) {
      setError('請先登入。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const startsIso = new Date(startsAt).toISOString();
      const res = await fetch('/api/gatherings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          description: description || null,
          tags,
          is_online: isOnline,
          starts_at: startsIso,
          location_public: locationPublic,
          location_private: locationPrivate || null,
          host_email: hostEmail,
          host_phone: hostPhone,
          max_participants: Number(maxParticipants),
          require_knock_message: requireKnock,
          knock_question: requireKnock ? knockQuestion : null,
          allowed_mirror_families: null,
          min_moon_level: 1,
          approval_mode: 'manual',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '發起失敗');
        return;
      }
      router.push(`/gatherings/${data.gathering.id}`);
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="gathering-form" onSubmit={onSubmit}>
      <GatheringSafetyNotice />

      <label className="gathering-form__field">
        <span>聚會主題 *</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} required placeholder="例如：旺角深夜桌遊局" />
      </label>

      <label className="gathering-form__field">
        <span>活動描述</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={800} rows={4} placeholder="告訴大家氣氛、規則、準備事項…" />
      </label>

      <fieldset className="gathering-form__field">
        <legend>活動標籤（最多 {GATHERING_MAX_TAGS} 個）</legend>
        <div className="gathering-form__chips">
          {(meta?.tags || []).map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`gathering-form__chip${tags.includes(tag.id) ? ' is-on' : ''}`}
              onClick={() => toggleTag(tag.id)}
              disabled={!tags.includes(tag.id) && atTagLimit}
            >
              {tag.label}
            </button>
          ))}
          {customTags.map((tag) => (
            <button
              key={`custom-${tag}`}
              type="button"
              className="gathering-form__chip is-on gathering-form__chip--custom"
              onClick={() => toggleTag(tag)}
              title="再撳一次移除"
            >
              {gatheringTagLabel(tag)}
            </button>
          ))}
        </div>
        <div className="gathering-form__custom-tag">
          <input
            value={customTagDraft}
            onChange={(e) => setCustomTagDraft(e.target.value)}
            maxLength={GATHERING_CUSTOM_TAG_MAX_LEN}
            placeholder="自訂標籤，例如：泡麵夜"
            disabled={atTagLimit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomTag();
              }
            }}
            aria-label="自訂標籤"
          />
          <button
            type="button"
            className="gathering-form__custom-tag-add"
            onClick={addCustomTag}
            disabled={atTagLimit || !customTagDraft.trim()}
          >
            加入
          </button>
        </div>
        <p className="gathering-form__hint">可揀預設標籤，或自己加一個（唔使加 #）。</p>
      </fieldset>

      <fieldset className="gathering-form__field gathering-form__row gathering-form__mode">
        <legend className="gathering-form__mode-legend">聚會形式</legend>
        <div className="gathering-form__mode-options" role="radiogroup" aria-label="聚會形式">
          <label className={`gathering-form__mode-opt${!isOnline ? ' is-on' : ''}`}>
            <input type="radio" checked={!isOnline} onChange={() => setIsOnline(false)} />
            <span>線下</span>
          </label>
          <label className={`gathering-form__mode-opt${isOnline ? ' is-on' : ''}`}>
            <input type="radio" checked={isOnline} onChange={() => setIsOnline(true)} />
            <span>線上</span>
          </label>
        </div>
      </fieldset>

      <label className="gathering-form__field">
        <span>開始時間 *</span>
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
      </label>

      <label className="gathering-form__field">
        <span>{isOnline ? '公開區域 *' : '公開區域（18 區）*'}</span>
        {isOnline ? (
          <input value={onlineLabel} readOnly aria-readonly="true" />
        ) : (
          <select
            value={locationPublic}
            onChange={(e) => setLocationPublic(e.target.value)}
            required
          >
            <option value="" disabled>
              請選擇區域
            </option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </label>

      <label className="gathering-form__field">
        <span>私密地址／連結（僅批准者可見）</span>
        <input
          value={locationPrivate}
          onChange={(e) => setLocationPrivate(e.target.value)}
          maxLength={500}
          placeholder={isOnline ? 'Discord / Meet 連結' : '詳細地址'}
        />
      </label>

      <fieldset className="gathering-form__field gathering-form__contact">
        <legend>聯絡資料（僅批准參加者可見）*</legend>
        <label className="gathering-form__field">
          <span>電郵 *</span>
          <input
            type="email"
            value={hostEmail}
            onChange={(e) => setHostEmail(e.target.value)}
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
            value={hostPhone}
            onChange={(e) => setHostPhone(e.target.value)}
            maxLength={20}
            required
            autoComplete="tel"
            placeholder="例如：91234567 或 +85291234567"
          />
        </label>
        <p className="gathering-form__hint">方便聯絡；電郵同電話唔會公開顯示喺活動頁／列表。</p>
      </fieldset>

      <label className="gathering-form__field">
        <span>人數上限（2–30）</span>
        <input type="number" min={2} max={30} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
      </label>

      <label className="gathering-form__field gathering-form__check">
        <input type="checkbox" checked={requireKnock} onChange={(e) => setRequireKnock(e.target.checked)} />
        <span>要求敲門暗號</span>
      </label>

      {requireKnock && (
        <label className="gathering-form__field">
          <span>敲門問題 *</span>
          <input
            value={knockQuestion}
            onChange={(e) => setKnockQuestion(e.target.value)}
            maxLength={80}
            required
            placeholder="例如：你最鍾意邊隻桌遊？／點解想來呢場？"
          />
          <p className="gathering-form__hint">參加者申請時要回答呢條問題，你先見到答案再決定批唔批准。</p>
        </label>
      )}

      {error && <p className="gathering-form__error" role="alert">{error}</p>}

      <button type="submit" className="gathering-form__submit" disabled={busy}>
        {busy ? <LoadingText as="span" label="提交中..." /> : '發起聚會'}
      </button>
    </form>
  );
}
