(function (global) {
'use strict';

const TRAIT_KEYS = ["autonomy","validation","emotional_resonance","predictability","expressiveness","commitment"];
const TYPE_ORDER = ["solitary","sunny","mystical","sentinel"];
const PERSONALITY_LEGACY = {"solitary":{"desc":"你是一隻住在月亮上的貓，愛情對你來說是點綴，而不是全部。你不是不愛，只是你的愛需要空間才能呼吸。","warning":"遇到突然黏上來、打亂個人計劃的人，自動開啟隱形模式，消失三天再出現說沒事。"},"sunny":{"desc":"你喜歡曬太陽，也希望對方的世界裡只有溫暖。你的愛是直接，你要的是清晰而公開。","warning":"遇到態度曖昧、拒絕定義關係的人，直接傳長文問清楚，不清楚不罷休。"},"mystical":{"desc":"你潛伏在黑夜深處，只為等待那個能聽懂你頻率的人。道理不重要，被理解才是你最深的渴望。","warning":"遇到用道理而非感受回應的人，當場關掉情緒出口，從此沉默如謎。"},"sentinel":{"desc":"你是守護壁爐的貓，最怕變動與突如其來的驚嚇。你的愛是一種承諾，是每天都會回來的穩定。","warning":"遇到遲到不講、臨時改行程的人，內心的護盾會當場加厚 300%。"}};
const INSIGHTS = {"sentinel":{"byPrimary":{"predictability":{"validation":"你最安心的，不是有人陪你。而是知道：對方會一直在。","autonomy":"你需要安全感。但你更希望，安全感不是束縛。","emotional_resonance":"你很少要求什麼。真正令你安心的是：有人察覺你的沉默。","expressiveness":"計劃被打亂會令你不安。但若對方願意說清楚，你比想像中更容易釋懷。","commitment":"你重視承諾，不是因為控制。而是因為：說出口的話，應該算數。","_default":"穩定對你而言不是沉悶，而是可以真正休息的狀態。"},"commitment":{"predictability":"你需要的不是完美計劃，而是知道：這段關係有方向、有延續。","validation":"當對方用行動回應你的付出，你的護盾會悄悄放下。","_default":"你願意長久投入，但前提是：這份投入被看見、被珍惜。"}},"_default":"你是守護壁爐的貓。動盪來時，你會先穩住自己，再決定誰值得留在大火旁。"},"solitary":{"byPrimary":{"autonomy":{"emotional_resonance":"你需要空間，但不代表不需要被理解。只是被懂得的方式，不能打亂你的節奏。","predictability":"自由對你很重要，可預期的相處節奏，反而讓你更願意靠近。","validation":"你不常開口要什麼。但若對方尊重你的界線，你會用更真實的自己回應。","_default":"你的愛需要呼吸。靠得太近時，你會先退一步，不是逃，是整理自己。"},"emotional_resonance":{"autonomy":"你渴望被懂，但也需要一個人消化的時間。兩者對你同樣重要。","_default":"你不是難以親近，只是親近的方式，從來都不是黏在一起。"}},"_default":"你是一隻住在月亮上的貓。靠近需要時間，但每一次靠近都更真實。"},"sunny":{"byPrimary":{"validation":{"expressiveness":"你習慣把在乎說出來，但不是為了製造戲劇。你只是在確認：這份連結，仍然被回應著。","commitment":"你一旦認真，就會把對方放進日常裡。你在等的不是更多承諾，而是同樣力度的回應。","predictability":"你可以很熱烈，也需要一點「明天還會見面」的節奏。沒有預期的空白，會比爭吵更耗你。","emotional_resonance":"被看見對你很重要，但你也記得細節：對方什麼時候真正聽進去，什麼時候只是在回應。","autonomy":"你需要被肯定，但不代表要失去自己。最好的親密，是兩個人都能說「我在」。","_default":"你把溫暖落在生活細節裡——記得偏好、主動出現。那些看起來自然的熱情，其實都是有意識的給予。"},"expressiveness":{"validation":"你習慣先開口，不是因為不怕尷尬，而是寧可說錯一次，也不想長期靠猜。","commitment":"你願意把感受講清楚，因為對你來說，沉默有時比拒絕更難受。","_default":"對你而言，被聽見和被愛，幾乎是同一件事——只是你選擇用說的，而不是等。"},"commitment":{"validation":"你投入一段關係時很徹底。真正讓你動搖的，往往不是爭吵，而是對方開始「若即若離」。","_default":"你看重長久，不是因為保守，而是相信：能一起走下去的，才值得現在就認真。"}},"_default":"你的直率，是把心放在陽光下曬——久了，熟悉你的人會知道：那不是表演，是習慣。"},"mystical":{"byPrimary":{"emotional_resonance":{"autonomy":"你需要被理解，但不代表要失去自己。懂你的人，會給你說或不說的空間。","expressiveness":"有些感受說不出來。你更在意的，是對方有沒有在聽，而不是答案對不對。","validation":"被懂得一次，可以撐過很多說不通的日子。你記得那些「被接住」的瞬間。","_default":"你潛伏在黑夜深處，只為等待那個能聽懂你頻率的人。"},"autonomy":{"emotional_resonance":"你習慣獨自感受很多情緒。但若有人讀懂你的沉默，你會比想像中更敞開。","_default":"道理對你並不總是有用。被理解，才是你最深的渴望。"}},"_default":"你不是太敏感，而是對「是否被當回事」這件事，比大多數人更早有感覺。"}};
const WARNINGS = {"sentinel":{"trigger":{"predictability":"當承諾被打破，或計劃被臨時推翻。","commitment":"當對方一再改口，讓你開始懷疑這段關係是否可靠。","autonomy":"當你的界線被忽略，卻還被要求「不要想太多」。","keep_stability":"當原本說好的節奏，突然變得無法預期。","_default":"當承諾被打破。"},"behaviour":{"predictability":"你會開始變得很安靜。不是因為不生氣，而是開始保護自己。","commitment":"你不一定當場發火，但會開始重新計算：這個人值不值得相信。","validation":"你會用更規律、更克制的方式相處——彷彿在測試對方是否還在。","_default":"你的情緒未必外顯，但內心的護盾會悄悄加厚。"},"recovery":{"expressiveness":"一句真誠解釋，比十句道歉更有效。你需要的不是藉口，而是原因。","emotional_resonance":"若對方願意坦白當下的狀況，你的護盾其實比想像中容易放下。","validation":"當對方用行動補回被破壞的信任，你會願意再給一次機會。","_default":"如果有人願意坦白原因，你的護盾其實比想像中容易放下。"}},"solitary":{"trigger":{"autonomy":"當個人空間被突然入侵，或計劃被擅自改動。","validation":"當對方用「為你好」的名義，要求你時刻在線。","keep_freedom":"當你感覺自由被換成義務，卻沒有人先問過你。","_default":"當你的節奏被強行打亂，卻沒有商量餘地。"},"behaviour":{"autonomy":"你會先退後一步，變得冷淡或失聯。不是懲罰對方，是在找回自己。","emotional_resonance":"你會關掉情緒出口，用沉默代替爭吵。","_default":"你不一定會爆發，但會自動開啟「隱形模式」，直到界線被尊重。"},"recovery":{"autonomy":"若對方願意給你空間，並在回來時真誠確認你的感受，你會慢慢靠近。","emotional_resonance":"一句「我懂你需要時間」比追問更能讓你重新開門。","_default":"尊重你的節奏，比急著修復關係更重要。"}},"sunny":{"trigger":{"validation":"當關係狀態模糊，或對方拒絕給予清楚回應。","expressiveness":"當你的感受被輕輕帶過，好像從來沒說過一樣。","keep_companionship":"當你投入很多，卻感覺只有自己在一廂情願。","_default":"當態度曖昧、界線不明，讓你開始懷疑自己的位置。"},"behaviour":{"validation":"你會直接追問、長文對質，或變得異常執著於「講清楚」。","expressiveness":"你會把話說得更直、更大聲——因為沉默會讓你更不安。","_default":"你不怕衝突，只怕一直猜。不清楚，你不罷休。"},"recovery":{"validation":"一句明確的「我在乎你／我們是什麼關係」，比浪漫驚喜更能安撫你。","commitment":"若對方願意共同定義關係，你會很快從焦慮回到溫暖。","_default":"清晰比完美更重要。說清楚，你就能再次敞開。"}},"mystical":{"trigger":{"emotional_resonance":"當你表達脆弱，對方卻只用道理回應。","expressiveness":"當你的情緒被否定，或被告知「想太多」。","keep_understanding":"當你感覺沒有人真的在聽，只是在解決問題。","_default":"當感受被略過，只剩下對錯與分析。"},"behaviour":{"emotional_resonance":"你會關掉情緒出口，變得沉默、疏離，像關上了只有少數人知道的門。","autonomy":"你會退回自己的世界，不再解釋——因為解釋也沒用。","_default":"你不一定會吵，但會從此把某些話留在心裡，不再說出口。"},"recovery":{"emotional_resonance":"若對方先接住情緒、再談道理，你會願意重新分享內心。","expressiveness":"一句「我聽到了，這對你很重要」能比你預期中更快地修復信任。","_default":"被理解，比被說服更能讓你重新靠近。"}}};
const Q9_TRIGGER_KEYS = {"keep_freedom":"keep_freedom","keep_understanding":"keep_understanding","keep_stability":"keep_stability","keep_companionship":"keep_companionship"};
const MISREAD = {"sentinel":"很多人以為你情緒穩定、很少需要人。其實你不是沒有感受，只是把不安先收進護盾裡。","mystical":"很多人以為你故意難接近、在考驗對方。其實你只是需要時間，確認這份靠近不會打亂自己。","solitary":"很多人以為你冷淡、隨時可以一個人。其實你只是把親密留給，願意尊重你節奏的人。","sunny":"很多人以為你永遠笑得很開、玩得起曖昧。其實你也會受傷——只是把真心說出口之後，最難忍受的是迴避。"};
const MOONLIGHT = {"sentinel":["安全感，來自值得相信的人。不是來自控制所有事情。","計劃會變，但誠意不會。留一點空間給意外，也留一點信任給對方。","你的護盾保護了你很久。有時，放下不是軟弱，是選擇相信。"],"solitary":["適當讓人靠近，不代表失去自由。","獨處是充電，不是懲罰。願意分享充電後的自己，也是一種愛。","你不需要為了證明在乎，而放棄自己的節奏。"],"mystical":["不是每個人，都懂得第一時間理解你。有時，表達也是一種勇敢。","被懂得很珍貴，但先讓人知道你在乎什麼，也是對自己的溫柔。","沉默可以是保護，也可以是距離。選擇誰能聽見你，同樣重要。"],"sunny":["公開的愛很美。但真正長久的愛，也需要留一點空間呼吸。","直球很勇敢，但對方也需要時間跟上。給彼此一點步調，愛會更穩。","被看見很重要，被尊重同樣重要。光不必一直最亮，才能照得久。"]};
const MOONLIGHT_SHADOW = {"sentinel+solitary":"穩定與自由可以並存。說好各自需要的空間，也是一種承諾。","sentinel+sunny":"你可以穩定地愛，也可以讓世界知道。兩者不必二選一。","solitary+sunny":"靠近不必失去自我。被看見，也可以保留屬於你的月亮。","mystical+sentinel":"被理解需要時間，被信任需要一致。給關係一點可預期的耐心。"};
const MIRROR_HEROES = {"sunny":{"verdict":"你一直追求的是被選擇。而不是被喜歡。","hero":"你的愛，需要被確認。","heroSub":"你不是害怕孤單。你害怕：努力愛的人，從來沒有認真選擇你。"},"sentinel":{"verdict":"你守住的，從來不只是計劃。是那些被說出口、卻還沒兌現的承諾。","hero":"你的承諾，需要被兌現。","heroSub":"你真正害怕的，不是改變。而是：只有你，還記得承諾。"},"solitary":{"verdict":"你退後的每一步，都是在確認：這個人會不會追上來。","hero":"你的節奏，需要被尊重。","heroSub":"你不是不需要人。只是：沒有人教過你，依靠別人也可以很安全。"},"mystical":{"verdict":"你等的從來不是答案。是有人願意，在你的沉默裡停下來。","hero":"你的感受，需要被當回事。","heroSub":"你不是敏感。只是：比其他人，更早聽見沉默。"}};

/**
 * Mirror Card narrative assembly — fixed worldview + dynamic modules (v4).
 */

/** @typedef {{ key: string, score: number }} RankedTrait */

/**
 * @param {Record<string, number>|null|undefined} traitScores
 * @returns {RankedTrait[]}
 */
function rankTraits(traitScores) {
  if (!traitScores) return [];
  return TRAIT_KEYS.map((key) => ({ key, score: traitScores[key] || 0 }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || TRAIT_KEYS.indexOf(a.key) - TRAIT_KEYS.indexOf(b.key));
}

/**
 * @param {Record<string, string>|null|undefined} map
 * @param {string[]} keys
 * @returns {string|null}
 */
function pickFromMap(map, keys) {
  if (!map) return null;
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (k && map[k]) return map[k];
  }
  return map._default || null;
}

/**
 * @param {string} seed
 * @param {number} count
 * @returns {number}
 */
function stablePickIndex(seed, count) {
  if (!count) return 0;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % count;
}

/**
 * @param {string} mirrorType
 * @param {RankedTrait[]} ranked
 * @returns {string|null}
 */
function pickInsight(mirrorType, ranked) {
  const family = INSIGHTS[mirrorType];
  if (!family || !ranked.length) return family?._default || null;

  const primary = ranked[0].key;
  const secondary = ranked[1]?.key;
  const primaryMap = family.byPrimary?.[primary];
  const insight = pickFromMap(primaryMap, [secondary, '_default']);
  return insight || family._default || null;
}

/**
 * @param {string} mirrorType
 * @param {RankedTrait[]} ranked
 * @param {Record<string, string>|null|undefined} answers
 * @returns {{ trigger: string, behaviour: string, recovery: string }|null}
 */
function pickWarning(mirrorType, ranked, answers) {
  const family = WARNINGS[mirrorType];
  if (!family || !ranked.length) return null;

  const primary = ranked[0].key;
  const lowest = ranked[ranked.length - 1]?.key;
  const q9 = answers?.m_q9;
  const q9Key = q9 && Q9_TRIGGER_KEYS[q9] ? q9 : null;

  const recoveryRanked = ranked
    .filter((t) => t.key === 'expressiveness' || t.key === 'emotional_resonance')
    .sort((a, b) => b.score - a.score);
  const recoveryKey = recoveryRanked[0]?.key || secondaryFallback(ranked, primary);

  const trigger = pickFromMap(family.trigger, [q9Key, lowest, primary, '_default']);
  const behaviour = pickFromMap(family.behaviour, [primary, lowest, '_default']);
  const recovery = pickFromMap(family.recovery, [recoveryKey, primary, '_default']);

  if (!trigger || !behaviour || !recovery) return null;
  return { trigger, behaviour, recovery };
}

/**
 * Berserk steps for RPG-style card UI.
 * @param {{ trigger: string, behaviour: string, recovery: string }|null} w
 * @returns {{ trigger: string, reaction: string, recovery: string }|null}
 */
function formatWarningSteps(w) {
  if (!w?.trigger) return null;
  return {
    trigger: w.trigger.replace(/^當/, ''),
    reaction: (w.behaviour || '').replace(/^你會/, ''),
    recovery: w.recovery || '',
  };
}

/** @deprecated Use formatWarningSteps */
function formatWarningRows(w) {
  const steps = formatWarningSteps(w);
  if (!steps) return null;
  const t = steps.trigger.replace(/。$/, '');
  const r = steps.reaction.replace(/。$/, '');
  const burst = r ? `${t} → ${r}。` : steps.trigger;
  return { burst, recovery: steps.recovery };
}

/** @param {RankedTrait[]} ranked @param {string} primary */
function secondaryFallback(ranked, primary) {
  return ranked.find((t) => t.key !== primary)?.key || primary;
}

/**
 * @param {string} mirrorType
 * @param {string|null|undefined} shadowType
 * @param {Record<string, number>|null|undefined} traitScores
 * @returns {string|null}
 */
function pickMoonlight(mirrorType, shadowType, traitScores) {
  const shadowKey = shadowType ? `${mirrorType}+${shadowType}` : null;
  if (shadowKey && MOONLIGHT_SHADOW[shadowKey]) {
    return MOONLIGHT_SHADOW[shadowKey];
  }

  const variants = MOONLIGHT[mirrorType];
  if (!variants?.length) return null;

  const seed = TYPE_ORDER.map((k) => `${k}:${traitScores?.[k] || 0}`).join('|');
  return variants[stablePickIndex(seed, variants.length)];
}

/**
 * Legacy fallback when v3 trait data unavailable.
 * @param {string} mirrorType
 * @returns {import('./assemble.js').MirrorNarrative}
 */
function buildLegacyNarrative(mirrorType) {
  const p = PERSONALITY_LEGACY[mirrorType] || {};
  return {
    worldview: p.desc || '',
    insight: null,
    misread: MISREAD[mirrorType] || null,
    warning: null,
    warningLegacy: p.warning || '',
    moonlight: null,
    dynamic: false,
  };
}

/**
 * @typedef {Object} MirrorNarrative
 * @property {string} worldview
 * @property {string|null} insight
 * @property {string|null} misread
 * @property {{ trigger: string, behaviour: string, recovery: string }|null} warning
 * @property {string} [warningLegacy]
 * @property {string|null} moonlight
 * @property {boolean} dynamic
 */

/**
 * @param {Object} opts
 * @param {string} opts.mirrorType
 * @param {string|null} [opts.shadowType]
 * @param {Record<string, number>|null} [opts.traitScores]
 * @param {Record<string, string>|null} [opts.answers]
 * @param {string} [opts.scoringVersion]
 * @param {boolean} [opts.includeMisread]
 * @param {boolean} [opts.includeMoonlight]
 * @returns {MirrorNarrative}
 */
function assembleNarrative(opts) {
  const {
    mirrorType,
    shadowType = null,
    traitScores = null,
    answers = null,
    scoringVersion = '',
    includeMisread = true,
    includeMoonlight = false,
  } = opts;

  const p = PERSONALITY_LEGACY[mirrorType] || {};
  const isV3 = scoringVersion === 'v3_trait' && traitScores && Object.keys(traitScores).length > 0;

  if (!isV3) {
    const legacy = buildLegacyNarrative(mirrorType);
    if (!includeMisread) legacy.misread = null;
    return legacy;
  }

  const ranked = rankTraits(traitScores);

  return {
    worldview: p.desc || '',
    insight: pickInsight(mirrorType, ranked),
    misread: includeMisread ? (MISREAD[mirrorType] || null) : null,
    warning: pickWarning(mirrorType, ranked, answers),
    warningLegacy: p.warning || '',
    moonlight: includeMoonlight ? pickMoonlight(mirrorType, shadowType, traitScores) : null,
    dynamic: true,
  };
}


global.MirrorNarratives = {
  assembleNarrative: assembleNarrative,
  buildLegacyNarrative: buildLegacyNarrative,
  formatWarningRows: formatWarningRows,
  formatWarningSteps: formatWarningSteps,
  rankTraits: rankTraits,
  MIRROR_HEROES: MIRROR_HEROES,
};
})(typeof window !== 'undefined' ? window : global);
