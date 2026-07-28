/**
 * /moonlight-interest001 — Moonlight Gathering #001 participation form (email outreach).
 * Public (no login required). No site nav / footer entry; noindex.
 * Fixed session: 2026-09-19 (Sat) 14:00–17:00 HKT.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { canAdminForum } from '../lib/forum-roles.js';
import { PROFILE_QUESTIONS } from '../lib/moonlight-interest-meta.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import SeoHead from '../components/SeoHead.js';
import MoonlightInviteEmailPanel from '../components/admin/MoonlightInviteEmailPanel.js';
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
} from '../components/UiIcons.js';

/** Fixed event — stored with each signup for dashboard compatibility. */
const EVENT_DATE = '2026-09-19';
const EVENT_TIME_SLOT = 'sat_afternoon';

const EMPTY_ANSWERS = Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.key, '']));

const EVENT_META = [
  { icon: HeaderCalendarIcon, label: '日期', value: '2026年9月19日（六）' },
  { icon: ForumClockIcon, label: '時間', value: '下午 2:00–5:00' },
  { icon: HeaderUserPlusIcon, label: '對象 Label', value: 'Pure' },
  { icon: ForumPawIcon, label: '年齡範圍', value: '23–34 歲' },
  { icon: UiHomeIcon, label: '形式', value: '12–16 人 · Party Room' },
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
    summary: '活動後聯絡機制',
    expand: [
      {
        icon: HeaderMailIcon,
        title: 'Moonlight Mail',
        body: '活動尾段以聯絡卡機制收束，方便想繼續認識嘅人接上線。',
      },
    ],
  },
];

const FEATURES = [
  { icon: HeaderUserPlusIcon, label: '12–16 人小型聚會' },
  { icon: UiHomeIcon, label: 'Party Room' },
  { icon: ForumGamepadIcon, label: '破冰遊戲（尋貓 Bingo）' },
  { icon: HeaderChatIcon, label: 'Topic Card 小組聊天' },
  { icon: HeaderMailIcon, label: 'Moonlight Mail（活動後聯絡通知）' },
];

export default function MoonlightInterest001Page() {
  const { session, profile, displayName: authDisplayName, loading: authLoading } = useAuth();
  const isAdmin = canAdminForum(profile?.profile?.forum_role);
  const [email, setEmail] = useState('');
  const [telegram, setTelegram] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [answers, setAnswers] = useState(() => ({ ...EMPTY_ANSWERS }));
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [openScheduleId, setOpenScheduleId] = useState('');

  const emailFilled = Boolean(email.trim());
  const telegramFilled = Boolean(telegram.trim());
  const nameFilled = Boolean(displayName.trim());

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

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

    if (!email.trim()) {
      setError('請留下電郵方便聯絡。');
      return;
    }
    if (!telegram.trim()) {
      setError('請填寫 Telegram username。');
      return;
    }
    if (!displayName.trim()) {
      setError('請填寫稱呼。');
      return;
    }
    for (const q of PROFILE_QUESTIONS) {
      if (!String(answers[q.key] || '').trim()) {
        setError(`請回答：${q.label}`);
        return;
      }
    }

    const cleanAnswers = Object.fromEntries(
      PROFILE_QUESTIONS.map((q) => [q.key, String(answers[q.key] || '').trim()]),
    );

    setSubmitting(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch('/api/moonlight-interest', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          interest: 'interested',
          time_slots: [EVENT_TIME_SLOT],
          dates: [EVENT_DATE],
          email: email.trim(),
          telegram_username: telegram.trim(),
          display_name: displayName.trim(),
          answers: cleanAnswers,
          message: message.trim() || null,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || '無法提交參加表，請稍後再試。');
        return;
      }
      setDone(true);
    } catch {
      setError('網絡錯誤，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SeoHead
        title="Moonlight Gathering 參加表"
        description="Moonlight Gathering #001 參加表 — 2026年9月19日（六）下午 2:00–5:00，12–16 人小型聚會。"
        path="/moonlight-interest001"
        noindex
      />
      <AppShell
        title="Moonlight Gathering"
        headerVariant="account"
        backHref="/index.html"
        maxWidth="680px"
        pageClassName="app-page--moonlight-interest"
        nav={session ? <AppHeaderAuth redirectPath="/moonlight-interest001" /> : null}
      >
        <article className="mi-page">
          <header className="mi-hero">
            <p className="mi-hero__kicker">
              <ForumMoonIcon size={14} />
              <span>Participation Form</span>
            </p>
            <h1 className="mi-hero__title">Moonlight Gathering #001</h1>
            <figure className="mi-poster">
              <a
                className="mi-poster__link"
                href="/poster001.png"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="mi-poster__img"
                  src="/poster001.png"
                  alt="Moonlight Gathering #001 活動海報：2026年9月19日下午 2:00–5:00，Party Room，破冰遊戲、Bingo、Table Chat"
                  width={1200}
                  height={1697}
                  decoding="async"
                  fetchPriority="high"
                />
              </a>
              <figcaption className="mi-poster__caption">活動海報 · 撳圖可睇大圖</figcaption>
            </figure>
            <p className="mi-hero__guest-note">唔使登入都可以填寫。</p>
            <p className="mi-hero__lead">
              Black Cat 一直都希望，唔止係一個配對網站，而係一個可以真正認識新朋友、建立連結嘅地方。
            </p>
            <p className="mi-hero__lead">
              第一場 Moonlight Gathering 定喺 <strong>2026年9月19日（六）下午 2:00–5:00</strong>。
            </p>
            <p className="mi-hero__lead">
              今次會係一場 <strong>12–16 人</strong> 嘅小型聚會，希望透過遊戲、故事分享同輕鬆聊天，令大家自然認識彼此，而唔係傳統 Speed Dating。
            </p>
            <p className="mi-hero__lead">
              <strong>想出席就填下面嘅參加表</strong>，我哋會用電郵同你確認。
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
                多謝填寫參加表
              </h2>
              <p className="mi-success-copy">
                已收到你嘅參加資料。我哋會用電郵同你確認名額同之後安排。
              </p>
            </section>
          ) : (
            <form className="mi-card mi-form" onSubmit={handleSubmit} noValidate>
              <h2 className="mi-card__title">
                <HeaderCalendarIcon size={15} />
                參加表
              </h2>
              <p className="mi-hint">
                場次：<strong>9月19日（六）下午 2:00–5:00</strong>。想出席就填表。
              </p>

              <div className="mi-fields">
                <label className="mi-field">
                  <span className="mi-field__label">
                    電郵 {!emailFilled && <span className="mi-field__req">必填</span>}
                  </span>
                  <input
                    className="pixel-input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="用作確認名額同聯絡"
                    required
                  />
                </label>
                <label className="mi-field">
                  <span className="mi-field__label">
                    Telegram username {!telegramFilled && <span className="mi-field__req">必填</span>}
                  </span>
                  <input
                    className="pixel-input"
                    type="text"
                    autoComplete="username"
                    inputMode="text"
                    maxLength={33}
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@your_username"
                    required
                  />
                </label>
                <label className="mi-field">
                  <span className="mi-field__label">
                    稱呼 {!nameFilled && <span className="mi-field__req">必填</span>}
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
              </div>

              <fieldset className="mi-fieldset mi-fieldset--profile">
                <legend className="mi-legend">想多啲認識你</legend>
                <p className="mi-hint mi-hint--tight">以下問題都會用於破冰同分組，請盡量真實填寫。</p>
                <div className="mi-fields">
                  {PROFILE_QUESTIONS.map((q) => {
                    const filled = Boolean(String(answers[q.key] || '').trim());
                    return (
                      <label key={q.key} className="mi-field">
                        <span className="mi-field__label">
                          {q.label}
                          {!filled && <span className="mi-field__req">必填</span>}
                        </span>
                        <textarea
                          className="pixel-textarea"
                          rows={2}
                          maxLength={200}
                          value={answers[q.key] || ''}
                          onChange={(e) => setAnswer(q.key, e.target.value)}
                          placeholder={q.placeholder}
                          required
                        />
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mi-fields">
                <label className="mi-field">
                  <span className="mi-field__label">
                    留言 <span className="mi-field__opt">選填</span>
                  </span>
                  <textarea
                    className="pixel-textarea"
                    rows={3}
                    maxLength={500}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="其他想同我哋講嘅…"
                  />
                </label>
              </div>

              {error && <p className="pixel-error mi-error">{error}</p>}

              <button
                type="submit"
                className="pixel-btn pixel-btn--primary mi-submit"
                disabled={submitting}
              >
                <span className="pixel-btn__zh">{submitting ? '提交中…' : '提交參加表'}</span>
              </button>
            </form>
          )}

          <p className="mi-footnote">
            提交參加表後，我哋會用電郵同你確認。名額有限（12–16 人），以確認為準。
          </p>

          {isAdmin && <MoonlightInviteEmailPanel />}
        </article>
      </AppShell>
    </>
  );
}
