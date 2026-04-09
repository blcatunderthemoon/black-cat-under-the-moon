import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

    const normalizeRange = (value, fallback) => {
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      return JSON.stringify(fallback);
    };

    // Align frontend keys to latest Supabase `responses` column names.
    const payload = {
      name: incoming.name || '',
      age: (incoming.age ?? '').toString(),
      height: (incoming.height ?? '').toString(),
      body_type: incoming.body_type || '',
      attribute: incoming.identity || '',
      hair_style: incoming.hair_style || '',
      fashion_style: incoming.fashion_style || '',
      bed_position: incoming.bed_role || '',
      social_energy: incoming.social_energy || '',
      ideal_weekend: incoming.weekend_mode || '',
      interests: incoming.interests || '',
      exercise: incoming.exercise_habit || '',
      travel_mode: incoming.travel_mode || '',
      relationship_goal: incoming.relationship_goal || '',
      time_investment: incoming.time_commitment || '',
      deal_breaker: incoming.deal_breakers || '',
      love_language: incoming.love_languages || '',
      security_need: incoming.security_needs || '',
      ritual_sense: incoming.daily_love_ritual || '',
      decision_style: incoming.decision_making || '',
      conflict_style: incoming.communication_style || '',
      money_view: incoming.expense_splitting || '',
      cohabitation: incoming.cohabitation || '',
      preferred_attribute: incoming.ideal_identity || '',
      ideal_appearance: incoming.ideal_visuals || '',
      height_diff: normalizeRange(incoming.ideal_height_gap, [-20, 20]),
      age_diff: normalizeRange(incoming.ideal_age_gap, [-10, 10]),
      gap_moe: incoming.gap_moe || '',
      three_traits: incoming.personal_traits || '',
      contact_info: incoming.contact_info || '',
      feedback: incoming.feedback || ''
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
