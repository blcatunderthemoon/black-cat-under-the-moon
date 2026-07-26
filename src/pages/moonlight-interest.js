/**
 * /moonlight-interest — Moonlight Gathering #001 interest survey (email outreach).
 * Public (no login required). No site nav / footer entry; noindex.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { canAdminForum } from '../lib/forum-roles.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import SeoHead from '../components/SeoHead.js';
import {
  ForumClockIcon,
  ForumGamepadIcon,
  ForumMoonIcon,
  ForumPawIcon,
  HeaderCalendarIcon,
  HeaderChatIcon,
  HeaderMailIcon,
  HeaderUserPlusIcon,
  UiHomeIcon,
  UiTvIcon,
} from '../components/UiIcons.js';

const INTEREST_OPTIONS = [
  { value: 'interested', label: '有興趣，希望收到優先通知' },
  { value: 'unsure', label: '暫時未能確定' },
  { value: 'skip', label: '今次唔參加' },
];

const TIME_SLOT_OPTIONS = [
  { value: 'sat_afternoon', label: '星期六下午' },
  { value: 'sat_eve', label: '星期六晚上' },
  { value: 'sun_afternoon', label: '星期日下午' },
  { value: 'sun_eve', label: '星期日晚上' },
];

const PRICE_OPTIONS = [
  { value: '250-300', label: '$250–300' },
  { value: '300-350', label: '$300–350' },
  { value: '350-400', label: '$350–400' },
];

const DATE_GROUPS = [
  {
    label: '8 月',
    dates: [
      { value: '2026-08-15', label: '8/15（六）' },
      { value: '2026-08-16', label: '8/16（日）' },
      { value: '2026-08-22', label: '8/22（六）' },
      { value: '2026-08-23', label: '8/23（日）' },
      { value: '2026-08-29', label: '8/29（六）' },
      { value: '2026-08-30', label: '8/30（日）' },
    ],
  },
  {
    label: '9 月',
    dates: [
      { value: '2026-09-05', label: '9/5（六）' },
      { value: '2026-09-06', label: '9/6（日）' },
      { value: '2026-09-12', label: '9/12（六）' },
      { value: '2026-09-13', label: '9/13（日）' },
      { value: '2026-09-19', label: '9/19（六）' },
      { value: '2026-09-20', label: '9/20（日）' },
      { value: '2026-09-26', label: '9/26（六）' },
      { value: '2026-09-27', label: '9/27（日）' },
    ],
  },
];

const EVENT_META = [
  { icon: HeaderUserPlusIcon, label: '對象 Label', value: 'Pure' },
  { icon: ForumPawIcon, label: '年齡範圍', value: '23–34 歲' },
  { icon: ForumClockIcon, label: '活動時間', value: '3.5 – 4 小時' },
];

const SCHEDULE = [
  {
    id: 'checkin',
    title: 'Check In',
    summary: '領取名牌、Bingo 卡',
  },
  {
    id: 'host',
    title: '主持介紹',
    summary: '流程、規則、尊重與保密',
  },
  {
    id: 'icebreak',
    title: 'Ice Breaking · 35 分鐘',
    summary: 'Bingo → 兩真一假 → 找同類',
    expand: [
      {
        icon: ForumGamepadIcon,
        title: '尋貓 Bingo',
        body: '按報名資料生成格仔（例如養貓、去過日本、玩 Board Game…）。全場走動搵人簽名，同一人最多簽兩格；完成可獲小禮物。目的：逼大家主動講第一句。',
      },
      {
        title: '其餘破冰',
        body: '兩真一假（4 人一組互估）、找同類（主持出題分邊再分享），由淺入深熱場。',
      },
    ],
  },
  {
    id: 'ppt',
    title: 'PowerPoint Pitch · 45 分鐘',
    summary: '每人 3 分鐘，最多 5 頁',
    expand: [
      {
        icon: UiTvIcon,
        title: '分享規則',
        body: '每人 3 分鐘、最多 5 頁，主題自由（我是誰、旅行、貓、Meme…）。',
      },
    ],
  },
  {
    id: 'table',
    title: 'Table Chat · 45 分鐘',
    summary: '4 人一組，Topic Card，3 輪換桌',
    expand: [
      {
        icon: HeaderChatIcon,
        title: 'Topic Card · 約 100 張',
        body: 'Black Cat Under The Moon 自家設計嘅話題卡，分三大類：Ice Break（最近笑得最開心？）、深度（點理解陪伴？）、趣味（如果變一隻動物？）。每輪抽卡傾，每 15 分鐘換桌，共 3 輪。',
      },
    ],
  },
  {
    id: 'free',
    title: '自由交流 · 15–30 分鐘',
    summary: '休息、飲嘢、交換聯絡',
  },
  {
    id: 'mail',
    title: 'Moonlight Mail · 15–30 分鐘',
    summary: '活動後配對／聯絡機制',
    expand: [
      {
        icon: HeaderMailIcon,
        title: 'Moonlight Mail',
        body: '活動尾段以聯絡卡／配對機制收束，方便想繼續認識嘅人接上線。',
      },
    ],
  },
];

const FEATURES = [
  { icon: HeaderUserPlusIcon, label: '12 人小型聚會' },
  { icon: UiHomeIcon, label: 'Party Room' },
  { icon: ForumGamepadIcon, label: '破冰遊戲（尋貓 Bingo）' },
  { icon: UiTvIcon, label: '3 分鐘 PowerPoint 分享' },
  { icon: HeaderChatIcon, label: 'Topic Card 小組聊天' },
  { icon: HeaderMailIcon, label: 'Moonlight Mail（活動後配對通知）' },
];

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function MoonlightInterestPage() {
  const { session, profile, displayName: authDisplayName, loading: authLoading } = useAuth();
  const isAdmin = canAdminForum(profile?.profile?.forum_role);
  const [interest, setInterest] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [dates, setDates] = useState([]);
  const [priceRange, setPriceRange] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [openScheduleId, setOpenScheduleId] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftMsg, setDraftMsg] = useState('');
  const [draftErr, setDraftErr] = useState('');

  const showFollowUp = interest === 'interested';

  // Prefill from session when already logged in — never require login.
  useEffect(() => {
    if (authLoading || !session) return;
    const sessionEmail = session.user?.email || '';
    if (sessionEmail) {
      setEmail((prev) => prev || sessionEmail);
    }
    if (authDisplayName) {
      setDisplayName((prev) => prev || authDisplayName);
    }
  }, [authLoading, session, authDisplayName]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!interest) {
      setError('請選擇是否有興趣參加。');
      return;
    }

    if (showFollowUp) {
      if (!timeSlots.length) {
        setError('請至少揀一個可參加時段。');
        return;
      }
      if (!dates.length) {
        setError('請至少揀一個可參加日期。');
        return;
      }
      if (!priceRange) {
        setError('請選擇可以接受嘅收費範圍。');
        return;
      }
      if (!email.trim()) {
        setError('請留下電郵方便優先通知。');
        return;
      }
      if (!displayName.trim()) {
        setError('請填寫稱呼。');
        return;
      }
      if (!message.trim()) {
        setError('請留下訊息。');
        return;
      }
    }

    setSubmitting(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch('/api/moonlight-interest', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          interest,
          time_slots: showFollowUp ? timeSlots : [],
          dates: showFollowUp ? dates : [],
          price_range: showFollowUp ? priceRange || null : null,
          email: email.trim() || null,
          display_name: displayName.trim() || null,
          message: showFollowUp ? message.trim() : null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || '無法儲存回覆，請稍後再試。');
        return;
      }
      setDone(true);
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateGmailDraft(e) {
    e.preventDefault();
    setDraftMsg('');
    setDraftErr('');
    if (!session?.access_token) {
      setDraftErr('請先以管理員帳號登入。');
      return;
    }
    setDraftBusy(true);
    try {
      const resp = await fetch('/api/dashboard/moonlight-interest-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: draftTo.trim() || undefined,
          recipient_name: draftName.trim() || undefined,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setDraftErr([data.error, data.hint].filter(Boolean).join(' '));
        return;
      }
      setDraftMsg(data.message || '已存入 Gmail 草稿（未發送）。');
    } catch {
      setDraftErr('網絡錯誤，請稍後再試。');
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Moonlight Gathering 意見調查"
        description="Moonlight Gathering #001 興趣調查 — 12 人限定小型聚會，8–9 月試辦。"
        path="/moonlight-interest"
        noindex
      />
      <AppShell
        title="Moonlight Gathering"
        headerVariant="account"
        backHref="/index.html"
        maxWidth="680px"
        pageClassName="app-page--moonlight-interest"
        nav={session ? <AppHeaderAuth redirectPath="/moonlight-interest" /> : null}
      >
        <article className="mi-page">
          <header className="mi-hero">
            <p className="mi-hero__kicker">
              <ForumMoonIcon size={14} />
              <span>Interest Survey</span>
            </p>
            <h1 className="mi-hero__title">Moonlight Gathering #001</h1>
            <p className="mi-hero__guest-note">唔使登入都可以填寫；約一分鐘。</p>
            <p className="mi-hero__lead">
              Black Cat 一直都希望，唔止係一個配對網站，而係一個可以真正認識新朋友、建立連結嘅地方。
            </p>
            <p className="mi-hero__lead">
              所以我哋正計劃於 <strong>8–9 月</strong> 試辦第一場 Moonlight Gathering。
            </p>
            <p className="mi-hero__lead">
              今次會係一場 <strong>12 人限定</strong> 嘅小型聚會，希望透過遊戲、故事分享同輕鬆聊天，令大家自然認識彼此，而唔係傳統 Speed Dating。
            </p>
          </header>

          <section className="mi-card" aria-labelledby="mi-meta-title">
            <h2 id="mi-meta-title" className="mi-card__title">
              <HeaderCalendarIcon size={15} />
              活動資訊
            </h2>
            <dl className="mi-meta">
              {EVENT_META.map(({ icon: Icon, label, value }) => (
                <div key={label} className="mi-meta__row">
                  <dt className="mi-meta__label">
                    <span className="mi-meta__icon" aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    {label}
                  </dt>
                  <dd className="mi-meta__value">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mi-card" aria-labelledby="mi-features-title">
            <h2 id="mi-features-title" className="mi-card__title">
              <ForumPawIcon size={15} />
              活動特色
            </h2>
            <ul className="mi-features">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="mi-features__item">
                  <span className="mi-features__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mi-card" aria-labelledby="mi-overview-title">
            <h2 id="mi-overview-title" className="mi-card__title">
              <ForumClockIcon size={15} />
              活動簡介
            </h2>
            <p className="mi-hint mi-hint--tight">有詳情嘅環節可點擊展開。</p>
            <ul className="mi-schedule">
              {SCHEDULE.map((item) => {
                const hasExpand = Array.isArray(item.expand) && item.expand.length > 0;
                const isOpen = openScheduleId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`mi-schedule__item${hasExpand ? ' mi-schedule__item--expandable' : ''}${isOpen ? ' is-open' : ''}`}
                  >
                    {hasExpand ? (
                      <button
                        type="button"
                        className="mi-schedule__toggle"
                        aria-expanded={isOpen}
                        onClick={() => setOpenScheduleId(isOpen ? '' : item.id)}
                      >
                        <span className="mi-schedule__body">
                          <span className="mi-schedule__title">{item.title}</span>
                          <span className="mi-schedule__detail">{item.summary}</span>
                        </span>
                        <span className="mi-schedule__chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                      </button>
                    ) : (
                      <div className="mi-schedule__body">
                        <span className="mi-schedule__title">{item.title}</span>
                        <span className="mi-schedule__detail">{item.summary}</span>
                      </div>
                    )}
                    {hasExpand && isOpen && (
                      <div className="mi-schedule__panel">
                        {item.expand.map((block) => {
                          const Icon = block.icon;
                          return (
                            <div key={block.title} className="mi-schedule__panel-block">
                              <p className="mi-schedule__panel-title">
                                {Icon ? (
                                  <span className="mi-schedule__panel-icon" aria-hidden="true">
                                    <Icon size={15} />
                                  </span>
                                ) : null}
                                {block.title}
                              </p>
                              <p className="mi-schedule__panel-body">{block.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mi-overview-note">全程強調互相尊重同保密。</p>
          </section>

          {done ? (
            <section className="mi-card mi-card--success" aria-live="polite">
              <h2 className="mi-card__title">
                <HeaderMailIcon size={15} />
                多謝你嘅回覆
              </h2>
              <p className="mi-success-copy">
                {interest === 'interested'
                  ? '已收到你嘅興趣同檔期偏好。若有適合場次，會優先通知你。'
                  : interest === 'unsure'
                    ? '已收到你嘅回覆。稍後若有更多詳情，或者會再問一次。'
                    : '已收到你嘅回覆，多謝抽時間填寫。'}
              </p>
            </section>
          ) : (
            <form className="mi-card mi-form" onSubmit={handleSubmit} noValidate>
              <h2 className="mi-card__title">
                <HeaderCalendarIcon size={15} />
                妳會有興趣參加嗎？
              </h2>

              <fieldset className="mi-fieldset">
                <legend className="mi-sr-only">興趣程度</legend>
                <div className="mi-choice-list" role="radiogroup" aria-label="妳會有興趣參加嗎？">
                  {INTEREST_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`mi-choice${interest === opt.value ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="interest"
                        value={opt.value}
                        checked={interest === opt.value}
                        onChange={() => setInterest(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {showFollowUp && (
                <div className="mi-followup">
                  <fieldset className="mi-fieldset">
                    <legend className="mi-legend">可以參加日期（可多選）<span className="mi-field__req">必填</span></legend>
                    <p className="mi-hint">請揀慣常時段同具體日子，兩邊都要最少揀一個。</p>
                    <div className="mi-chip-grid">
                      {TIME_SLOT_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`mi-chip${timeSlots.includes(opt.value) ? ' is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={timeSlots.includes(opt.value)}
                            onChange={() => setTimeSlots((prev) => toggleInList(prev, opt.value))}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>

                    {DATE_GROUPS.map((group) => (
                      <div key={group.label} className="mi-date-group">
                        <p className="mi-date-group__label">{group.label}</p>
                        <div className="mi-chip-grid">
                          {group.dates.map((opt) => (
                            <label
                              key={opt.value}
                              className={`mi-chip${dates.includes(opt.value) ? ' is-selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={dates.includes(opt.value)}
                                onChange={() => setDates((prev) => toggleInList(prev, opt.value))}
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </fieldset>

                  <fieldset className="mi-fieldset">
                    <legend className="mi-legend">可以接受收費範圍<span className="mi-field__req">必填</span></legend>
                    <div className="mi-choice-list" role="radiogroup" aria-label="可以接受收費範圍">
                      {PRICE_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`mi-choice${priceRange === opt.value ? ' is-selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="price_range"
                            value={opt.value}
                            checked={priceRange === opt.value}
                            onChange={() => setPriceRange(opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="mi-fields">
                    <label className="mi-field">
                      <span className="mi-field__label">
                        電郵 <span className="mi-field__req">必填</span>
                      </span>
                      <input
                        className="pixel-input"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="用作優先通知"
                        required
                      />
                    </label>
                    <label className="mi-field">
                      <span className="mi-field__label">
                        稱呼 <span className="mi-field__req">必填</span>
                      </span>
                      <input
                        className="pixel-input"
                        type="text"
                        autoComplete="nickname"
                        maxLength={40}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="方便我哋稱呼你"
                        required
                      />
                    </label>
                    <label className="mi-field">
                      <span className="mi-field__label">
                        留言 <span className="mi-field__req">必填</span>
                      </span>
                      <textarea
                        className="pixel-textarea"
                        rows={4}
                        maxLength={500}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="例如：想認識多啲朋友、對邊個環節最有興趣…"
                        required
                      />
                    </label>
                  </div>
                </div>
              )}

              {!showFollowUp && interest && (
                <div className="mi-fields mi-fields--compact">
                  <label className="mi-field">
                    <span className="mi-field__label">
                      電郵 <span className="mi-field__opt">選填</span>
                    </span>
                    <input
                      className="pixel-input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="若希望收到後續消息可留下"
                    />
                  </label>
                </div>
              )}

              {error && <p className="pixel-error mi-error">{error}</p>}

              <button
                type="submit"
                className="pixel-btn pixel-btn--primary mi-submit"
                disabled={submitting || !interest}
              >
                <span className="pixel-btn__zh">{submitting ? '傳送中…' : '提交回覆'}</span>
              </button>
            </form>
          )}

          <p className="mi-footnote">
            呢頁只用作收集意見，唔等於報名成功。正式場次同收費會另行公布。
          </p>

          {isAdmin && (
            <section className="mi-card mi-admin-draft" aria-labelledby="mi-admin-draft-title">
              <h2 id="mi-admin-draft-title" className="mi-card__title">
                <HeaderMailIcon size={15} />
                Admin · Gmail 草稿
              </h2>
              <p className="mi-hint">
                建立邀請填寫本頁嘅靚 email 草稿到你嘅 Gmail「草稿」箱。
                <strong>只存草稿，唔會自動發送。</strong>
              </p>
              <form className="mi-fields" onSubmit={handleCreateGmailDraft}>
                <label className="mi-field">
                  <span className="mi-field__label">
                    收件人電郵 <span className="mi-field__opt">選填</span>
                  </span>
                  <input
                    className="pixel-input"
                    type="email"
                    value={draftTo}
                    onChange={(e) => setDraftTo(e.target.value)}
                    placeholder="留空＝之後喺 Gmail 草稿自行填"
                  />
                </label>
                <label className="mi-field">
                  <span className="mi-field__label">
                    稱呼（信內問候） <span className="mi-field__opt">選填</span>
                  </span>
                  <input
                    className="pixel-input"
                    type="text"
                    maxLength={40}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="例如：阿貓"
                  />
                </label>
                {draftErr && <p className="pixel-error mi-error">{draftErr}</p>}
                {draftMsg && <p className="mi-draft-ok">{draftMsg}</p>}
                <button
                  type="submit"
                  className="pixel-btn pixel-btn--primary mi-submit"
                  disabled={draftBusy}
                >
                  <span className="pixel-btn__zh">
                    {draftBusy ? '建立中…' : '存入 Gmail 草稿（不發送）'}
                  </span>
                </button>
              </form>
            </section>
          )}
        </article>
      </AppShell>
    </>
  );
}
