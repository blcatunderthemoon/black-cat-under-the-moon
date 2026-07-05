(function (global) {
'use strict';
const MIRROR_PSYCH_QUESTIONS_V3 = [
  {
    "id": "m_q1",
    "part": 1,
    "partTitle": "生活場景 Life Scenarios",
    "label": "Q1",
    "domain": "work",
    "text": "老闆突然將項目 Deadline 提前一週。你第一個反應？",
    "type": "trait_single",
    "field": "m_q1",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "reprioritize",
        "text": "重新安排自己嘅優先次序",
        "traits": {
          "autonomy": 2,
          "predictability": 1
        }
      },
      {
        "key": "discuss_team",
        "text": "即刻搵同事討論點分工",
        "traits": {
          "expressiveness": 2,
          "commitment": 1
        }
      },
      {
        "key": "understand_why",
        "text": "先了解點解要改期",
        "traits": {
          "emotional_resonance": 1,
          "predictability": 1
        }
      },
      {
        "key": "hurry_plan",
        "text": "有少少躁，但要快啲定方案",
        "traits": {
          "predictability": 2,
          "expressiveness": 1
        }
      }
    ]
  },
  {
    "id": "m_q2",
    "part": 1,
    "label": "Q2",
    "domain": "intimacy",
    "text": "週末終於放假。另一半話：「我想成日都同你一齊。」你第一個反應？",
    "type": "trait_single",
    "field": "m_q2",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "all_day_together",
        "text": "好呀，最好全日一齊",
        "traits": {
          "validation": 2,
          "commitment": 1
        }
      },
      {
        "key": "reserve_time",
        "text": "可以，但想預留少少自己時間",
        "traits": {
          "autonomy": 2,
          "validation": 1
        }
      },
      {
        "key": "mood_decide",
        "text": "睇當日心情再決定",
        "traits": {
          "autonomy": 1,
          "emotional_resonance": 2
        }
      },
      {
        "key": "plan_ahead",
        "text": "不如一早計劃好做咩",
        "traits": {
          "predictability": 2,
          "commitment": 1
        }
      }
    ]
  },
  {
    "id": "m_q3",
    "part": 1,
    "label": "Q3",
    "domain": "friends",
    "text": "約好四個朋友出街，臨出門只得兩個人到。你通常？",
    "type": "trait_single",
    "field": "m_q3",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "go_anyway",
        "text": "照去，兩個都係朋友",
        "traits": {
          "autonomy": 1,
          "emotional_resonance": 1
        }
      },
      {
        "key": "reschedule",
        "text": "重新約過，想齊人先",
        "traits": {
          "predictability": 2,
          "commitment": 1
        }
      },
      {
        "key": "follow_mood",
        "text": "睇大家心情，隨便都得",
        "traits": {
          "emotional_resonance": 2,
          "autonomy": 1
        }
      },
      {
        "key": "want_early_notice",
        "text": "希望下次早啲講，方便安排",
        "traits": {
          "predictability": 1,
          "expressiveness": 1,
          "validation": 1
        }
      }
    ]
  },
  {
    "id": "m_q4",
    "part": 1,
    "label": "Q4",
    "domain": "intimacy",
    "text": "另一半今日工作好忙，已經六個鐘冇覆訊息。你通常會？",
    "type": "trait_single",
    "field": "m_q4",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "keep_doing",
        "text": "繼續做自己嘢",
        "traits": {
          "autonomy": 2,
          "predictability": 1
        }
      },
      {
        "key": "ping_when_free",
        "text": "Send 多一句：「忙完搵我。」",
        "traits": {
          "expressiveness": 2,
          "validation": 1
        }
      },
      {
        "key": "worry_mood",
        "text": "開始擔心佢係咪有心事",
        "traits": {
          "emotional_resonance": 2,
          "validation": 1
        }
      },
      {
        "key": "want_heads_up",
        "text": "理解，但希望佢早啲講一聲",
        "traits": {
          "predictability": 2,
          "expressiveness": 1
        }
      }
    ]
  },
  {
    "id": "m_q5",
    "part": 1,
    "label": "Q5",
    "domain": "interests",
    "text": "你開始學一樣新嘢（例如語言、樂器）。你通常？",
    "type": "trait_single",
    "field": "m_q5",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "solo_study",
        "text": "自己慢慢研究",
        "traits": {
          "autonomy": 2,
          "predictability": 1
        }
      },
      {
        "key": "learn_with_friends",
        "text": "搵朋友一齊學",
        "traits": {
          "validation": 1,
          "expressiveness": 2
        }
      },
      {
        "key": "try_first",
        "text": "先試下感唔感興趣再決定",
        "traits": {
          "emotional_resonance": 2,
          "autonomy": 1
        }
      },
      {
        "key": "study_plan",
        "text": "先制定學習計劃",
        "traits": {
          "predictability": 2,
          "commitment": 1
        }
      }
    ]
  },
  {
    "id": "m_q6",
    "part": 2,
    "partTitle": "內心與投射 Inner & Projection",
    "label": "Q6",
    "domain": "intimacy",
    "text": "吵完架。對方話：「今晚大家冷靜下。」你第一個反應？",
    "type": "trait_single",
    "field": "m_q6",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "need_time",
        "text": "好，我都需要時間",
        "traits": {
          "autonomy": 2,
          "emotional_resonance": 1
        }
      },
      {
        "key": "talk_tonight",
        "text": "唔想拖，今晚講清楚",
        "traits": {
          "expressiveness": 2,
          "validation": 1
        }
      },
      {
        "key": "doubt_love",
        "text": "開始諗：佢仲愛唔愛我？",
        "traits": {
          "emotional_resonance": 2,
          "validation": 1
        }
      },
      {
        "key": "schedule_talk",
        "text": "接受，但希望約定幾時再傾",
        "traits": {
          "predictability": 2,
          "commitment": 1
        }
      }
    ]
  },
  {
    "id": "m_q7",
    "part": 2,
    "label": "Q7",
    "domain": "projection",
    "text": "你去咖啡店，見到一隻黑貓一直望住窗外。你第一個感覺係？",
    "type": "trait_single",
    "field": "m_q7",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "wants_quiet",
        "text": "佢想自己靜下",
        "traits": {
          "autonomy": 2,
          "emotional_resonance": 1
        }
      },
      {
        "key": "waiting_owner",
        "text": "等緊主人",
        "traits": {
          "validation": 1,
          "commitment": 1
        }
      },
      {
        "key": "deep_thoughts",
        "text": "諗緊好多心事",
        "traits": {
          "emotional_resonance": 2,
          "autonomy": 1
        }
      },
      {
        "key": "daily_spot",
        "text": "每日都坐呢度",
        "traits": {
          "predictability": 2,
          "autonomy": 1
        }
      }
    ]
  },
  {
    "id": "m_q8",
    "part": 2,
    "label": "Q8",
    "domain": "intimacy",
    "text": "你同另一半傾訴，話今日好攰、好想有人陪。對方話：「你已經好叻，自己搞得掂。」你第一個感覺係？",
    "type": "trait_single",
    "field": "m_q8",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "accept_trust",
        "text": "明白係信任，我都唔想太依賴",
        "traits": {
          "autonomy": 2,
          "commitment": 1
        }
      },
      {
        "key": "want_comfort",
        "text": "好想佢先攬住我、聽我講",
        "traits": {
          "validation": 2,
          "emotional_resonance": 2
        }
      },
      {
        "key": "feel_unheard",
        "text": "有啲似講咗都冇用",
        "traits": {
          "emotional_resonance": 2,
          "expressiveness": 1
        }
      },
      {
        "key": "say_need_you",
        "text": "會直接講：「我需要你同我一齊」",
        "traits": {
          "expressiveness": 2,
          "validation": 1
        }
      }
    ]
  },
  {
    "id": "m_q9",
    "part": 3,
    "partTitle": "核心取向 Core Orientation",
    "label": "Q9",
    "domain": "forced_choice",
    "text": "如果只能保留一樣，你最唔想失去：",
    "type": "trait_single",
    "field": "m_q9",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "keep_freedom",
        "text": "自由",
        "traits": {
          "autonomy": 3
        }
      },
      {
        "key": "keep_understanding",
        "text": "理解",
        "traits": {
          "emotional_resonance": 3
        }
      },
      {
        "key": "keep_stability",
        "text": "穩定",
        "traits": {
          "predictability": 3
        }
      },
      {
        "key": "keep_companionship",
        "text": "陪伴",
        "traits": {
          "validation": 2,
          "commitment": 2
        }
      }
    ]
  },
  {
    "id": "m_q10",
    "part": 3,
    "label": "Q10",
    "domain": "life",
    "text": "五年後，你最可能會優先選擇？",
    "type": "trait_single",
    "field": "m_q10",
    "shuffle": true,
    "optionDefs": [
      {
        "key": "career_rhythm",
        "text": "追求自己嘅事業同生活節奏",
        "traits": {
          "autonomy": 2,
          "commitment": 1
        }
      },
      {
        "key": "stable_family",
        "text": "穩定嘅關係同家庭生活",
        "traits": {
          "predictability": 2,
          "commitment": 2
        }
      },
      {
        "key": "deep_bond",
        "text": "深度連結同靈魂默契",
        "traits": {
          "emotional_resonance": 2,
          "validation": 1
        }
      },
      {
        "key": "plan_together",
        "text": "同重要嘅人一齊規劃未來",
        "traits": {
          "commitment": 2,
          "expressiveness": 1
        }
      }
    ]
  }
];
const MIRROR_V3_TENSION_RULES = [
  { id: 'freedom_vs_attention', when: function (a) { return a.m_q2 === 'reserve_time' && a.m_q4 === 'worry_mood'; }, copy_zh: '你渴望自由，但真正安靜落嚟時，又會害怕自己唔被需要。' },
  { id: 'independent_but_wants_proof', when: function (a) { return a.m_q2 === 'reserve_time' && (a.m_q4 === 'ping_when_free' || a.m_q4 === 'want_heads_up'); }, copy_zh: '你重視獨立，但心入面仍然需要一啲信號確認自己重要。' },
  { id: 'give_space_but_need_signal', when: function (a) { return a.m_q8 === 'accept_trust' && (a.m_q4 === 'worry_mood' || a.m_q4 === 'want_heads_up'); }, copy_zh: '你習慣自己扛，但心入面仍然渴望有人主動靠近。' },
];
/**
 * Mirror Mode v3 — trait scoring, cat mapping, tension detection.
 */

const SCORING_VERSION_V3 = 'v3_trait';

const TRAIT_KEYS = [
  'autonomy',
  'validation',
  'emotional_resonance',
  'predictability',
  'expressiveness',
  'commitment',
];

const TRAIT_LABELS = {
  autonomy: { label: '自主需求', color: '#9a72d0', glow: '#c4a8ff', hint: '需要個人空間，自己作主、不被管束' },
  validation: { label: '確認需求', color: '#c45a82', glow: '#ff8fb8', hint: '需要被看見、被肯定與回應' },
  emotional_resonance: { label: '共鳴需求', color: '#2aa8be', glow: '#4de8ff', hint: '需要深層情感連結與被理解' },
  predictability: { label: '穩定需求', color: '#2db86a', glow: '#6dff9f', hint: '需要節奏可預期、關係有安全感' },
  expressiveness: { label: '表達需求', color: '#c49228', glow: '#ffd966', hint: '需要說出來、被聽見與被理解' },
  commitment: { label: '承諾需求', color: '#5289e0', glow: '#9ec0ff', hint: '需要明確的關係方向與共同投入' },
};

const TYPE_ORDER = ['solitary', 'sunny', 'mystical', 'sentinel'];

const CAT_PROTOTYPES = {
  // Calibrated 2026-07-04 (medoid v3): 4^10 → 24.8/25.0/25.0/25.2%; 50-profile 50/50.
  // Re-run: node scripts/calibrate-mirror-v3-prototypes.js
  solitary: { autonomy: 15, validation: 5, emotional_resonance: 4, predictability: 6, expressiveness: 3, commitment: 4 },
  sunny: { autonomy: 0, validation: 8, emotional_resonance: 2, predictability: 7, expressiveness: 7, commitment: 6 },
  mystical: { autonomy: 7, validation: 4, emotional_resonance: 15, predictability: 2, expressiveness: 1, commitment: 1 },
  sentinel: { autonomy: 6, validation: 2, emotional_resonance: 1, predictability: 13, expressiveness: 4, commitment: 5 },
};

const SHADOW_DISTANCE_THRESHOLD = 6;

function emptyTraitScores() {
  return Object.fromEntries(TRAIT_KEYS.map((k) => [k, 0]));
}

function findOptionDef(questions, field, optionKey) {
  const q = questions.find((item) => item.field === field);
  if (!q?.optionDefs) return null;
  return q.optionDefs.find((o) => o.key === optionKey) || null;
}

function computeTraitScores(answers, psychQuestions = MIRROR_PSYCH_QUESTIONS_V3) {
  const scores = emptyTraitScores();
  psychQuestions.forEach((q) => {
    const key = answers[q.field];
    if (!key) return;
    const opt = q.optionDefs?.find((o) => o.key === key);
    if (!opt?.traits) return;
    Object.entries(opt.traits).forEach(([trait, delta]) => {
      if (trait in scores) scores[trait] += delta;
    });
  });
  return scores;
}

function catDistance(traitScores, catKey) {
  const proto = CAT_PROTOTYPES[catKey];
  if (!proto) return Infinity;
  return TRAIT_KEYS.reduce((sum, trait) => {
    const diff = (traitScores[trait] || 0) - (proto[trait] || 0);
    return sum + diff * diff;
  }, 0);
}

function traitToCat(traitScores) {
  const sorted = TYPE_ORDER
    .map((cat) => ({ cat, dist: catDistance(traitScores, cat) }))
    .sort((a, b) => a.dist - b.dist);

  const mainType = sorted[0]?.cat || 'solitary';
  const second = sorted[1];
  const shadowType =
    second && second.dist - sorted[0].dist <= SHADOW_DISTANCE_THRESHOLD
      ? second.cat
      : null;

  return { mainType, shadowType, catDistances: sorted };
}

/** Legacy-style cat scores from trait→cat similarity (for bars fallback / forum compat) */
function traitScoresToMirrorScores(traitScores) {
  const totalTrait = Object.values(traitScores).reduce((a, b) => a + b, 0) || 1;
  const scores = { solitary: 0, sunny: 0, mystical: 0, sentinel: 0 };

  TYPE_ORDER.forEach((cat) => {
    const proto = CAT_PROTOTYPES[cat];
    let sim = 0;
    TRAIT_KEYS.forEach((trait) => {
      const userVal = traitScores[trait] || 0;
      const protoVal = proto[trait] || 0;
      sim += Math.min(userVal, protoVal);
    });
    scores[cat] = Math.round((sim / totalTrait) * 20);
  });

  const sum = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const scale = 20 / sum;
  TYPE_ORDER.forEach((cat) => {
    scores[cat] = Math.round(scores[cat] * scale);
  });

  return scores;
}

function distributeIntegerPercentages(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return weights.map(() => 0);
  const raw = weights.map((w) => (w / total) * 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const pcts = [...floors];
  for (let k = 0; k < remainder; k += 1) {
    pcts[order[k % order.length].i] += 1;
  }
  return pcts;
}

/** All scored traits as % shares that sum to 100. */
function getTraitBars(traitScores) {
  const sorted = TRAIT_KEYS
    .filter((k) => (traitScores[k] || 0) > 0)
    .sort((a, b) => (traitScores[b] || 0) - (traitScores[a] || 0));
  if (!sorted.length) return [];
  const pcts = distributeIntegerPercentages(sorted.map((k) => traitScores[k] || 0));
  return sorted.map((k, i) => ({
    key: k,
    pct: pcts[i],
    label: TRAIT_LABELS[k]?.label || k,
    color: TRAIT_LABELS[k]?.color || '#bd93f9',
    glow: TRAIT_LABELS[k]?.glow || TRAIT_LABELS[k]?.color || '#bd93f9',
    hint: TRAIT_LABELS[k]?.hint || '',
  }));
}

/** @deprecated Prefer getTraitBars — kept for callers expecting top-N slice. */
function getTopTraitBars(traitScores, limit = 3) {
  return getTraitBars(traitScores).slice(0, limit);
}

function detectTensions(answers, rules = MIRROR_V3_TENSION_RULES) {
  const out = [];
  rules.forEach((rule) => {
    try {
      if (rule.when(answers)) {
        out.push({ id: rule.id, copy_zh: rule.copy_zh });
      }
    } catch {
      /* skip */
    }
  });
  return out;
}

function computeMirrorResultV3(answers, psychQuestions = MIRROR_PSYCH_QUESTIONS_V3) {
  const traitScores = computeTraitScores(answers, psychQuestions);
  const { mainType, shadowType } = traitToCat(traitScores);
  const mirrorScores = traitScoresToMirrorScores(traitScores);
  const traitBars = getTraitBars(traitScores);
  const tensions = detectTensions(answers);

  return {
    scoring_version: SCORING_VERSION_V3,
    trait_scores: traitScores,
    mirror_type: mainType,
    shadow_type: shadowType,
    mirror_scores: mirrorScores,
    trait_bars: traitBars,
    tension_narratives: tensions,
  };
}

/** Seeded shuffle for stable option order per session + question index */
function shuffleOptionDefs(optionDefs, seed) {
  const arr = optionDefs.slice();
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function isTraitQuestion(q) {
  return q?.type === 'trait_single' && Array.isArray(q.optionDefs);
}


function getMirrorQuestionBank(profileQuestions) {
  return (profileQuestions || []).concat(MIRROR_PSYCH_QUESTIONS_V3);
}
global.MirrorV3 = {
  SCORING_VERSION_V3,
  MIRROR_PSYCH_QUESTIONS_V3,
  TRAIT_LABELS,
  computeMirrorResultV3,
  computeTraitScores,
  traitToCat,
  getTopTraitBars,
  getTraitBars,
  detectTensions,
  shuffleOptionDefs,
  isTraitQuestion,
  getMirrorQuestionBank,
};

})(typeof window !== 'undefined' ? window : global);
