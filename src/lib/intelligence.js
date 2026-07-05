/**
 * lib/intelligence.js
 *
 * Advanced 6-dimension compatibility engine. v4
 * Returns structured JSON for match card display and system use.
 *
 * Dimensions (0-20 each):
 *   1. attraction       -- bed role compatibility
 *   2. emotional        -- love language (floor +2) + security needs + daily love ritual
 *   3. lifestyle        -- social energy + weekend mode + interests (cap 10) + exercise_habits + travel
 *   4. communication    -- communication style + expense splitting + co-living + decision_making
 *   5. relationship     -- relationship expectation + time commitment
 *   6. conflictSafety   -- deal breakers / unacceptable traits
 *
 * Weights: attraction 15%, emotional 20%, lifestyle 15%, communication 15%, relationship 20%, conflictSafety 15%
 *
 * Non-linear adjustments (v4):
 *   - If emotional >= 14 AND communication >= 14 => +7 bonus (was >=16, +5)
 *   - If relationship <= 4 => final * 0.75
 *   - If conflictSafety <= 5 => final - 7
 *   - Soft penalty cap: 8 (was 12)
 */

import { parseCSV, parseRange, getBedRole } from './matching.js';

// helpers

function setOverlap(setA, setB) {
  let n = 0;
  for (const x of setA) if (setB.has(x)) n++;
  return n;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

const REL_COMPAT = {
  '\u8a8d\u771f\u9577\u671f\u767c\u5c55\uff1a\u4ee5\u7a69\u5b9a\u4f34\u4f36\u70ba\u76ee\u6a19\uff0c\u7a69\u5b9a\u5f8c\u8003\u616e\u672a\u4f86': {
    '\u8a8d\u771f\u9577\u671f\u767c\u5c55\uff1a\u4ee5\u7a69\u5b9a\u4f34\u4f36\u70ba\u76ee\u6a19\uff0c\u7a69\u5b9a\u5f8c\u8003\u616e\u672a\u4f86': 3,
    '\u9806\u5176\u81ea\u7136\uff1a\u6162\u6162\u4e86\u89e3\uff0c\u5514\u6025\u65bc\u5b9a\u7fa9\u95dc\u4fc2': 2,
    '\u8f15\u9b06\u76f8\u8655\uff1a\u504f\u5411 Casual\uff0c\u5514\u60f3\u6709\u592a\u591a\u6a19\u7c64\u6216\u675f\u7e1b': 0,
    '\u958b\u653e\u8a8d\u8b58\uff1a\u4ef2\u672a\u6e96\u5099\u597d\u6295\u5165\u95dc\u4fc2\uff0c\u4f46\u958b\u653e\u8b58\u4eba': 1,
  },
  '\u9806\u5176\u81ea\u7136\uff1a\u6162\u6162\u4e86\u89e3\uff0c\u5514\u6025\u65bc\u5b9a\u7fa9\u95dc\u4fc2': {
    '\u8a8d\u771f\u9577\u671f\u767c\u5c55\uff1a\u4ee5\u7a69\u5b9a\u4f34\u4f36\u70ba\u76ee\u6a19\uff0c\u7a69\u5b9a\u5f8c\u8003\u616e\u672a\u4f86': 2,
    '\u9806\u5176\u81ea\u7136\uff1a\u6162\u6162\u4e86\u89e3\uff0c\u5514\u6025\u65bc\u5b9a\u7fa9\u95dc\u4fc2': 3,
    '\u8f15\u9b06\u76f8\u8655\uff1a\u504f\u5411 Casual\uff0c\u5514\u60f3\u6709\u592a\u591a\u6a19\u7c64\u6216\u675f\u7e1b': 1,
    '\u958b\u653e\u8a8d\u8b58\uff1a\u4ef2\u672a\u6e96\u5099\u597d\u6295\u5165\u95dc\u4fc2\uff0c\u4f46\u958b\u653e\u8b58\u4eba': 2,
  },
  '\u8f15\u9b06\u76f8\u8655\uff1a\u504f\u5411 Casual\uff0c\u5514\u60f3\u6709\u592a\u591a\u6a19\u7c64\u6216\u675f\u7e1b': {
    '\u8a8d\u771f\u9577\u671f\u767c\u5c55\uff1a\u4ee5\u7a69\u5b9a\u4f34\u4f36\u70ba\u76ee\u6a19\uff0c\u7a69\u5b9a\u5f8c\u8003\u616e\u672a\u4f86': 0,
    '\u9806\u5176\u81ea\u7136\uff1a\u6162\u6162\u4e86\u89e3\uff0c\u5514\u6025\u65bc\u5b9a\u7fa9\u95dc\u4fc2': 1,
    '\u8f15\u9b06\u76f8\u8655\uff1a\u504f\u5411 Casual\uff0c\u5514\u60f3\u6709\u592a\u591a\u6a19\u7c64\u6216\u675f\u7e1b': 3,
    '\u958b\u653e\u8a8d\u8b58\uff1a\u4ef2\u672a\u6e96\u5099\u597d\u6295\u5165\u95dc\u4fc2\uff0c\u4f46\u958b\u653e\u8b58\u4eba': 2,
  },
  '\u958b\u653e\u8a8d\u8b58\uff1a\u4ef2\u672a\u6e96\u5099\u597d\u6295\u5165\u95dc\u4fc2\uff0c\u4f46\u958b\u653e\u8b58\u4eba': {
    '\u8a8d\u771f\u9577\u671f\u767c\u5c55\uff1a\u4ee5\u7a69\u5b9a\u4f34\u4f36\u70ba\u76ee\u6a19\uff0c\u7a69\u5b9a\u5f8c\u8003\u616e\u672a\u4f86': 1,
    '\u9806\u5176\u81ea\u7136\uff1a\u6162\u6162\u4e86\u89e3\uff0c\u5514\u6025\u65bc\u5b9a\u7fa9\u95dc\u4fc2': 2,
    '\u8f15\u9b06\u76f8\u8655\uff1a\u504f\u5411 Casual\uff0c\u5514\u60f3\u6709\u592a\u591a\u6a19\u7c64\u6216\u675f\u7e1b': 2,
    '\u958b\u653e\u8a8d\u8b58\uff1a\u4ef2\u672a\u6e96\u5099\u597d\u6295\u5165\u95dc\u4fc2\uff0c\u4f46\u958b\u653e\u8b58\u4eba': 3,
  },
};

// soft penalties (v3: -6 identity each direction, -4 body, -3 height, -3 age; cap -12)

function softPenalties(a, b) {
  let p = 0;
  const aIdeal = parseCSV(a.ideal_identity), bIdeal = parseCSV(b.ideal_identity);
  if (aIdeal.size > 0 && !aIdeal.has('\u5514\u6240\u8b02') && !aIdeal.has(b.identity)) p += 6;
  if (bIdeal.size > 0 && !bIdeal.has('\u5514\u6240\u8b02') && !bIdeal.has(a.identity)) p += 6;
  const aBP = parseCSV(a.ideal_appearance ?? a.ideal_body_type ?? '');
  const bBP = parseCSV(b.ideal_appearance ?? b.ideal_body_type ?? '');
  if (aBP.size > 0 && !aBP.has('\u5514\u6240\u8b02') && !aBP.has(b.body_type)) p += 4;
  if (bBP.size > 0 && !bBP.has('\u5514\u6240\u8b02') && !bBP.has(a.body_type)) p += 4;
  if (a.height && b.height) {
    const ar = parseRange(a.ideal_height_gap), br = parseRange(b.ideal_height_gap);
    if (ar && (b.height - a.height < ar.min || b.height - a.height > ar.max)) p += 3;
    if (br && (a.height - b.height < br.min || a.height - b.height > br.max)) p += 3;
  }
  if (a.age && b.age) {
    const ar = parseRange(a.ideal_age_gap), br = parseRange(b.ideal_age_gap);
    if (ar && (b.age - a.age < ar.min || b.age - a.age > ar.max)) p += 3;
    if (br && (a.age - b.age < br.min || a.age - b.age > br.max)) p += 3;
  }
  return p;
}

// dimension 1 -- attraction
// Role = interaction energy preference. Auxiliary: daily_love_ritual intensity alignment.

function scoreAttraction(a, b) {
  const ra = getBedRole(a.bed_role), rb = getBedRole(b.bed_role);
  let base;
  if ((ra === 'Top' && rb === 'Bottom') || (ra === 'Bottom' && rb === 'Top')) base = 18;
  else if (ra === 'Switch' && rb === 'Switch') base = 15;
  else if (ra === 'Switch' || rb === 'Switch') base = 16;
  else if (ra === 'neutral' || rb === 'neutral') base = 12;
  else if (ra === rb) base = 10; // v4: same-role raised 6→10 (same-role couples common in F/F)
  else base = 10;

  // Auxiliary: daily love ritual energy match (+0 to +2)
  let aux = 0;
  if (a.daily_love_ritual && b.daily_love_ritual) {
    aux = a.daily_love_ritual === b.daily_love_ritual ? 2 : 0;
  }
  return clamp(base + aux, 0, 20);
}

// dimension 2 -- emotional

function scoreEmotional(a, b) {
  let s = 0;
  // v4: floor +2 even with 0 overlap (both use love-language framework = baseline resonance)
  const llOverlap = setOverlap(parseCSV(a.love_languages), parseCSV(b.love_languages));
  s += llOverlap > 0 ? Math.min(llOverlap * 5, 10) : 2;
  if (a.security_needs && b.security_needs) {
    if (a.security_needs === b.security_needs) {
      s += 6;
    } else {
      const tension = a.security_needs.includes('\u81ea\u7531\u7a7a\u9593') !== b.security_needs.includes('\u81ea\u7531\u7a7a\u9593');
      s += tension ? 1 : 3;
    }
  }
  if (a.daily_love_ritual && b.daily_love_ritual)
    s += a.daily_love_ritual === b.daily_love_ritual ? 4 : 1;
  return clamp(s, 0, 20);
}

// dimension 3 -- lifestyle

function scoreLifestyle(a, b) {
  let s = 0;
  if (a.social_energy && b.social_energy) {
    s += a.social_energy === b.social_energy ? 5
       : (a.social_energy.includes('\u52d5\u975c\u7686\u5b9c') || b.social_energy.includes('\u52d5\u975c\u7686\u5b9c')) ? 3 : 1;
  }
  if (a.weekend_mode && b.weekend_mode) {
    s += a.weekend_mode === b.weekend_mode ? 5
       : (a.weekend_mode.includes('\u5e73\u8861\u6d3e') || a.weekend_mode.includes('\u96a8\u5fc3\u6d3e') ||
          b.weekend_mode.includes('\u5e73\u8861\u6d3e') || b.weekend_mode.includes('\u96a8\u5fc3\u6d3e')) ? 3 : 1;
  }
  // v4: cap raised 6→10, add exercise_habits signal
  s += Math.min(setOverlap(parseCSV(a.interests), parseCSV(b.interests)) * 2, 10);
  s += Math.min(setOverlap(parseCSV(a.exercise_habits), parseCSV(b.exercise_habits)) * 2, 4);
  if (a.travel_mode && b.travel_mode)
    s += a.travel_mode === b.travel_mode ? 4 : 1;
  return clamp(s, 0, 20);
}

// dimension 4 -- communication

function scoreCommunication(a, b) {
  let s = 0;
  if (a.communication_style && b.communication_style) {
    const tension =
      (a.communication_style.includes('\u76f4\u7403') && b.communication_style.includes('\u89c0\u5bdf\u7559\u767d')) ||
      (b.communication_style.includes('\u76f4\u7403') && a.communication_style.includes('\u89c0\u5bdf\u7559\u767d'));
    s += a.communication_style === b.communication_style ? 8 : tension ? 1 : 4;
  }
  if (a.expense_splitting && b.expense_splitting) {
    const softMatch =
      (a.expense_splitting.includes('AA') && b.expense_splitting.includes('\u4f60\u4e00\u9910')) ||
      (b.expense_splitting.includes('AA') && a.expense_splitting.includes('\u4f60\u4e00\u9910'));
    s += a.expense_splitting === b.expense_splitting ? 6 : softMatch ? 3 : 1;
  }
  if (a.living_together && b.living_together) {
    const hardConflict =
      (a.living_together.includes('\u65e9\u65e5') && b.living_together.includes('\u5404\u81ea')) ||
      (b.living_together.includes('\u65e9\u65e5') && a.living_together.includes('\u5404\u81ea'));
    s += a.living_together === b.living_together ? 6 : hardConflict ? 0 : 3;
  }
  // v4: decision_making — complementary (直覺+事實) = +5; same = +2
  if (a.decision_making && b.decision_making) {
    const complement =
      (a.decision_making.includes('\u76f4\u89ba') && b.decision_making.includes('\u4e8b\u5be6')) ||
      (b.decision_making.includes('\u76f4\u89ba') && a.decision_making.includes('\u4e8b\u5be6'));
    s += complement ? 5 : 2;
  }
  return clamp(s, 0, 20);
}

// dimension 5 -- relationship

function scoreRelationship(a, b) {
  let s = 0;
  if (a.relationship_goal && b.relationship_goal) {
    const c = REL_COMPAT[a.relationship_goal]?.[b.relationship_goal] ?? 1;
    s += [0, 2, 8, 14][c];
  }
  const timeOpts = ['\u5e7e\u4e4e\u6bcf\u65e5\u898b', '\u4e00\u661f\u671f 2', '\u4e00\u661f\u671f 1', '\u8996\u4e4e\u5de5\u4f5c'];
  const ai = timeOpts.findIndex(o => a.time_commitment?.includes(o));
  const bi = timeOpts.findIndex(o => b.time_commitment?.includes(o));
  if (ai >= 0 && bi >= 0) {
    const d = Math.abs(ai - bi);
    s += d === 0 ? 6 : d === 1 ? 4 : d === 2 ? 2 : 0;
  }
  return clamp(s, 0, 20);
}

// dimension 6 -- conflictSafety (v3 Safety Score — higher = safer)
// Shared deal-breakers = common values → safety. Direct trigger conflicts = danger.

function scoreConflictSafety(a, b) {
  const aDB = parseCSV(a.deal_breakers), bDB = parseCSV(b.deal_breakers);

  // Direct trigger conflict: B's behaviour matches A's trigger (and vice versa)
  let violations = 0;
  if (b.communication_style?.includes('\u89c0\u5bdf\u7559\u767d') && aDB.has('\u51b7\u66b4\u529b / \u5df2\u8b80\u4e0d\u56de / \u5514\u6e9d\u901a')) violations++;
  if (a.communication_style?.includes('\u89c0\u5bdf\u7559\u767d') && bDB.has('\u51b7\u66b4\u529b / \u5df2\u8b80\u4e0d\u56de / \u5514\u6e9d\u901a')) violations++;

  // Strong avoidance pattern: both use cold communication
  if (
    a.communication_style?.includes('\u89c0\u5bdf\u7559\u767d') &&
    b.communication_style?.includes('\u89c0\u5bdf\u7559\u767d')
  ) return 2;

  if (violations >= 2) return 4;
  if (violations === 1) return 10;

  // Safety from shared triggers (common values alignment)
  const shared = setOverlap(aDB, bDB);
  if (shared >= 2) return 20;
  if (shared === 1) return 16;
  return 14;
}

// summary

const LABELS = {
  attraction: '火花',
  emotional: '情感共鳴',
  lifestyle: '生活步調',
  communication: '溝通價值',
  relationship: '關係期望',
  conflictSafety: '相處安全感',
};

function rankDims(scores) {
  const e = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { strongest: e[0][0], weakest: e[e.length - 1][0] };
}

function buildSummary(scores, finalScore, penalty) {
  const { strongest, weakest } = rankDims(scores);
  let type;
  if (finalScore >= 80) type = '靈魂同頻者候選';
  else if (finalScore >= 65) type = '\u9ad8\u5ea6\u5951\u5408';
  else if (finalScore >= 50) type = '\u5024\u5f97\u6df1\u5165\u4e86\u89e3';
  else if (finalScore >= 35) type = '\u6709\u6f5b\u529b\uff0c\u9700\u78e8\u5408';
  else type = '\u5dee\u7570\u8f03\u5927';

  const strengths = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]).slice(0, 2)
    .filter(([, v]) => v >= 12).map(([k]) => LABELS[k]);

  // 爪印提醒（建議感語氣，取代原本的警告式文字）
  const risks = [];
  if (scores.conflictSafety <= 5)  risks.push('在衝突處理上你們的模式較為不同，初期多「說出來」比沉默更有效');
  if (scores.relationship <= 8)    risks.push('你們對未來的節奏略有不同，這正是深度溝通的契合點');
  if (scores.communication <= 8)   risks.push('溝通節奏稍有不同，找到專屬你們的相處默契需要一點時間');
  if (scores.emotional <= 8)       risks.push('表達愛的方式各有不同，試著主動說出你的需求，對方更容易接住');
  if (penalty >= 10)               risks.push('外在條件有小差異，但這恰恰是讓兩人互相探索的有趣起點');
  if (risks.length === 0)          risks.push('基礎已很穩固！主要的考驗將是如何在社群交流中持續滋養這段連結');

  const action = finalScore >= 65 ? '建議在社群內積極交流'
               : finalScore >= 45 ? '可先嘗試線上交流了解'
               : '需要更多了解彼此再決定';

  // 隨機文案 pool（依分數段各備 3–4 條）
  const sl = LABELS[strongest];
  const wl = weakest !== 'conflictSafety' ? LABELS[weakest] : null;
  const wPart = wl ? `，${wl}方面尚有磨合空間` : '';
  let textPool;
  if (finalScore >= 80) {
    textPool = [
      `這對靈魂在月光下產生了強烈共振！你們在${sl}的契合度簡直是天作之合，靈貓都忍不住多看了一眼🐈‍⬛✨ 雙方基礎相容度 ${finalScore} 分，${action}。`,
      `靈魂同頻者候選！靈貓認證：你們在${sl}方面的共鳴是本季最高紀錄${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `月光下的相遇，命中注定。在${sl}方面你們幾乎像同一個靈魂的兩半${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `${type}。你們在${sl}方面的頻率幾乎完美對齊，是極為罕見的靈魂共振${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
    ];
  } else if (finalScore >= 65) {
    textPool = [
      `${type}！你們在${sl}方面有著令人驚喜的默契${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `靈貓嗅到了一段有潛質的連結🐾 在${sl}方面表現尤為突出${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `${type}。在${sl}方面你們的頻率高度吻合，值得進一步探索${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
    ];
  } else if (finalScore >= 50) {
    textPool = [
      `${type}。在${sl}方面有不錯的共鳴${wPart}，多幾次交流就能更了解彼此。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `這段共鳴值得你們細細品味✨ ${sl}方面的契合令靈貓印象深刻${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `${type}。在${sl}方面你們有共同的出發點${wPart}，慢慢磨合可能擦出意外的火花。雙方基礎相容度 ${finalScore} 分，${action}。`,
    ];
  } else if (finalScore >= 35) {
    textPool = [
      `${type}。你們在${sl}方面展現出一些潛力${wPart}，彼此多一些耐心，或許會有驚喜。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `差異是了解的起點🌙 在${sl}方面有可發展的空間${wPart}。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `${type}。在${sl}方面略有共鳴${wPart}，若兩人願意多交流，說不定能慢慢找到默契。雙方基礎相容度 ${finalScore} 分，${action}。`,
    ];
  } else {
    textPool = [
      `${type}。目前在${sl}方面的共鳴相對有限${wPart}，但每一次了解都是有意義的嘗試。雙方基礎相容度 ${finalScore} 分，${action}。`,
      `${type}。你們的頻率在${sl}方面有一絲交集${wPart}，相識已是共鳴，其餘交由時間。雙方基礎相容度 ${finalScore} 分，${action}。`,
    ];
  }
  const text = textPool[Math.floor(Math.random() * textPool.length)];

  // Persona 稱號（依前兩名維度組合）
  const top2 = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const personaMap = [
    { dims: ['attraction', 'lifestyle'],        label: '冒險型拍檔',  emoji: '🏃‍♀️🔥' },
    { dims: ['emotional', 'conflictSafety'],    label: '療癒系靈魂',  emoji: '🍵🌙' },
    { dims: ['communication', 'relationship'],  label: '高效率隊友',  emoji: '🤝📊' },
    { dims: ['attraction', 'emotional'],        label: '電力四射',    emoji: '⚡💘' },
    { dims: ['emotional', 'lifestyle'],         label: '慢活系情侶',  emoji: '🌿☕' },
    { dims: ['lifestyle', 'conflictSafety'],    label: '舒適圈同伴',  emoji: '🛋️✨' },
    { dims: ['communication', 'emotional'],     label: '心靈交流者',  emoji: '💬🌟' },
    { dims: ['relationship', 'conflictSafety'], label: '安穩守護者',  emoji: '🏡🌙' },
    { dims: ['attraction', 'communication'],    label: '直率型愛人',  emoji: '✨💬' },
    { dims: ['lifestyle', 'relationship'],      label: '生活夢想家',  emoji: '🌸📅' },
    { dims: ['emotional', 'relationship'],      label: '深情續變者',  emoji: '🌊💜' },
    { dims: ['attraction', 'conflictSafety'],         label: '熱情守護神',   emoji: '🔥🛡️' },
    { dims: ['communication', 'conflictSafety'],       label: '高情緒價値拍檔',   emoji: '💬❤️‍🔥' },
  ];
  const matched = personaMap.find(p => p.dims.every(d => top2.includes(d)));
  const persona = matched ? `${matched.emoji} ${matched.label}` : '🌙✨ 靈魂共鳴者';

  return { type, text, strengths, risks: risks.slice(0, 2), persona };
}

// main export

export function computeCompatibility(userA, userB) {
  const penalty = softPenalties(userA, userB);

  const dim = {
    attraction:      scoreAttraction(userA, userB),
    emotional:       scoreEmotional(userA, userB),
    lifestyle:       scoreLifestyle(userA, userB),
    communication:   scoreCommunication(userA, userB),
    relationship:    scoreRelationship(userA, userB),
    conflictSafety:  scoreConflictSafety(userA, userB),
  };

  const weights = { attraction: 0.15, emotional: 0.20, lifestyle: 0.15, communication: 0.15, relationship: 0.20, conflictSafety: 0.15 };
  const weighted = Object.entries(dim).reduce((s, [k, v]) => s + v * weights[k], 0);
  let finalScore = Math.round((weighted / 20) * 100);

  // Non-linear adjustments (v4: lower dual-high threshold ≥14, bigger bonus +7; soft penalty cap 12→8)
  if (dim.emotional >= 14 && dim.communication >= 14) finalScore = Math.min(100, finalScore + 7);
  if (dim.relationship <= 4) finalScore = Math.round(finalScore * 0.75);
  if (dim.conflictSafety <= 5) finalScore = Math.max(0, finalScore - 7);
  finalScore = clamp(finalScore - Math.min(penalty, 8), 0, 100);

  const { strongest, weakest } = rankDims(dim);
  const scoreSpread = Math.max(...Object.values(dim)) - Math.min(...Object.values(dim));
  const matchConfidence = finalScore >= 65 && scoreSpread <= 10 ? 'high'
    : finalScore >= 45 || scoreSpread <= 15 ? 'medium' : 'low';

  // Insights: human-readable explanation array
  const insights = [];
  const top = Object.entries(dim).sort((a, b) => b[1] - a[1]);
  const [topKey, topVal] = top[0];
  const [botKey, botVal] = top[top.length - 1];
  insights.push(`最高維度：${LABELS[topKey]}（${topVal}/20）— 雙方在此方面高度契合`);
  if (botVal < 10) insights.push(`待改善：${LABELS[botKey]}（${botVal}/20）— 建議雙方在此多加溝通`);
  if (dim.emotional >= 16 && dim.communication >= 16) insights.push('情感共鳴與溝通同步雙高，關係韌性強，即使遇到挑戰也易修復');
  if (dim.relationship <= 4) insights.push('關係期望差距過大（×0.75 懲罰），目標不一致是任何高相容性都無法彌補的鴻溝');
  if (dim.conflictSafety <= 5) insights.push('相處安全感極低，雙方存在明顯冷暴力傾向衝突（-7 懲罰）');
  if (penalty > 0) insights.push(`外在條件偏好落差扣除 ${Math.min(penalty, 12)} 分，但不影響核心相容性`);
  if (matchConfidence === 'high') insights.push('各維度分布均勻，整體契合度穩定可信');

  return {
    match: true,
    finalScore,
    dimensionScores: dim,
    summary: buildSummary(dim, finalScore, penalty),
    insights,
  };
}

// ─────────────────────────────────────────────
// interpretScores — human-readable layer
// Takes pre-computed scores (from existing match API or legacy system)
// and returns structured insights JSON.
//
// Input field mapping:
//   bedRoleScore      -> attraction
//   loveLanguageScore -> emotional
//   socialScore       -> lifestyle
//   valuesScore       -> communication
//   relationshipScore -> relationship
//   riskScore         -> risk
//   totalScore        -> 0-100 overall
// ─────────────────────────────────────────────

export function interpretScores({
  bedRoleScore = 0,
  loveLanguageScore = 0,
  socialScore = 0,
  valuesScore = 0,
  relationshipScore = 0,
  riskScore = 0,
  totalScore = 0,
}) {
  const dim = {
    attraction:    bedRoleScore,
    emotional:     loveLanguageScore,
    lifestyle:     socialScore,
    communication: valuesScore,
    relationship:  relationshipScore,
    conflictSafety: riskScore,
  };

  // ── Step 2: relationship type + summary text ──────────────

  let type;
  let text;

  if (dim.relationship >= 14 && dim.emotional >= 14) {
    type = '\u9ad8\u5951\u5408\u7a69\u5b9a\u578b'; // 高契合穩定型
    text = '\u5169\u4eba\u5c0d\u95dc\u4fc2\u7684\u671f\u5f85\u548c\u60c5\u611f\u9700\u6c42\u9ad8\u5ea6\u4e00\u81f4\uff0c\u76f8\u8655\u8d77\u4f86\u81ea\u7136\u800c\u7a69\u5b9a\u3002'; // 兩人對關係的期待和情感需求高度一致，相處起來自然而穩定。
  } else if (dim.attraction >= 16 && dim.emotional >= 14) {
    type = '\u6fc0\u60c5\u5171\u9cf4\u578b'; // 激情共鳴型
    text = '\u706b\u82b1\u5f37\u70c8\uff0c\u60c5\u611f\u9023\u7d50\u6df1\uff0c\u76f8\u4e92\u4e4b\u9593\u6709\u8457\u5f37\u70c8\u7684\u5438\u5f15\u529b\u548c\u60c5\u611f\u5171\u9cf4\u3002'; // 火花強烈，情感連結深，相互之間有著強烈的吸引力和情感共鳴。
  } else if (dim.emotional >= 16) {
    type = '\u60c5\u611f\u9023\u7d50\u578b'; // 情感連結型
    text = '\u60c5\u611f\u4e0a\u7684\u5c0d\u9ede\u662f\u9019\u5c0d\u914d\u5c0d\u7684\u6838\u5fc3\uff0c\u5169\u4eba\u61c2\u5f97\u5982\u4f55\u5c0d\u5c0d\u65b9\u5c55\u73fe\u95dc\u5fc3\u548c\u652f\u6301\u3002'; // 情感上的對點是這對配對的核心，兩人懂得如何對對方展現關心和支持。
  } else if (dim.lifestyle >= 14 && dim.communication >= 14) {
    type = '\u751f\u6d3b\u540c\u6b65\u578b'; // 生活同步型
    text = '\u751f\u6d3b\u7bc0\u594f\u548c\u50f9\u5024\u89c0\u76f8\u8fd1\uff0c\u65e5\u5e38\u76f8\u8655\u8d77\u4f86\u6d41\u66a2\uff0c\u5c11\u6709\u6469\u64e6\u3002'; // 生活節奏和價值觀相近，日常相處起來流暢，少有磨擦。
  } else if (totalScore >= 50) {
    type = '\u63a2\u7d22\u6210\u9577\u578b'; // 探索成長型
    text = '\u5169\u4eba\u5404\u6709\u81ea\u5df1\u7684\u7279\u8cea\uff0c\u9084\u6709\u7a7a\u9593\u7d66\u5c0d\u65b9\u60da\u559c\uff0c\u9700\u8981\u591a\u4e9b\u6642\u9593\u76f8\u4e92\u78e8\u5408\u3002'; // 兩人各有自己的特質，還有空間給對方慢慢喜歡，需要多些時間相互磨合。
  } else {
    type = '\u5dee\u7570\u8f03\u5927'; // 差異較大
    text = '\u5169\u4eba\u5728\u591a\u500b\u9762\u5411\u5b58\u5728\u5dee\u7570\uff0c\u9700\u8981\u5f7c\u6b64\u4e86\u89e3\u548c\u5305\u5bb9\u624d\u6709\u6f5b\u529b\u767c\u5c55\u3002'; // 兩人在多個面向存在差異，需要彼此了解和包容才有潛力發展。
  }

  if (dim.conflictSafety < 10) {
    text += '\u4e0d\u904e\u9700\u8981\u6ce8\u610f\u5169\u4eba\u4e4b\u9593\u7684\u6f5b\u5728\u885d\u7a81\uff0c\u5efa\u8b70\u5c431\u5f9e\u6e9d\u901a\u65b9\u5f0f\u4e0a\u5373\u65e9\u5efa\u7acb\u5171\u8b58\u3002'; // 不過需要注意兩人之間的潛在衝突，建議從溝通方式上盡早建立共識。
  }

  // ── Step 3: strengths ─────────────────────────────────────

  const strengthPhrases = {
    attraction:    '\u706b\u82b1\u5f37\u70c8\uff0c\u5438\u5f15\u529b\u9ad8',    // 火花強烈，吸引力高
    emotional:     '\u60c5\u611f\u5171\u9cf4\uff0c\u61c2\u5f97\u5f7c\u6b64',    // 情感共鳴，懂得彼此
    lifestyle:     '\u6b65\u8abf\u4e00\u81f4\uff0c\u76f8\u8655\u81ea\u7136',    // 步調一致，相處自然
    communication: '\u6e9d\u901a\u9806\u7551\uff0c\u50f9\u5024\u89c0\u63a5\u8fd1', // 溝通順暢，價值觀接近
    relationship:  '\u95dc\u4fc2\u671f\u671b\u4e00\u81f4\uff0c\u767c\u5c55\u65b9\u5411\u76f8\u540c', // 關係期望一致，發展方向相同
    conflictSafety: '\u76f8\u8655\u5b89\u5168\u611f\u9ad8\uff0c\u885d\u7a81\u98a8\u96aa\u4f4e', // 相處安全感高，衝突風險低
  };

  const strengths = Object.entries(dim)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, v]) => v >= 10)
    .map(([k]) => strengthPhrases[k]);

  // ── Step 4: risks ─────────────────────────────────────────

  const riskPhrases = {
    emotional:      '\u9700\u8981\u66f4\u591a\u60c5\u611f\u4ea4\u6d41',           // 需要更多情感交流
    communication:  '\u6e9d\u901a\u65b9\u5f0f\u53ef\u80fd\u51fa\u73fe\u843d\u5dee', // 溝通方式可能出現落差
    lifestyle:      '\u751f\u6d3b\u7bc0\u594f\u672a\u5fc5\u4e00\u81f4',           // 生活節奏未必一致
    relationship:   '\u5c0d\u95dc\u4fc2\u671f\u5f85\u4e0d\u540c',                 // 對關係期待不同
    conflictSafety: '\u76f8\u8655\u5b89\u5168\u611f\u4f4e\uff0c\u5b58\u5728\u6f5b\u5728\u885d\u7a81', // 相處安全感低，存在潛在衝突
    attraction:     '\u706b\u82b1\u4e0d\u5920\u5f37\u70c8\uff0c\u53ef\u80fd\u9700\u8981\u6642\u9593\u57f9\u990a\u5438\u5f15\u529b', // 火花不夠強烈，可能需要時間培養吸引力
  };

  const risks = Object.entries(dim)
    .filter(([, v]) => v < 10)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([k]) => riskPhrases[k]);

  // ── Step 5: prediction ────────────────────────────────────

  let prediction;
  if (dim.relationship >= 16 && dim.emotional >= 14) {
    prediction = '\u9069\u5408\u9577\u671f\u767c\u5c55'; // 適合長期發展
  } else if (dim.attraction >= 18 && dim.relationship < 10) {
    prediction = '\u9ad8\u706b\u82b1\u77ed\u671f'; // 高火花短期
  } else if (dim.lifestyle >= 16 && dim.communication >= 14) {
    prediction = '\u7a69\u5b9a\u9670\u4f34\u578b'; // 穩定陪伴型
  } else {
    prediction = '\u9700\u8981\u6642\u9593\u57f9\u990a'; // 需要時間培養
  }

  return { summary: { type, text }, strengths, risks, prediction };
}