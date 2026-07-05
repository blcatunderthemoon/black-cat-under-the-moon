/** PayMe / FPS copy — sign-up & renewal on /premium; grants via dashboard manual-verify API. */

import { MOONLIGHT_PASSPORT_BRAND } from './premium.js';

export const MANUAL_PAYMENT_AMOUNT_HKD = 58;
export const MANUAL_PAYMENT_SUPPORT_EMAIL = 'blcatunderthemoon@gmail.com';

/** Default site asset; override with NEXT_PUBLIC_PAYME_QR_URL if needed. */
export const MANUAL_PAYMENT_QR_URL = process.env.NEXT_PUBLIC_PAYME_QR_URL || '/PayCode.jpg';
export const MANUAL_PAYMENT_FPS_ID = process.env.NEXT_PUBLIC_MANUAL_FPS_ID || '';
export const MANUAL_PAYMENT_PAYME_LINK = process.env.NEXT_PUBLIC_PAYME_LINK || '';

export const MANUAL_PAYMENT_PAYME_STEPS = [
  `使用 PayMe 掃描上方 QR Code，轉帳 HKD ${MANUAL_PAYMENT_AMOUNT_HKD}`,
  '備註請填寫你的註冊 Email，方便核對',
  `完成後將轉帳紀錄截圖寄至 ${MANUAL_PAYMENT_SUPPORT_EMAIL}`,
  `我們會在 1–2 個工作天內為你開通 ${MOONLIGHT_PASSPORT_BRAND}`,
];

export const MANUAL_PAYMENT_FPS_NOTE = `如需以 FPS 轉數快付款，請先電郵 ${MANUAL_PAYMENT_SUPPORT_EMAIL} 聯絡，我們會提供收款資料。`;

/** @deprecated use MANUAL_PAYMENT_PAYME_STEPS */
export const MANUAL_PAYMENT_STEPS = MANUAL_PAYMENT_PAYME_STEPS;
