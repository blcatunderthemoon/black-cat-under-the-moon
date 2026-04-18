import { createClient } from '@supabase/supabase-js';

// Try server-side vars first (without NEXT_PUBLIC_), fallback to frontend vars
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase URL or anon key' });
  }

  try {
    const incoming = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Invalid payload: JSON object expected' });
    }

    const normalizeValue = (value) => {
      if (value == null) {
        return '';
      }
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      return value.toString();
    };

    const getIncomingValue = (incoming, primaryKey, fallbackKey) => {
      return incoming?.[primaryKey] ?? incoming?.[fallbackKey] ?? null;
    };

    const normalizeRange = (value, fallback) => {
      if (value === undefined) {
        return JSON.stringify(fallback);
      }
      if (value === null) {
        return null;
      }
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value.toString();
    };

    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const idealHeightGapRaw = hasOwn(incoming, 'ideal_height_gap')
      ? incoming.ideal_height_gap
      : getIncomingValue(incoming, 'ideal_height_gap', 'ideal_height_gap');
    const idealAgeGapRaw = hasOwn(incoming, 'ideal_age_gap')
      ? incoming.ideal_age_gap
      : getIncomingValue(incoming, 'ideal_age_gap', 'ideal_age_gap');

    const normalizeInt2 = (value) => {
      if (value == null || value === '') {
        return null;
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    };

    // Align frontend keys to real Supabase `responses` column names.
    const payload = {
      name: normalizeValue(getIncomingValue(incoming, 'name', 'part1_name')),
      age: normalizeInt2(getIncomingValue(incoming, 'age', 'part1_age')),
      height: normalizeInt2(getIncomingValue(incoming, 'height', 'part1_height')),
      body_type: normalizeValue(getIncomingValue(incoming, 'body_type', 'part1_body_type')),
      identity: normalizeValue(getIncomingValue(incoming, 'identity', 'part1_identity')),
      hair_style: normalizeValue(getIncomingValue(incoming, 'hair_style', 'part1_hair_style')),
      fashion_styles: normalizeValue(
        getIncomingValue(incoming, 'fashion_styles', 'part1_fashion_styles')
        ?? getIncomingValue(incoming, 'fashion_style', 'part1_fashion_style')
      ),
      bed_role: normalizeValue(getIncomingValue(incoming, 'bed_role', 'part1_bed_role')),
      social_energy: normalizeValue(getIncomingValue(incoming, 'social_energy', 'part1_social_energy')),
      weekend_mode: normalizeValue(getIncomingValue(incoming, 'weekend_mode', 'part1_weekend_mode')),
      interests: normalizeValue(getIncomingValue(incoming, 'interests', 'part1_interests')),
      exercise_habits: normalizeValue(
        getIncomingValue(incoming, 'exercise_habits', 'part1_exercise_habits')
        ?? getIncomingValue(incoming, 'exercise_habit', 'part1_exercise_habit')
      ),
      travel_mode: normalizeValue(getIncomingValue(incoming, 'travel_mode', 'part1_travel_mode')),
      relationship_goal: normalizeValue(getIncomingValue(incoming, 'relationship_goal', 'relationship_goal')),
      time_commitment: normalizeValue(getIncomingValue(incoming, 'time_commitment', 'time_commitment')),
      deal_breakers: normalizeValue(getIncomingValue(incoming, 'deal_breakers', 'deal_breakers')),
      love_languages: normalizeValue(getIncomingValue(incoming, 'love_languages', 'love_languages')),
      security_needs: normalizeValue(getIncomingValue(incoming, 'security_needs', 'security_needs')),
      daily_love_ritual: normalizeValue(getIncomingValue(incoming, 'daily_love_ritual', 'daily_love_ritual')),
      decision_making: normalizeValue(getIncomingValue(incoming, 'decision_making', 'decision_making')),
      communication_style: normalizeValue(getIncomingValue(incoming, 'communication_style', 'communication_style')),
      expense_splitting: normalizeValue(getIncomingValue(incoming, 'expense_splitting', 'expense_splitting')),
      living_together: normalizeValue(getIncomingValue(incoming, 'living_together', 'living_together')),
      ideal_identity: normalizeValue(getIncomingValue(incoming, 'ideal_identity', 'ideal_identity')),
      ideal_body_type: normalizeValue(getIncomingValue(incoming, 'ideal_body_type', 'ideal_body_type')),
      ideal_height_gap: normalizeRange(idealHeightGapRaw, [-30, 30]),
      ideal_age_gap: normalizeRange(idealAgeGapRaw, [-20, 20]),
      gap_moe: normalizeValue(getIncomingValue(incoming, 'gap_moe', 'gap_moe')),
      preferred_attribute: normalizeValue(getIncomingValue(incoming, 'preferred_attribute', 'preferred_attribute')),
      ideal_appearance: normalizeValue(getIncomingValue(incoming, 'ideal_appearance', 'ideal_appearance')),
      personal_traits: normalizeValue(getIncomingValue(incoming, 'personal_traits', 'personal_traits')),
      email: normalizeValue(getIncomingValue(incoming, 'email', 'email')),
      ig_username: normalizeValue(getIncomingValue(incoming, 'ig_username', 'ig_username')),
      feedback: normalizeValue(getIncomingValue(incoming, 'feedback', 'feedback'))
    };

    console.log('Payload to Supabase:', payload);

    // Insert mapped object directly; do not wrap in { data: ... }.
    const { data, error } = await supabase.from('responses').insert(payload).select();
    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error.message || 'Supabase insert failed' });
    }

    return res.status(200).json({ success: true, id: data?.[0]?.id || null });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
