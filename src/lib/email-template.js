/**
 * lib/email-template.js
 * Shared email HTML builder for match notification emails.
 * Used by: pages/api/dashboard/send-emails.js
 *          pages/api/dashboard/create-gmail-drafts.js
 */

export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function scoreLabel(score) {
  if (score >= 90) return '極高同步';
  if (score >= 80) return '超高同步';
  if (score >= 65) return '高度契合';
  if (score >= 50) return '值得了解';
  return '有潛力';
}

const SAFETY_SECTION = `
    <!-- Safety reminder -->
    <div style="margin-top:20px;border-left:3px solid #f87171;padding:14px 16px;background:rgba(248,113,113,0.06);border-radius:0 8px 8px 0;">
      <div style="font-size:13px;font-weight:700;color:#f87171;margin-bottom:10px;">🛡️ 黑貓的守護提醒（社交安全）</div>
      <div style="font-size:12px;color:#c9bfe8;line-height:1.9;">
        在你們開始了解彼此之前，請務必閱讀以下安全指引，保護好自己：
        <ul style="margin:8px 0 0 0;padding-left:18px;">
          <li><strong style="color:#f0ebd8;">保護個人隱私：</strong>在建立足夠信任前，請勿向對方透露過多敏感資訊（如屋企地址、公司具體位置、身份證號碼或銀行資料）。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">初次見面安排：</strong>若決定見面，請務必約在人多、明亮的公眾場合（如餐廳或咖啡廳），切勿前往對方的私人住所或偏僻地方。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">告知親友：</strong>出發前將約會的時間、地點及對方基本資料告知身邊信任的朋友或家人。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">保持清醒：</strong>注意飲品安全，確保飲品不曾離開你的視線範圍。</li>
          <li style="margin-top:6px;"><strong style="color:#f0ebd8;">金錢往來：</strong>若對方向你提出借錢、投資或任何金錢要求，請提高警覺。</li>
        </ul>
      </div>
    </div>`;

const DISCLAIMER_SECTION = `
    <!-- Disclaimer -->
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#a89cc8;margin-bottom:8px;">⚠️ 免責聲明</div>
      <div style="font-size:11px;color:#6b5fa5;line-height:1.85;">本配對結果由系統根據問卷答案演算得出，僅供參考，不代表任何對任何人士的推薦或保證。Black Cat Under The Moon 平台及其運營者對於配對雙方在線下互動所發生的任何事件、損失或糾紛概不負責。參加者須自行評估風險，謹慎行事，並對自身安全負責。</div>
    </div>`;

/**
 * @param {{ name: string, email?: string, ig_username?: string }} params.receiver
 * @param {{ name: string, email?: string, ig_username?: string }} params.partner
 * @param {number} params.score – 0–100
 */
export function buildEmailHtml({ receiver, partner, score }) {
  const label = scoreLabel(score);
  const contactRows = [];
  if (receiver.email || partner.email) {
    contactRows.push(`<tr>
      <td style="padding:4px 12px 4px 0;font-size:13px;color:#8880a8;">你的 Email：<span style="color:#7dd8e4;font-weight:700;">${esc(receiver.email || '—')}</span></td>
      <td style="padding:4px 0;font-size:13px;color:#8880a8;">對方 Email：<span style="color:#7dd8e4;font-weight:700;">${esc(partner.email || '—')}</span></td>
    </tr>`);
  }
  if (receiver.ig_username || partner.ig_username) {
    contactRows.push(`<tr>
      <td style="padding:4px 12px 4px 0;font-size:13px;color:#8880a8;">你的 IG：<span style="color:#7dd8e4;font-weight:700;">${esc(receiver.ig_username || '—')}</span></td>
      <td style="padding:4px 0;font-size:13px;color:#8880a8;">對方 IG：<span style="color:#7dd8e4;font-weight:700;">${esc(partner.ig_username || '—')}</span></td>
    </tr>`);
  }

  return `
<div style="background:#07060e;padding:24px 16px;font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;color:#f0ebd8;">
<div style="max-width:600px;margin:0 auto;background:#12111d;border:2px solid #7c5cfc;border-radius:12px;padding:28px 24px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:0.2em;color:#a89cc8;text-transform:uppercase;margin-bottom:6px;">🐈‍⬛ Black Cat Under The Moon</div>
    <h2 style="margin:0 0 6px;font-size:22px;color:#ffe066;letter-spacing:0.05em;">🌙 靈魂配對通知</h2>
    <div style="font-size:13px;color:#a89cc8;">靈貓為你尋找最合拍的靈魂伴侶</div>
  </div>

  <div style="border-top:1px solid rgba(124,92,252,.25);margin-bottom:20px;"></div>

  <!-- Match box -->
  <div style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:18px 20px;margin-bottom:20px;">
    <div style="font-size:14px;margin-bottom:8px;">恭喜 <strong style="color:#ffe066;">${esc(receiver.name)}</strong> 成功配對：</div>
    <div style="font-size:34px;color:#00e5ff;font-weight:900;letter-spacing:1px;margin-bottom:10px;">${esc(partner.name)}</div>
    <div style="display:inline-block;padding:5px 14px;border:1px solid #ff6b9d;border-radius:3px;color:#ff6b9d;font-size:14px;font-weight:700;margin-bottom:14px;">同步率 ${score}/100 ・ ${label}</div>
    ${contactRows.length ? `<table width="100%" cellpadding="0" cellspacing="0" border="0">${contactRows.join('')}</table>` : ''}
  </div>

  <!-- Attachment notice -->
  <div style="background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);border-radius:8px;padding:14px 18px;margin-bottom:20px;text-align:center;">
    <div style="font-size:22px;margin-bottom:6px;">📎</div>
    <div style="font-size:14px;color:#f0ebd8;font-weight:700;margin-bottom:6px;">你的專屬配對卡片已附上</div>
    <div style="font-size:13px;color:#a89cc8;line-height:1.75;">請下載並在瀏覽器中打開附件 <strong style="color:#00e5ff;">配對卡.html</strong>，<br>查看完整配對分析、靈魂雷達圖及相容度解說。</div>
  </div>

  ${SAFETY_SECTION}

  ${DISCLAIMER_SECTION}

  <div style="border-top:1px solid rgba(124,92,252,.2);margin-bottom:16px;"></div>

  <!-- Footer -->
  <div style="text-align:center;font-size:11px;color:#46435a;line-height:1.9;">
    <div>Black Cat Under The Moon &nbsp;·&nbsp; blcatunderthemoon@gmail.com</div>
    <div>此郵件由系統自動發送，請勿直接回覆。</div>
  </div>

</div>
</div>`.trim();
}

export function buildTextEmail({ receiver, partner, score }) {
  return [
    `嗨 ${receiver.name}，`,
    '',
    '你的靈魂配對結果出爐了！',
    `靈魂同步率：${score}/100`,
    '',
    `配對對象：${partner.name}`,
    partner.ig_username ? `Instagram：@${partner.ig_username}` : '',
    partner.email       ? `Email：${partner.email}` : '',
    '',
    '📎 請下載並在瀏覽器中打開附件的配對卡片（.html 檔案），查看完整配對分析及靈魂雷達圖。',
    '',
    '🛡️ 黑貓的守護提醒（社交安全）',
    '在建立足夠信任前，請勿分享敏感個人資料。',
    '初次見面請在公眾場合，並預先告知親友。',
    '注意飲品安全，提防金錢要求。',
    '',
    '⚠️ 免責聲明',
    '本配對結果僅供參考。平台對線下互動所發生之任何事件概不負責，參加者須自行評估風險。',
    '',
    'Black Cat Under The Moon',
    '此郵件由系統自動發送，請勿直接回覆。',
  ].filter((l) => l !== undefined).join('\n');
}
