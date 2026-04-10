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
      part2_social_energy: normalizeValue(getIncomingValue(incoming, 'part2_social_energy', 'social_energy')),
      part2_weekend_mode: normalizeValue(getIncomingValue(incoming, 'part2_weekend_mode', 'weekend_mode')),
      part2_interests: normalizeValue(getIncomingValue(incoming, 'part2_interests', 'interests')),
      part2_exercise_habits: normalizeValue(getIncomingValue(incoming, 'part2_exercise_habits', 'exercise_habit')),
      part2_travel_mode: normalizeValue(getIncomingValue(incoming, 'part2_travel_mode', 'travel_mode')),
      part3_relationship_goal: normalizeValue(getIncomingValue(incoming, 'part3_relationship_goal', 'relationship_goal')),
      part3_time_commitment: normalizeValue(getIncomingValue(incoming, 'part3_time_commitment', 'time_commitment')),
      part3_deal_breakers: normalizeValue(getIncomingValue(incoming, 'part3_deal_breakers', 'deal_breakers')),
      part4_love_languages: normalizeValue(getIncomingValue(incoming, 'part4_love_languages', 'love_languages')),
      part4_security_needs: normalizeValue(getIncomingValue(incoming, 'part4_security_needs', 'security_needs')),
      part4_daily_love_ritual: normalizeValue(getIncomingValue(incoming, 'part4_daily_love_ritual', 'daily_love_ritual')),
      part5_decision_making: normalizeValue(getIncomingValue(incoming, 'part5_decision_making', 'decision_making')),
      part5_communication_style: normalizeValue(getIncomingValue(incoming, 'part5_communication_style', 'communication_style')),
      part5_expense_splitting: normalizeValue(getIncomingValue(incoming, 'part5_expense_splitting', 'expense_splitting')),
      part5_living_together: normalizeValue(getIncomingValue(incoming, 'part5_living_together', 'living_together')),
      part6_ideal_identity: normalizeValue(getIncomingValue(incoming, 'part6_ideal_identity', 'ideal_identity')),
      part6_ideal_body_type: normalizeValue(getIncomingValue(incoming, 'part6_ideal_body_type', 'ideal_body_type')),
      part6_preferred_attribute: normalizeValue(getIncomingValue(incoming, 'part6_preferred_attribute', 'preferred_attribute')),
      part6_ideal_appearance: normalizeValue(getIncomingValue(incoming, 'part6_ideal_appearance', 'ideal_appearance')),
      part6_ideal_height_gap: normalizeRange(getIncomingValue(incoming, 'part6_ideal_height_gap', 'ideal_height_gap'), [-20, 20]),
      part6_ideal_age_gap: normalizeRange(getIncomingValue(incoming, 'part6_ideal_age_gap', 'ideal_age_gap'), [-10, 10]),
      part6_gap_moe: normalizeValue(getIncomingValue(incoming, 'part6_gap_moe', 'gap_moe')),
      part6_personal_traits: normalizeValue(getIncomingValue(incoming, 'part6_personal_traits', 'personal_traits')),
      part7_contact_info: normalizeValue(getIncomingValue(incoming, 'part7_contact_info', 'contact_info')),
      part7_feedback: normalizeValue(getIncomingValue(incoming, 'part7_feedback', 'feedback'))
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
