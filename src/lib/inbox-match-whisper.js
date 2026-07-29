/**
 * Match-unlocked「月光低語」— limited free private notes after Echo match.
 * Does not consume Moonlight Passport letter quota.
 */

import { getUserLetters } from './inbox-channel.js';
import { MOONLIGHT_PASSPORT_BRAND } from './premium.js';

/** Shared short-message budget for both sides of a match thread. */
export const MATCH_WHISPER_MAX_MESSAGES = 3;

export const MATCH_WHISPER_SOURCE = 'match_whisper';

export const WHISPER_COMPOSE_TITLE_OPEN = '月光低語 · 連線後嘅第一句';
export const WHISPER_COMPOSE_TITLE_REPLY = '月光低語 · 回覆';
export const WHISPER_COMPOSE_PLACEHOLDER = '用一句短訊，輕輕打個招呼…';

export const WHISPER_STATUS_FOOTER_EXHAUSTED =
  `月光低語已用完。想繼續深聊，可到對方的 Mirror Card 以 ${MOONLIGHT_PASSPORT_BRAND} 開啟月光信。`;

/**
 * Preset icebreakers for the first whisper — never auto-sent; user must confirm.
 * Tone: plain, everyday Cantonese. Ordinary small talk, not cute/gimmicky.
 * Keep under ~200 chars.
 */
export const MATCH_WHISPER_OPENERS = [
  { id: 'hi_1', label: '打招呼', text: '你好呀，見到連線成功，想打聲招呼。' },
  { id: 'hi_2', label: '哈囉', text: '哈囉，想嚟認識下你。' },
  { id: 'hi_3', label: '今日點', text: '你好，今日過得點？' },
  { id: 'hi_4', label: '得閒嗎', text: '你好呀，而家得唔得閒傾下計？' },
  { id: 'hi_5', label: '慢慢傾', text: '你好。想認識吓你。' },
  { id: 'hi_6', label: '打聲招呼', text: '想先打聲招呼，你好呀。' },
  { id: 'hi_7', label: '晚上好', text: '晚上好，你今晚點呀？' },
  { id: 'hi_8', label: '最近點', text: '你好，最近點呀？' },
  { id: 'hi_9', label: '方便嗎', text: '你好呀，方便傾下嗎？' },
  { id: 'hi_10', label: '想識你', text: '你好，想認識多啲你。' },
  { id: 'hi_11', label: '得閒先回', text: '你好呀。得閒先回都得。' },
  { id: 'hi_12', label: '忙完未', text: '你好，忙完未呀？' },
  { id: 'hi_13', label: '食咗未', text: '你好呀，食咗未？' },
  { id: 'hi_14', label: '週末', text: '你好，你週末通常做咩？' },
  { id: 'hi_15', label: '平時興趣', text: '你好呀，你平時鍾意做咩？' },
  { id: 'hi_16', label: '飲咩', text: '你好，你平時鍾意飲咩多啲？' },
  { id: 'hi_17', label: '睇劇', text: '你好呀，你最近有冇睇緊咩戲/劇？' },
  { id: 'hi_18', label: '聽歌', text: '你好，你平時聽咩類型歌多？' },
  { id: 'hi_19', label: '出街', text: '你好呀，你比較鍾意出街定喺屋企？' },
  { id: 'hi_20', label: '工作', text: '你好，今日點呀？' },
  { id: 'hi_21', label: '天氣', text: '你好呀，今日有冇出街玩吖？' },
  { id: 'hi_22', label: '介紹自己', text: '你好，想簡單介紹下自己同認識你。' },
  { id: 'hi_23', label: '有興趣', text: '見到我哋連線，覺得想傾下。你好呀。' },
  { id: 'hi_24', label: 'Mirror', text: '望過你嘅資料，想認識多啲。你好。' },
  { id: 'hi_25', label: '同步', text: '見到匹配度幾高，想試下傾下。你好呀。' },
  { id: 'hi_26', label: '唔好意思', text: '唔好意思打擾，想打聲招呼。你好呀。' },
  { id: 'hi_27', label: '輕鬆傾', text: '你好，想輕鬆傾兩句認識下。' },
  { id: 'hi_28', label: '有空嗎', text: '哈囉，你而家有空嗎？' },
  { id: 'hi_29', label: '開波', text: '你好呀，不如由打招呼開始啦。' },
  { id: 'hi_30', label: '想傾', text: '你好，有咩想傾都可以。' },
  { id: 'hi_31', label: '最近食嘢', text: '你好呀，最近有冇食到啲好味嘢？' },
  { id: 'hi_32', label: '放假', text: '你好，你最近有冇放假計劃？' },
  { id: 'hi_33', label: '運動', text: '你好呀，你平時有冇做運動？' },
  { id: 'hi_34', label: '寵物', text: '你好，你屋企有冇養寵物？' },
  { id: 'hi_35', label: '瞓覺', text: '你好呀，你平時早瞓多定夜瞓多？' },
  { id: 'hi_36', label: '地區', text: '你好，你主要喺邊區活動多？' },
  { id: 'hi_37', label: '興趣', text: '你好呀，想知多啲你嘅興趣。' },
  { id: 'hi_38', label: '今日心情', text: '你好，今日心情點？' },
  { id: 'hi_39', label: '一齊傾', text: '哈囉，希望可以慢慢傾開。' },
  { id: 'hi_40', label: '認識', text: '你好呀，希望可以認識多啲。' },
  { id: 'hi_41', label: '有時間', text: '你好，如果你有時間，想傾兩句。' },
  { id: 'hi_42', label: '簡單問', text: '你好呀，想簡單問下你平時生活點。' },
  { id: 'hi_43', label: '電影', text: '你好，你最近有冇睇戲／追劇？' },
  { id: 'hi_44', label: '旅行', text: '你好呀，你鍾意旅行嗎？最近有冇想去嘅地方？' },
  { id: 'hi_45', label: '煮飯', text: '你好，你平時自己煮多定出街食多？' },
  { id: 'hi_46', label: '咖啡', text: '你好呀，你鍾意咖啡嗎？' },
  { id: 'hi_47', label: '書', text: '你好，你平時有冇睇書嘅習慣？' },
  { id: 'hi_48', label: '遊戲', text: '你好呀，你有冇玩 game？' },
  { id: 'hi_49', label: '交朋友', text: '你好，想試下識個新朋友。' },
  { id: 'hi_50', label: '慢慢黎', text: '你好呀，可以慢慢傾，唔使有壓力。' },
];

/** Pick one opener at random; optionally avoid repeating the last id. */
export function pickRandomWhisperOpener(excludeId = null) {
  const pool = excludeId
    ? MATCH_WHISPER_OPENERS.filter((o) => o.id !== excludeId)
    : MATCH_WHISPER_OPENERS;
  const list = pool.length ? pool : MATCH_WHISPER_OPENERS;
  return list[Math.floor(Math.random() * list.length)];
}

export function buildWhisperComposeHint(remaining, max = MATCH_WHISPER_MAX_MESSAGES) {
  return `月光低語尚餘 ${remaining} 則（雙方共用最多 ${max} 則短訊）。`;
}

/**
 * @param {{
 *   viewerId: string,
 *   messages?: Array<{ sender_id?: string|null, message_type?: string }>,
 *   isSolo?: boolean,
 * }} params
 */
export function getMatchWhisperState({ viewerId, messages, isSolo = false }) {
  if (isSolo) {
    return {
      is_match_whisper: false,
      whisper_unlocked: false,
      can_compose: false,
      can_reply: false,
      compose_mode: null,
      compose_title: null,
      compose_hint: null,
      status_banner: null,
      status_footer: null,
      channel_state: 'match_only',
      channel_open: false,
      channel_round_trips: 0,
      channel_round_trips_remaining: 0,
      whisper_messages_used: 0,
      whisper_messages_remaining: 0,
      whisper_messages_max: MATCH_WHISPER_MAX_MESSAGES,
      reply_opportunity: false,
      list_meta_whisper: null,
      show_openers: false,
    };
  }

  const letters = getUserLetters(messages);
  const used = letters.length;
  const remaining = Math.max(0, MATCH_WHISPER_MAX_MESSAGES - used);
  const exhausted = remaining === 0;
  const lastLetter = letters[used - 1] || null;
  const otherSentLast = Boolean(lastLetter && lastLetter.sender_id !== viewerId);
  const canCompose = !exhausted;
  const showOpeners = canCompose && used === 0;

  let listMetaWhisper = null;
  if (exhausted) {
    listMetaWhisper = '月光低語已結束';
  } else if (used === 0) {
    listMetaWhisper = '月光低語 · 可寄第一句';
  } else if (otherSentLast) {
    listMetaWhisper = `月光低語 · 尚餘 ${remaining} 則`;
  } else {
    listMetaWhisper = remaining <= 1
      ? `月光低語 · 尚餘 ${remaining} 則`
      : '月光低語 · 月夜等待中';
  }

  return {
    is_match_whisper: true,
    whisper_unlocked: true,
    source_kind: MATCH_WHISPER_SOURCE,
    can_compose: canCompose,
    can_reply: canCompose,
    compose_mode: canCompose ? 'reply' : null,
    compose_title: used === 0 ? WHISPER_COMPOSE_TITLE_OPEN : WHISPER_COMPOSE_TITLE_REPLY,
    compose_hint: canCompose ? buildWhisperComposeHint(remaining) : null,
    status_banner: null,
    status_footer: exhausted ? WHISPER_STATUS_FOOTER_EXHAUSTED : null,
    channel_state: exhausted ? 'whisper_closed' : (used > 0 ? 'whisper_open' : 'whisper_ready'),
    channel_open: canCompose && used > 0,
    channel_round_trips: used,
    channel_round_trips_remaining: remaining,
    whisper_messages_used: used,
    whisper_messages_remaining: remaining,
    whisper_messages_max: MATCH_WHISPER_MAX_MESSAGES,
    reply_opportunity: otherSentLast && canCompose,
    list_meta_whisper: listMetaWhisper,
    show_openers: showOpeners,
  };
}
