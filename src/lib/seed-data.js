/**
 * lib/seed-data.js
 * Shared seed data constants and user generation logic.
 * Used by both scripts/seed-test-data.mjs and pages/api/dashboard/seed.js
 */

// ============================================================
// EXACT OPTION STRINGS — must match questionnaire values
// ============================================================

export const IDENTITIES = ['TB', 'TBG', 'Pure', 'Bi', 'No Label'];

export const BODY_TYPES = ['纖瘦偏薄', '均勻適中', '結實健美', '圓潤肉感'];

const HAIR_STYLES = ['飄逸長髮', '中長及肩', '爽朗短髮', '帥氣剷青'];

const FASHION_STYLE_OPTIONS = [
  '簡約歐美', '日系小清新', '街頭型格', '文青文藝',
  '優雅大方', '慵懶隨性', '運動機能', '中性帥氣',
];

const BED_ROLES = [
  '霸總負責進攻：全力輸出，我唔係嚟休息嘅 (Top)',
  '懶豬負責享受：穩定接收，我就係嚟休息嘅 (Bottom)',
  '遇強則弱，遇弱則強：睇對方係咩料，我可以隨時切換 (Switch)',
];

const SOCIAL_ENERGY = [
  '好動（戶外玩家）',
  '好靜（宅家修煉）',
  '動靜皆宜（睇心情切換）',
];

const WEEKEND_MODE = [
  '社交派：鍾意同朋友聚會、參加活動',
  '二人世界：同另一半靜靜過，唔想被打擾',
  '平衡派：一半社交，一半留俾對方',
  '隨心派：完全睇當日心情同能量決定',
];

const TRAVEL_MODE = [
  '隨心即興（去到邊玩到邊）',
  '完美攻略（做足準備唔想浪費時間）',
];

const RELATIONSHIP_GOAL = [
  '認真長期發展：以穩定伴侶為目標，穩定後考慮未來',
  '順其自然：慢慢了解，唔急於定義關係',
  '輕鬆相處：偏向 Casual，唔想有太多標籤或束縛',
  '開放認識：仲未準備好投入關係，但開放識人',
];

const TIME_COMMITMENT = [
  '幾乎每日見 / 長時間相處',
  '一星期 2–3 次',
  '一星期 1 次',
  '視乎工作或當下心情',
];

const LOVE_LANGUAGE_OPTIONS = [
  '肯定的言語：對方不斷讚美、鼓勵同肯定我',
  '服務的行動：對方主動幫我分擔生活瑣事或解決困難',
  '身體的接觸：隨時隨地的牽手、擁抱或親吻',
  '禮物與驚喜：收到對方悉心準備的小禮物',
];

const SECURITY_NEEDS_OPTIONS = [
  '穩定聯絡：每日都有交流，唔會突然失蹤',
  '明確承諾：對關係定義清晰，有共同認可嘅名分',
  '行動證明：講得出做得到，會為我做實事',
  '自由空間：有足夠個人空間，唔會被過度限制',
];

const DAILY_LOVE_RITUAL_OPTIONS = [
  '記得我隨口講過嘅小願望或細碎嘅喜好',
  '喺我攰嘅時候默默陪伴（例如幫我吹頭/按摩）',
  '喺社交媒體公開合照，俾我有安全感',
  '即使再忙，每日都會抽時間講電話或錄語音',
];

const DECISION_MAKING = [
  '直覺系：相信第一印象同感覺',
  '事實系：鍾意收集資訊，分析過後先做決定',
];

const COMMUNICATION_STYLE = [
  '直球解決型：唔鍾意拖，要即時講清楚介意咩',
  '冷靜消化型：會先分開一下，等自己整理好情緒同邏輯先再傾',
  '情感引導型：比起即刻講道理，我更想對方先接住我情緒',
  '觀察留白型：唔太習慣主動開口，會希望對方自己察覺我唔對路',
];

const EXPENSE_SPLITTING = [
  '絕對 AA 制，大家清清楚楚',
  '你一餐我一餐，唔需要計到盡',
  '收入較高或主動約嗰位請客',
];

const LIVING_TOGETHER = [
  '期待早日同居，每日睜開眼就見到對方',
  '穩定交往一段時間（一年以上）再考慮',
  '傾向各自居住，保有個人空間',
];

const GAP_MOE = [
  '外表高冷硬朗，但對住我會展現極致溫柔',
  '平時理性冷靜，但喺我面前會撒嬌變細路女',
  '生活隨性自然，但對工作或熱愛嘅事極度專注',
];

// ============================================================
// Persona archetypes
// ============================================================

const PERSONAS = [
  {
    identity: 'TB',
    names: ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Sky'],
    bedRoles: [BED_ROLES[0]],
    idealIdentity: ['Pure', 'Bi', 'No Label', '冇所謂'],
    heightRange: [162, 178],
    hairStyles: ['爽朗短髮', '帥氣剷青'],
    fashionOptions: ['街頭型格', '運動機能', '中性帥氣', '簡約歐美'],
  },
  {
    identity: 'TBG',
    names: ['Charlie', 'Morgan', 'Avery', 'Skylar', 'Drew', 'Blake'],
    bedRoles: [BED_ROLES[0], BED_ROLES[2]],
    idealIdentity: ['Pure', 'TBG', 'Bi', '冇所謂'],
    heightRange: [158, 172],
    hairStyles: ['中長及肩', '爽朗短髮', '帥氣剷青'],
    fashionOptions: ['日系小清新', '街頭型格', '簡約歐美', '中性帥氣'],
  },
  {
    identity: 'Pure',
    names: ['Luna', 'Mia', 'Ella', 'Sophie', 'Chloe', 'Lily', 'Zoe', 'Emma'],
    bedRoles: [BED_ROLES[1]],
    idealIdentity: ['TB', 'TBG', '冇所謂'],
    heightRange: [155, 168],
    hairStyles: ['飄逸長髮', '中長及肩'],
    fashionOptions: ['日系小清新', '優雅大方', '文青文藝', '簡約歐美'],
  },
  {
    identity: 'Bi',
    names: ['Aria', 'Nova', 'Stella', 'Ivy', 'Hazel', 'Willow', 'Aurora'],
    bedRoles: BED_ROLES,
    idealIdentity: ['TB', 'TBG', 'Pure', 'Bi', 'No Label', '冇所謂'],
    heightRange: [157, 175],
    hairStyles: HAIR_STYLES,
    fashionOptions: FASHION_STYLE_OPTIONS,
  },
  {
    identity: 'No Label',
    names: ['River', 'Sage', 'Winter', 'Echo', 'Fern', 'Rain', 'Wren'],
    bedRoles: [BED_ROLES[2]],
    idealIdentity: ['TBG', 'Pure', 'Bi', 'No Label', '冇所謂'],
    heightRange: [157, 173],
    hairStyles: HAIR_STYLES,
    fashionOptions: ['文青文藝', '慵懶隨性', '日系小清新', '街頭型格'],
  },
];

// ============================================================
// Utilities
// ============================================================

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickCSV(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(', ');
}

function pickJSON(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return JSON.stringify(shuffled.slice(0, count));
}

function randGap(maxNeg, maxPos, noPreferenceChance = 0.25) {
  if (Math.random() < noPreferenceChance) return null;
  const lo = -randomInt(1, maxNeg);
  const hi = randomInt(1, maxPos);
  return JSON.stringify([lo, hi]);
}

// ============================================================
// User factory
// ============================================================

export function generateUser(index) {
  const persona = PERSONAS[index % PERSONAS.length];
  const name = randomItem(persona.names);

  const wantAll = Math.random() < 0.25;
  const filteredIdeal = persona.idealIdentity.filter((x) => x !== '冇所謂');
  const idealIdentity = wantAll ? '冇所謂' : pickCSV(filteredIdeal, randomInt(1, 2));

  return {
    name,
    age: randomInt(22, 38),
    height: randomInt(...persona.heightRange),
    body_type: randomItem(BODY_TYPES),
    identity: persona.identity,
    hair_style: randomItem(persona.hairStyles),
    fashion_styles: pickCSV(persona.fashionOptions, randomInt(1, 3)),
    bed_role: randomItem(persona.bedRoles),
    social_energy: randomItem(SOCIAL_ENERGY),
    weekend_mode: randomItem(WEEKEND_MODE),
    interests: pickJSON([
      '睇戲/睇展覽', '影相記錄', '睇書', '寫作/手帳',
      '搵正餐廳食好嘢', '咖啡店打卡', '居家佈置',
      '深度旅遊', '密室逃脫/劇本殺', '屋企 Netflix & Chill',
      '漫無目的散步', '同寵物玩',
    ], randomInt(2, 4)),
    exercise_habits: pickCSV([
      '行山/露營', '做 Gym 訓練', '瑜伽/普拉提', '跳舞', '呼吸係我唯一運動',
    ], randomInt(1, 2)),
    travel_mode: randomItem(TRAVEL_MODE),
    relationship_goal: randomItem(RELATIONSHIP_GOAL),
    time_commitment: randomItem(TIME_COMMITMENT),
    deal_breakers: pickCSV([
      '冷暴力 / 已讀不回 / 唔溝通',
      '控制慾強 / 查手機 / 限制社交',
      '經常失約 / 唔守承諾',
      '金錢觀極端（過度計較或過度揮霍）',
    ], randomInt(1, 2)),
    love_languages: pickCSV(LOVE_LANGUAGE_OPTIONS, 2),
    security_needs: randomItem(SECURITY_NEEDS_OPTIONS),
    daily_love_ritual: randomItem(DAILY_LOVE_RITUAL_OPTIONS),
    decision_making: randomItem(DECISION_MAKING),
    communication_style: randomItem(COMMUNICATION_STYLE),
    expense_splitting: randomItem(EXPENSE_SPLITTING),
    living_together: randomItem(LIVING_TOGETHER),
    ideal_identity: idealIdentity,
    ideal_body_type: pickCSV([...BODY_TYPES, '冇所謂'], 2),
    ideal_height_gap: randGap(20, 20, 0.25),
    ideal_age_gap: randGap(10, 10, 0.25),
    gap_moe: randomItem(GAP_MOE),
    preferred_attribute: pickCSV(['TB', 'TBG', 'Pure', 'Bi', 'No Label', '冇所謂'], 1),
    ideal_appearance: pickCSV(BODY_TYPES, randomInt(1, 2)),
    personal_traits: randomItem(['善良、幽默、有耐性', '獨立、細心、有品味', '直率、溫柔、有原則']),
    email: `test_${name.toLowerCase()}${randomInt(100, 999)}@example.com`,
    ig_username: `test_${name.toLowerCase()}${randomInt(10, 99)}`,
    feedback: `Seed user #${index + 1} (${persona.identity})`,
  };
}
