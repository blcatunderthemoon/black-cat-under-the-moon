/**
 * GET  /api/dashboard/seed          → { count } of existing seed rows
 * POST /api/dashboard/seed          → body: { action: 'seed', count?: number }
 *   action=seed  → insert N generated users using anon key, return { inserted, sample }
 *   (clear is SQL-only — use the SQL panel in the UI)
 */

import { createClient } from '@supabase/supabase-js';
import { generateUser, IDENTITIES } from '../../../lib/seed-data.js';

const getSupabase = () =>
  createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

export default async function handler(req, res) {
  // ─── GET: current seed count ───
  if (req.method === 'GET') {
    const { count, error } = await getSupabase()
      .from('responses')
      .select('id', { count: 'exact', head: true })
      .like('feedback', 'Seed user%');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ count: count ?? 0 });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { action, count: rawCount } = body;

  // ─── CLEAR (disabled — use the SQL panel) ───
  if (action === 'clear') {
    return res.status(400).json({ error: '請使用頁面上的「顯示等效 SQL」手動在 Supabase 執行刪除。' });
  }

  // ─── SEED ───
  if (action === 'seed') {
    const count = Math.max(5, Math.min(100, Number(rawCount) || 20));
    const users = Array.from({ length: count }, (_, i) => generateUser(i));

    const { data, error } = await getSupabase()
      .from('responses')
      .insert(users)
      .select('id, name, identity, email');

    if (error) return res.status(500).json({ error: error.message });

    const mix = {};
    for (const id of IDENTITIES) mix[id] = (data || []).filter((u) => u.identity === id).length;

    return res.status(200).json({
      inserted: data?.length ?? 0,
      mix,
      sample: (data || []).slice(0, 8).map((u) => ({ id: u.id, name: u.name, identity: u.identity })),
    });
  }

  return res.status(400).json({ error: '無效的 action' });
}
