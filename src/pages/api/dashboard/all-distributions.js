/**
 * GET /api/dashboard/all-distributions
 * Returns count distributions for every questionnaire field (Parts 1–5).
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

function countBy(arr, key) {
  const counts = {};
  for (const item of arr) {
    const val = item[key];
    if (val) counts[val] = (counts[val] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function countCSV(arr, key) {
  const counts = {};
  for (const item of arr) {
    if (!item[key]) continue;
    for (const v of item[key].split(',').map((s) => s.trim()).filter(Boolean)) {
      counts[v] = (counts[v] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function countJSONArray(arr, key) {
  const counts = {};
  for (const item of arr) {
    if (!item[key]) continue;
    let parsed;
    if (Array.isArray(item[key])) {
      parsed = item[key];
    } else if (typeof item[key] === 'string') {
      try { parsed = JSON.parse(item[key]); } catch { continue; }
    } else {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const v of parsed) {
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function ageGroup(age) {
  if (!age) return null;
  const n = Number(age);
  if (n < 18) return '< 18';
  if (n < 22) return '18–21';
  if (n < 26) return '22–25';
  if (n < 30) return '26–29';
  if (n < 35) return '30–34';
  if (n < 40) return '35–39';
  return '40+';
}

const GOAL_SHORT = {
  '認真長期發展：以穩定伴侶為目標，穩定後考慮未來': '長期發展',
  '順其自然：慢慢了解，唔急於定義關係': '順其自然',
  '輕鬆相處：偏向 Casual，唔想有太多標籤或束縛': '輕鬆相處',
  '開放認識：仲未準備好投入關係，但開放識人': '開放認識',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const { data: users, error } = await supabase
      .from('responses')
      .select([
        'identity', 'age', 'height', 'body_type', 'hair_style',
        'fashion_styles', 'bed_role',
        'social_energy', 'weekend_mode', 'interests',
        'exercise_habits', 'travel_mode',
        'relationship_goal', 'time_commitment', 'deal_breakers',
        'love_languages', 'security_needs', 'daily_love_ritual',
        'decision_making', 'communication_style',
        'expense_splitting', 'living_together',
      ].join(', '));

    if (error) return res.status(500).json({ error: error.message });

    const all = users || [];

    // ── Part 1: Visuals ──────────────────────────────────────
    const identity = countBy(all, 'identity');
    const hair_style = countBy(all, 'hair_style');
    const body_type = countBy(all, 'body_type');
    const fashion_styles = countCSV(all, 'fashion_styles');
    const bed_role = countBy(all, 'bed_role').map(({ name, value }) => ({
      name: name.includes('(Top)') ? 'Top 攻' : name.includes('(Bottom)') ? 'Bottom 受' : name.includes('Switch') ? 'Switch' : '躺平派',
      value,
    }));

    // ── Part 2: Daily Energy ────────────────────────────────
    const social_energy = countBy(all, 'social_energy').map(({ name, value }) => ({
      name: name.includes('好動') ? '好動' : name.includes('好靜') ? '好靜' : '動靜皆宜',
      value,
    }));
    const weekend_mode = countBy(all, 'weekend_mode').map(({ name, value }) => ({
      name: name.includes('社交派') ? '社交派' : name.includes('二人') ? '二人世界' : name.includes('平衡') ? '平衡派' : '隨心派',
      value,
    }));
    const interests = countCSV(all, 'interests');
    const exercise_habits = countCSV(all, 'exercise_habits');
    const travel_mode = countBy(all, 'travel_mode').map(({ name, value }) => ({
      name: name.includes('隨心') ? '隨心即興' : '完美攻略',
      value,
    }));

    // ── Part 3: Relationships ───────────────────────────────
    const rawGoal = countBy(all, 'relationship_goal');
    const relationship_goal = rawGoal.map(({ name, value }) => ({
      name: GOAL_SHORT[name] || name,
      value,
    }));
    const time_commitment = countBy(all, 'time_commitment').map(({ name, value }) => ({
      name: name.includes('每日') ? '幾乎每日' : name.includes('2–3') ? '週 2–3 次' : name.includes('1 次') ? '週 1 次' : '視心情',
      value,
    }));
    const deal_breakers = countCSV(all, 'deal_breakers').map(({ name, value }) => ({
      name: name.includes('冷暴力') ? '冷暴力' : name.includes('控制') ? '控制慾' : name.includes('失約') ? '失約' : '金錢觀',
      value,
    }));

    // ── Part 4: Soul ────────────────────────────────────────
    const love_languages = countCSV(all, 'love_languages').map(({ name, value }) => ({
      name: name.includes('：') ? name.split('：')[0] : name.slice(0, 6),
      value,
    }));
    const security_needs = countBy(all, 'security_needs').map(({ name, value }) => ({
      name: name.includes('穩定') ? '穩定聯絡' : name.includes('承諾') ? '明確承諾' : name.includes('行動') ? '行動證明' : '自由空間',
      value,
    }));
    const daily_love_ritual = countBy(all, 'daily_love_ritual').map(({ name, value }) => ({
      name: name.includes('小願望') ? '記得願望' : name.includes('默默') ? '默默陪伴' : name.includes('社交') ? '公開合照' : '每日電話',
      value,
    }));

    // ── Part 5: Values ──────────────────────────────────────
    const decision_making = countBy(all, 'decision_making').map(({ name, value }) => ({
      name: name.includes('直覺') ? '直覺系' : '事實系',
      value,
    }));
    const communication_style = countBy(all, 'communication_style').map(({ name, value }) => ({
      name: name.includes('直球') ? '直球解決' : name.includes('冷靜') ? '冷靜消化' : name.includes('情感') ? '情感引導' : '觀察留白',
      value,
    }));
    const expense_splitting = countBy(all, 'expense_splitting').map(({ name, value }) => ({
      name: name.includes('AA') ? 'AA 制' : name.includes('你一餐') ? '輪流請' : '收入高者請',
      value,
    }));
    const living_together = countBy(all, 'living_together').map(({ name, value }) => ({
      name: name.includes('早日') ? '早日同居' : name.includes('一年') ? '穩定後再算' : '各自居住',
      value,
    }));

    return res.status(200).json({
      // Part 1
      identity, hair_style, body_type, fashion_styles, bed_role,
      // Part 2
      social_energy, weekend_mode, interests, exercise_habits, travel_mode,
      // Part 3
      relationship_goal, time_commitment, deal_breakers,
      // Part 4
      love_languages, security_needs, daily_love_ritual,
      // Part 5
      decision_making, communication_style, expense_splitting, living_together,
    });
  } catch (err) {
    console.error('all-distributions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
