/**
 * Moonlight Gathering #001 interest-survey invite email (HTML + text).
 * Draft-only — never auto-sent.
 */

import { esc } from './email-template.js';
import { getSiteUrl } from './site-seo.js';

export function moonlightInterestSurveyUrl(siteUrl) {
  const base = String(siteUrl || getSiteUrl()).replace(/\/$/, '');
  return `${base}/moonlight-interest`;
}

export function buildMoonlightInterestEmailSubject() {
  return 'Moonlight Gathering #001｜想聽你嘅意見 · Black Cat Under The Moon';
}

/**
 * @param {{ siteUrl?: string, recipientName?: string }} [opts]
 */
export function buildMoonlightInterestEmailHtml(opts = {}) {
  const surveyUrl = moonlightInterestSurveyUrl(opts.siteUrl);
  const name = typeof opts.recipientName === 'string' ? opts.recipientName.trim() : '';
  const greeting = name
    ? `你好 <strong style="color:#ffe066;">${esc(name)}</strong>，`
    : '你好，';

  return `
<div style="background:#07060e;padding:24px 16px;font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;color:#f0ebd8;">
<div style="max-width:600px;margin:0 auto;background:#12111d;border:2px solid #7c5cfc;border-radius:12px;padding:28px 24px;">

  <div style="text-align:center;margin-bottom:22px;">
    <div style="font-size:11px;letter-spacing:0.18em;color:#a89cc8;text-transform:uppercase;margin-bottom:8px;">Black Cat Under The Moon</div>
    <h1 style="margin:0 0 8px;font-size:22px;color:#ffe066;letter-spacing:0.04em;line-height:1.35;">Moonlight Gathering #001</h1>
    <div style="font-size:13px;color:#a89cc8;line-height:1.7;">12 人限定小型聚會 · 意見調查</div>
  </div>

  <div style="border-top:1px solid rgba(124,92,252,.25);margin-bottom:20px;"></div>

  <div style="font-size:14px;line-height:1.9;color:#e8e0d0;margin-bottom:18px;">
    ${greeting}<br>
    Black Cat 一直都希望，唔止係一個配對網站，而係一個可以真正認識新朋友、建立連結嘅地方。
  </div>

  <div style="font-size:14px;line-height:1.9;color:#e8e0d0;margin-bottom:18px;">
    我哋正計劃於 <strong style="color:#ffe066;">9 月</strong> 試辦第一場 Moonlight Gathering：
    透過遊戲、故事分享同輕鬆聊天自然認識彼此——唔係傳統 Speed Dating。
  </div>

  <div style="background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px 18px;margin-bottom:20px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;color:#bd93f9;margin-bottom:12px;">活動速覽</div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;line-height:1.75;color:#f0ebd8;">
      <tr>
        <td style="padding:4px 0;color:#8880a8;width:38%;vertical-align:top;">對象 Label</td>
        <td style="padding:4px 0;font-weight:700;color:#00e5ff;">Pure</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#8880a8;vertical-align:top;">年齡範圍</td>
        <td style="padding:4px 0;font-weight:700;">23–34 歲</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#8880a8;vertical-align:top;">活動時間</td>
        <td style="padding:4px 0;font-weight:700;">約 3–3.5h</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#8880a8;vertical-align:top;">人數</td>
        <td style="padding:4px 0;font-weight:700;">12 人限定 · Party Room</td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#8880a8;vertical-align:top;">環節</td>
        <td style="padding:4px 0;">尋貓 Bingo · Topic Card · Moonlight Mail</td>
      </tr>
    </table>
  </div>

  <div style="font-size:14px;line-height:1.9;color:#e8e0d0;margin-bottom:22px;">
    而家想先聽下你嘅意見：會唔會有興趣、邊啲日子方便、收費範圍可唔可以接受。
    <strong style="color:#f0ebd8;">填寫唔等於報名</strong>，正式場次會另行公布。
  </div>

  <div style="text-align:center;margin:8px 0 24px;">
    <a href="${esc(surveyUrl)}"
       style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7c5cfc,#ff6b9d);color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.04em;">
      填寫意見調查
    </a>
    <div style="margin-top:12px;font-size:12px;color:#6b5fa5;word-break:break-all;line-height:1.6;">
      ${esc(surveyUrl)}
    </div>
  </div>

  <div style="border-top:1px solid rgba(124,92,252,.2);margin-bottom:16px;"></div>

  <div style="text-align:center;font-size:11px;color:#46435a;line-height:1.9;">
    <div>Black Cat Under The Moon · blcatunderthemoon@gmail.com</div>
    <div>呢封信用作收集意見，歡迎直接回覆同我哋講。</div>
  </div>

</div>
</div>`.trim();
}

/**
 * @param {{ siteUrl?: string, recipientName?: string }} [opts]
 */
export function buildMoonlightInterestEmailText(opts = {}) {
  const surveyUrl = moonlightInterestSurveyUrl(opts.siteUrl);
  const name = typeof opts.recipientName === 'string' ? opts.recipientName.trim() : '';
  const greeting = name ? `你好 ${name}，` : '你好，';

  return [
    'Moonlight Gathering #001｜意見調查',
    'Black Cat Under The Moon',
    '',
    greeting,
    'Black Cat 一直都希望，唔止係一個配對網站，而係一個可以真正認識新朋友、建立連結嘅地方。',
    '',
    '我哋正計劃於 9 月試辦第一場 Moonlight Gathering（12 人限定）：',
    '尋貓 Bingo、Topic Card 小組聊天、Moonlight Mail。',
    '對象 Label：Pure｜年齡：23–34 歲｜時長：約 3–3.5h',
    '',
    '想先聽你嘅意見（有興趣／日子／收費）。填寫唔等於報名。',
    '',
    `填寫連結：${surveyUrl}`,
    '',
    'Black Cat Under The Moon · blcatunderthemoon@gmail.com',
  ].join('\n');
}
