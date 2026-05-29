/**
 * GET /api/dashboard/distributions
 * Returns count distributions for:
 * - identity
 * - age (bucketed by decade)
 * - love_languages (flattened multi-select)
 * - body_type
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const { data: users, error } = await supabase
      .from('responses')
      .select('identity, age, love_languages, body_type, height, relationship_goal, hair_style');

    if (error) return res.status(500).json({ error: error.message });

    const all = users || [];

    // Identity distribution
    const identity = countBy(all, 'identity');

    // Age distribution (bucketed)
    const ageCounts = {};
    for (const u of all) {
      const g = ageGroup(u.age);
      if (g) ageCounts[g] = (ageCounts[g] || 0) + 1;
    }
    const AGE_ORDER = ['< 18', '18–21', '22–25', '26–29', '30–34', '35–39', '40+'];
    const age = AGE_ORDER
      .filter((k) => ageCounts[k])
      .map((name) => ({ name, value: ageCounts[name] }));

    // Love languages (flatten CSV)
    const llCounts = {};
    for (const u of all) {
      if (!u.love_languages) continue;
      for (const lang of u.love_languages.split(',').map((s) => s.trim()).filter(Boolean)) {
        llCounts[lang] = (llCounts[lang] || 0) + 1;
      }
    }
    const love_languages = Object.entries(llCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Body type distribution
    const body_type = countBy(all, 'body_type');

    // Height distribution (bucketed by 5 cm)
    const heightCounts = {};
    for (const u of all) {
      const h = Number(u.height);
      if (!h || h < 140 || h > 200) continue;
      const bucket = Math.floor(h / 5) * 5;
      const label = `${bucket}–${bucket + 4}`;
      heightCounts[label] = (heightCounts[label] || 0) + 1;
    }
    const height = Object.entries(heightCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => Number(a.name.split('–')[0]) - Number(b.name.split('–')[0]));

    // Relationship goal distribution
    const GOAL_SHORT = {
      '認真長期發展：以穩定伴侶為目標，穩定後考慮未來': '長期發展',
      '順其自然：慢慢了解，唔急於定義關係': '順其自然',
      '輕鬆相處：偏向 Casual，唔想有太多標籤或束縛': '輕鬆相處',
      '開放認識：仲未準備好投入關係，但開放識人': '開放認識',
    };
    const rawGoal = countBy(all, 'relationship_goal');
    const relationship_goal = rawGoal.map(({ name, value }) => ({
      name: GOAL_SHORT[name] || name,
      value,
    }));

    // Hair style distribution
    const hair_style = countBy(all, 'hair_style');

    return res.status(200).json({ identity, age, love_languages, body_type, height, relationship_goal, hair_style });
  } catch (err) {
    console.error('distributions error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
