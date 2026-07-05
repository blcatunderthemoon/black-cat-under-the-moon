/**
 * Shared mirror personality card data & helpers.
 * Used by the public /mirror-card/[slug] page.
 */

export const PERSONALITY_TYPES = {
  solitary: {
    nameZh: '獨處貓家族',
    nameEn: 'The Solitary Moon',
    color: '#bd93f9',
    factorName: '月光因子',
    hashtags: ['#給空間才給心', '#獨處充電人類', '#一個人也很好但有你更好'],
    warning: '遇到突然黏上來、打亂個人計劃的人，自動開啟隱形模式，消失三天再出現說沒事。',
    desc: '你是一隻住在月亮上的貓，愛情對你來說是點綴，而不是全部。你不是不愛，只是你的愛需要空間才能呼吸。',
    guideNeedKeys: ['autonomy', 'predictability'],
    guideResonate: '靠近你之前，最好先問一聲「現在方便聊嗎？」——被尊重節奏的人，你會願意走得更近。',
  },
  sunny: {
    nameZh: '暖陽貓家族',
    nameEn: 'The Sunny Tether',
    color: '#ff6b9d',
    factorName: '暖陽熱能',
    hashtags: ['#直球對決選手', '#定義關係先別怕', '#公開曬恩愛達人'],
    warning: '遇到態度曖昧、拒絕定義關係的人，直接傳長文問清楚，不清楚不罷休。',
    desc: '你喜歡曬太陽，也希望對方的世界裡只有溫暖。你的愛是直接，你要的是清晰而公開。',
    guideNeedKeys: ['validation', 'expressiveness'],
    guideResonate: '別用「隨緣」敷衍你。清楚說出你在乎、關係有定位，你的心才會真正定下來。',
  },
  mystical: {
    nameZh: '秘境貓家族',
    nameEn: 'The Mystical Depth',
    color: '#00e5ff',
    factorName: '秘境電波',
    hashtags: ['#只想被懂不想被講道理', '#靈魂頻率對了才開門', '#沉默也是對話'],
    warning: '遇到用道理而非感受回應的人，當場關掉情緒出口，從此沉默如謎。',
    desc: '你潛伏在黑夜深處，只為等待那個能聽懂你頻率的人。道理不重要，被理解才是你最深的渴望。',
    guideNeedKeys: ['emotional_resonance', 'autonomy'],
    guideResonate: '情緒上頭時，先陪你坐一會，別急著分析對錯。感受被接住了，理智才進得來。',
  },
  sentinel: {
    nameZh: '守護貓家族',
    nameEn: 'The Eternal Sentinel',
    color: '#50fa7b',
    factorName: '守護力場',
    hashtags: ['#PlanB狂魔', '#計劃內的浪漫最動人', '#訊息不回會內心扣分'],
    warning: '遇到遲到不講、臨時改行程的人，內心的護盾會當場加厚 300%。',
    desc: '你是守護壁爐的貓，最怕變動與突如其來的驚嚇。你的愛是一種承諾，是每天都會回來的穩定。',
    guideNeedKeys: ['predictability', 'commitment'],
    guideResonate: '改行程前說一聲、答應的時間準時出現——這些日常小細節，比驚喜更能讓你安心。',
  },
};

export const HYBRID_TITLES = {
  'solitary+sunny':    '[ ☀️ 荒野玫瑰與暖陽 ]',
  'solitary+mystical': '[ 🌙 月光下嘅電波解碼者 ]',
  'solitary+sentinel': '[ 🛡️ 深淵獨行守夜人 ]',
  'sunny+solitary':    '[ 🌟 寂靜星空嘅尋光者 ]',
  'sunny+mystical':    '[ ✨ 霓虹秘境嘅愛情魔法師 ]',
  'sunny+sentinel':    '[ 🔥 鐵壁之下嘅溫柔侵略者 ]',
  'mystical+solitary': '[ 🌑 月影裂縫嘅靈魂占卜師 ]',
  'mystical+sunny':    '[ 💫 螢光狂歡嘅電波密語者 ]',
  'mystical+sentinel': '[ ⚡ 霧中堡壘嘅深淵探索者 ]',
  'sentinel+solitary': '[ 🌠 孤城深處嘅星空守望者 ]',
  'sentinel+sunny':    '[ 🌺 鐵甲之下嘅玫瑰魂靈 ]',
  'sentinel+mystical': '[ 🔮 秘境邊境嘅魔法衛士 ]',
};

export const CAT_IMG_MAP = {
  solitary: '/Solitary_Moon.png',
  sunny:    '/Sunny_Tether.png',
  mystical: '/Mystical_Depth.png',
  sentinel: '/Eternal_Sentinel.png',
};

export const CAT_GLOW_MAP = {
  solitary: '#9b6fff',
  sunny:    '#ff6b9d',
  mystical: '#00d4ff',
  sentinel: '#50fa7b',
};

export const MIRROR_EMOJI = {
  solitary: '🌙',
  sunny: '☀️',
  mystical: '📡',
  sentinel: '🛡️',
};

/** Chinese display name for mirror family type key */
export function getFamilyNameZh(type) {
  if (!type) return '—';
  return PERSONALITY_TYPES[type]?.nameZh || type;
}

/** Full display metadata for badges / chips */
export function getFamilyMeta(type) {
  if (!type || !PERSONALITY_TYPES[type]) return null;
  const family = PERSONALITY_TYPES[type];
  return {
    key: type,
    nameZh: family.nameZh,
    nameEn: family.nameEn,
    emoji: MIRROR_EMOJI[type] || '🐾',
    color: family.color,
    glow: CAT_GLOW_MAP[type] || family.color,
    img: CAT_IMG_MAP[type],
    factorName: family.factorName,
  };
}

export const TYPE_ORDER = ['solitary', 'sunny', 'mystical', 'sentinel'];

export const MBTI_UNKNOWN_LABEL = '唔知道';

/** MBTI values that mean "unknown" — omitted from mirror card display. */
export function normalizeMirrorMbti(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s === MBTI_UNKNOWN_LABEL || s === '不知道' || s.toLowerCase() === 'unknown') return null;
  return s;
}

export function getPublicProfile(basicAnswers) {
  const ba = basicAnswers || {};
  return {
    label: ba.p1 || null,
    mbti: normalizeMirrorMbti(ba.p2_mbti),
    zodiac: ba.p2_zodiac || null,
  };
}

export function computeHybridTitle(scores, mainType, shadowType) {
  if (!shadowType || !scores) return null;
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const hybridKey = `${mainType}+${shadowType}`;
  const lv = 20 + Math.round(((scores[mainType] || 0) / total) * 77);
  return (HYBRID_TITLES[hybridKey] || '[ 混血靈魂 ]').replace(' ]', ` • Lv.${lv} ]`);
}

export function getTopIngredientBars(scores) {
  if (!scores) return [];
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  return TYPE_ORDER
    .filter((k) => scores[k] > 0)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, 3)
    .map((k) => ({
      key: k,
      pct: Math.round((scores[k] / total) * 100),
      label: PERSONALITY_TYPES[k]?.factorName || k,
      color: PERSONALITY_TYPES[k]?.color || '#bd93f9',
    }));
}

export function splitCsv(value) {
  if (!value) return [];
  return String(value).split(', ').filter(Boolean);
}

export function cleanHobbyTag(t) {
  let cleaned = t.trim();
  cleaned = cleaned.replace(/\s*\/\s*(DIY|烹飪)$/, '');
  if (/^[\u4e00-\u9fff]/.test(cleaned)) {
    cleaned = cleaned.replace(/\s+[A-Za-z].*$/, '');
  }
  return cleaned;
}

export const ZODIAC_ZH_TO_EN = {
  牡羊座: 'Aries',
  金牛座: 'Taurus',
  雙子座: 'Gemini',
  巨蟹座: 'Cancer',
  獅子座: 'Leo',
  處女座: 'Virgo',
  天秤座: 'Libra',
  天蠍座: 'Scorpio',
  射手座: 'Sagittarius',
  摩羯座: 'Capricorn',
  水瓶座: 'Aquarius',
  雙魚座: 'Pisces',
};

/** Display zodiac in English on public cards; pass through if already Latin. */
export function formatZodiacDisplay(zodiac) {
  if (!zodiac) return null;
  const trimmed = String(zodiac).trim();
  return ZODIAC_ZH_TO_EN[trimmed] || trimmed;
}

const PCARD_CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff·]/u;

/** Split mirror card copy into Chinese vs Latin runs for mixed typography. */
export function splitPcardMixedText(text) {
  if (text == null || text === '') return [];
  return String(text)
    .split(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff·]+)/u)
    .filter(Boolean)
    .map((part) => ({ text: part, zh: PCARD_CJK_RE.test(part) }));
}

/** Header title for /mirror-card/[slug] — owner name + Mirror Card (mixed pixel type). */
export function getMirrorCardPageTitle(displayName) {
  const name = String(displayName || '神秘貓咪').slice(0, 12);
  return `${name} 的 Mirror Card`;
}
