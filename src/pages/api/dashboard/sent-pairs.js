/**
 * /api/dashboard/sent-pairs
 *
 * GET  — list sent pairs (optional ?userId=<id> to filter by one user)
 * POST — manually record a sent pair { user_a_id, user_b_id, match_score, notes }
 * DELETE — remove a record by ?id=<id>
 *
 * Pair order is always normalised: smaller numeric id → user_a_id
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

/** Ensure pair order is canonical (smaller id first) */
function normalisePair(a, b) {
  const numA = Number(a);
  const numB = Number(b);
  return numA <= numB ? [numA, numB] : [numB, numA];
}

export default async function handler(req, res) {
  // ── GET ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { userId, page = '1', pageSize = '50' } = req.query;
    const limit = Math.min(Number(pageSize) || 50, 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    let query = supabase
      .from('sent_matches')
      .select(
        `id, user_a_id, user_b_id, match_score, sent_at, notes,
         user_a:responses!sent_matches_user_a_id_fkey(id, name, identity, age),
         user_b:responses!sent_matches_user_b_id_fkey(id, name, identity, age)`,
        { count: 'exact' }
      )
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      const uid = Number(userId);
      query = query.or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`);
    }

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ total: count, page: Number(page), pageSize: limit, data: data || [] });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { user_a_id, user_b_id, match_score, notes } = body;

    if (!user_a_id || !user_b_id) {
      return res.status(400).json({ error: 'user_a_id and user_b_id are required' });
    }

    const [normA, normB] = normalisePair(user_a_id, user_b_id);
    const score = match_score != null ? Math.max(0, Math.min(100, Number(match_score))) : null;

    const { data, error } = await supabase
      .from('sent_matches')
      .upsert(
        { user_a_id: normA, user_b_id: normB, match_score: score, notes: notes || null },
        { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ success: true, data });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const id = Number(req.query.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'Query param ?id=<number> is required' });
    }

    const { error } = await supabase.from('sent_matches').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
