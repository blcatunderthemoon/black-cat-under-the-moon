/**
 * Moon Journey rules & level table — shared by /moon-journey and account summary.
 */

import Link from 'next/link';
import {
  MOON_JOURNEY_LEVELS,
  MOON_JOURNEY_EXP,
  MOON_JOURNEY_EXP_RULES,
  MOON_JOURNEY_COMMENT_DAILY_LIMIT,
  MOON_JOURNEY_CHECKIN_STREAK_RULES,
  MOON_JOURNEY_GUIDE_PATH,
} from '../lib/moon-journey.js';

export { MOON_JOURNEY_GUIDE_PATH };

function buildLevelRows() {
  return MOON_JOURNEY_LEVELS.map((row, index) => {
    const next = MOON_JOURNEY_LEVELS[index + 1];
    return {
      ...row,
      expToNextTotal: next ? next.minExp : null,
      spanExp: next ? next.minExp - row.minExp : null,
    };
  });
}

const LEVEL_ROWS = buildLevelRows();

export default function MoonJourneyGuide({ showCta = true }) {
  return (
    <div className="moon-journey-guide">
      <section className="moon-journey-guide__section" aria-labelledby="mj-intro-heading">
        <h2 id="mj-intro-heading" className="moon-journey-guide__heading">什麼是月光旅程？</h2>
        <p className="moon-journey-guide__lead">
          在黑貓樹洞發帖、留言、被認可，以及每日打卡，都會累積<strong>月光經驗（EXP）</strong>。
          EXP 達到門檻後自動升級，獲得專屬稱號——每個人都是一隻黑貓，隨著參與社群逐漸成長。
        </p>
        <ul className="moon-journey-guide__bullets">
          <li>EXP 只增不減，升級後不會降級</li>
          <li>每日打卡與留言計數以<strong>香港時區</strong>切日</li>
        </ul>
      </section>

      <section className="moon-journey-guide__section" aria-labelledby="mj-levels-heading">
        <h2 id="mj-levels-heading" className="moon-journey-guide__heading">等級與稱號</h2>
        <p className="moon-journey-guide__hint">
          等級由<strong>累積 EXP</strong>決定。下表「升至下一級」為達到該級所需的總 EXP 門檻。
        </p>
        <div className="moon-journey-guide__table-wrap">
          <table className="moon-journey-guide__table">
            <thead>
              <tr>
                <th scope="col">等級</th>
                <th scope="col">稱號</th>
                <th scope="col">累積 EXP</th>
                <th scope="col">本級跨度</th>
              </tr>
            </thead>
            <tbody>
              {LEVEL_ROWS.map((row) => (
                <tr key={row.level}>
                  <td>
                    <span className="moon-journey-guide__level-cell">
                      <span aria-hidden="true">{row.emoji}</span>
                      Lv{row.level}
                    </span>
                  </td>
                  <td>
                    <span className="moon-journey-guide__title-zh">{row.titleZh}</span>
                    <span className="moon-journey-guide__title-en">{row.titleEn}</span>
                  </td>
                  <td>{row.minExp.toLocaleString()}</td>
                  <td>{row.spanExp != null ? row.spanExp.toLocaleString() : '滿級'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="moon-journey-guide__section" aria-labelledby="mj-exp-heading">
        <h2 id="mj-exp-heading" className="moon-journey-guide__heading">如何獲得 EXP</h2>
        <ul className="moon-journey-guide__exp-list">
          {MOON_JOURNEY_EXP_RULES.map((rule) => (
            <li key={rule.label} className="moon-journey-guide__exp-item">
              <span className="moon-journey-guide__exp-label">{rule.label}</span>
              <span className="moon-journey-guide__exp-amount">+{rule.exp}</span>
              <span className="moon-journey-guide__exp-note">{rule.note}</span>
            </li>
          ))}
        </ul>
        <div className="moon-journey-guide__callout">
          <p>
            <strong>發文額度：</strong>免費會員每日可發 3 篇（最多 +45 EXP／日）；
            <Link href="/premium">月光護照</Link> 發文不限（EXP 仍按實際發文計算）。
          </p>
          <p>
            <strong>留言：</strong>每日最多計 {MOON_JOURNEY_COMMENT_DAILY_LIMIT} 次留言 EXP（+{MOON_JOURNEY_EXP.comment_created}／次）；
            在自己發的帖下留言不計分。
          </p>
          <p>
            <strong>互動：</strong>每位用戶對同一則留言的 Like、對同一篇帖的收藏，各只會為作者帶來一次 EXP。
          </p>
        </div>
      </section>

      <section className="moon-journey-guide__section" aria-labelledby="mj-checkin-heading">
        <h2 id="mj-checkin-heading" className="moon-journey-guide__heading">每日打卡</h2>
        <p className="moon-journey-guide__lead">
          登入後於黑貓樹洞展開「月光旅程」，按「今日打卡」即可領取當日獎勵。
        </p>

        <h3 className="moon-journey-guide__subheading">連續打卡獎勵機制</h3>
        <ul className="moon-journey-guide__streak-list">
          {MOON_JOURNEY_CHECKIN_STREAK_RULES.map((rule) => (
            <li key={rule.title} className="moon-journey-guide__streak-item">
              <strong>{rule.title}</strong>
              <span>{rule.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="moon-journey-guide__section" aria-labelledby="mj-gatherings-heading">
        <h2 id="mj-gatherings-heading" className="moon-journey-guide__heading">月光聚會</h2>
        <p className="moon-journey-guide__lead">
          網站會員即可發起或申請線上／線下聚會（審批制 RSVP）。私密地址只會在獲批准後顯示。
        </p>
        <div className="moon-journey-guide__callout">
          <p>
            桌遊、讀書會、塔羅夜、微醺傾計、行山睇戲——把線上緣分帶到月下見面。
            私密地址只會在獲批准後顯示。
          </p>
          <p>
            <Link href="/gatherings">瀏覽／發起月光聚會</Link>
          </p>
        </div>
      </section>

      {showCta && (
        <div className="moon-journey-guide__cta">
          <Link href="/forum" className="pixel-btn pixel-btn--primary moon-journey-guide__cta-btn">
            前往黑貓樹洞
          </Link>
          <Link href="/gatherings" className="moon-journey-guide__cta-secondary">
            月光聚會
          </Link>
          <Link href="/account" className="moon-journey-guide__cta-secondary">
            在帳戶頁查看我的進度
          </Link>
        </div>
      )}
    </div>
  );
}
