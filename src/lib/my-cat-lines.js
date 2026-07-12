/**
 * My Cat — Tap to Meow line pools (§9, docs/MY-CAT-GAME-DESIGN.md).
 * Client-safe. Later可遷 DB 供營運編輯。
 */

/** 深夜心靈毒雞湯（預設池） */
export const CAT_LINES_SOUL = [
  '今晚月色咁靚，妳唔係打算一個人瞓啊？🐾',
  '聽講隔離版塊有個 #嘴硬體誠實 嘅女仔發咗新故事，妳唔去睇下？🐈‍⬛',
  '心事太重就寫低佢，月亮會幫你收好。',
  '妳唔需要完美先值得被愛。',
  '今晚月色很好。',
  '月亮會記得路過的人。',
  '慢啲，夜仲長。',
  '星星今日好密。',
  '有心事？丟個瓶試下。',
  '樹洞今晚好靜。',
  '靈魂同頻，唔急。',
  '別怕黑，有光。',
  '月光照到你了。',
  '想傾計就去圍爐。',
  '緣份有時遲到。',
  '黑貓不咬人…大概。',
  '今晚適合照鏡。',
  '(*ΦωΦ*)',
];

/** 姬圈撩妹金句（好感 ≥ 50 解鎖） */
export const CAT_LINES_FLIRT = [
  '妳對我嘅吸引力，唔係物理，係引力波。',
  '我唔係話妳靚，我係話妳喺我度會發光。',
  '今晚可以借你膊頭一陣嗎？我純粹係想靠近啲。',
  '月亮咁圓，唔啱我哋都圓滿返一次？',
  '妳一摸我，我條尾就出賣咗我。',
  '喺妳身邊瞓晏覺，係我今日最大嘅成就。',
];

export const FLIRT_UNLOCK_AFFECTION = 50;

/**
 * Pick a random line, avoiding immediate repeats.
 * @returns {{ line: string, pool: 'soul'|'flirt', index: number }}
 */
export function pickCatLine({ affection = 0, lastLine = null } = {}) {
  const useFlirt = affection >= FLIRT_UNLOCK_AFFECTION && Math.random() < 0.35;
  const pool = useFlirt ? CAT_LINES_FLIRT : CAT_LINES_SOUL;
  const poolName = useFlirt ? 'flirt' : 'soul';

  let index = Math.floor(Math.random() * pool.length);
  if (pool[index] === lastLine && pool.length > 1) {
    index = (index + 1) % pool.length;
  }
  return { line: pool[index], pool: poolName, index };
}
