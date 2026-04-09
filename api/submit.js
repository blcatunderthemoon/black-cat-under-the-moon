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
      if (value == null) {
        return JSON.stringify(fallback);
      }
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value.toString();
    };

    // Align frontend keys to real Supabase `responses` column names.
    const payload = {
      part1_name: normalizeValue(getIncomingValue(incoming, 'part1_name', 'name')),
      part1_age: normalizeValue(getIncomingValue(incoming, 'part1_age', 'age')),
      part1_height: normalizeValue(getIncomingValue(incoming, 'part1_height', 'height')),
      part1_identity: normalizeValue(getIncomingValue(incoming, 'part1_identity', 'identity')),
      part1_body_type: normalizeValue(getIncomingValue(incoming, 'part1_body_type', 'body_type')),
      part1_hair_style: normalizeValue(getIncomingValue(incoming, 'part1_hair_style', 'hair_style')),
      part1_fashion_styles: normalizeValue(getIncomingValue(incoming, 'part1_fashion_styles', 'fashion_style')),
      part1_bed_role: normalizeValue(getIncomingValue(incoming, 'part1_bed_role', 'bed_role')),
      part1_social_energy: normalizeValue(getIncomingValue(incoming, 'part1_social_energy', 'social_energy')),
      part1_weekend_mode: normalizeValue(getIncomingValue(incoming, 'part1_weekend_mode', 'weekend_mode')),
      part1_interests: normalizeValue(getIncomingValue(incoming, 'part1_interests', 'interests')),
      part1_exercise_habits: normalizeValue(getIncomingValue(incoming, 'part1_exercise_habits', 'exercise_habit')),
      part1_travel_mode: normalizeValue(getIncomingValue(incoming, 'part1_travel_mode', 'travel_mode')),
      relationship_goal: normalizeValue(getIncomingValue(incoming, 'relationship_goal', 'relationship_goal')),
      time_commitment: normalizeValue(getIncomingValue(incoming, 'time_commitment', 'time_commitment')),
      deal_breakers: normalizeValue(getIncomingValue(incoming, 'deal_breakers', 'deal_breakers')),
      love_languages: normalizeValue(getIncomingValue(incoming, 'love_languages', 'love_languages')),
      security_needs: normalizeValue(getIncomingValue(incoming, 'security_needs', 'security_needs')),
      daily_love_ritual: normalizeValue(getIncomingValue(incoming, 'daily_love_ritual', 'daily_love_ritual')),
      decision_making: normalizeValue(getIncomingValue(incoming, 'decision_making', 'decision_making')),
      communication_style: normalizeValue(getIncomingValue(incoming, 'communication_style', 'communication_style')),
      expense_splitting: normalizeValue(getIncomingValue(incoming, 'expense_splitting', 'expense_splitting')),
      living_together: normalizeValue(getIncomingValue(incoming, 'living_together', 'cohabitation')),
      ideal_identity: normalizeValue(getIncomingValue(incoming, 'ideal_identity', 'ideal_identity')),
      ideal_body_type: normalizeValue(getIncomingValue(incoming, 'ideal_body_type', 'ideal_visuals')),
      preferred_attribute: normalizeValue(getIncomingValue(incoming, 'preferred_attribute', 'ideal_identity')),
      ideal_appearance: normalizeValue(getIncomingValue(incoming, 'ideal_appearance', 'ideal_visuals')),
      ideal_height_gap: normalizeRange(getIncomingValue(incoming, 'ideal_height_gap', 'ideal_height_gap'), [-20, 20]),
      ideal_age_gap: normalizeRange(getIncomingValue(incoming, 'ideal_age_gap', 'ideal_age_gap'), [-10, 10]),
      gap_moe: normalizeValue(getIncomingValue(incoming, 'gap_moe', 'gap_moe')),
      personal_traits: normalizeValue(getIncomingValue(incoming, 'personal_traits', 'personal_traits')),
      contact_info: normalizeValue(getIncomingValue(incoming, 'contact_info', 'contact_info')),
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
