import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action = 'bottles', page = '1' } = req.query;
    const limit  = 50;
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    if (action === 'bottles') {
      const { data, error, count } = await supabase
        .from('bottles')
        .select('id, content, mood_tag, report_count, is_active, created_at, user_id', { count: 'exact' })
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ items: data || [], total: count || 0 });
    }

    if (action === 'replies') {
      const { data, error, count } = await supabase
        .from('replies')
        .select('id, bottle_id, content, report_count, is_hidden, created_at, user_id', { count: 'exact' })
        .eq('is_hidden', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ items: data || [], total: count || 0 });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, type, id } = body;

    if (!id || typeof id !== 'string' || !UUID_RE.test(id)) {
      return res.status(400).json({ error: 'Invalid ID.' });
    }
    if (!['restore', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action.' });
    }
    if (!['bottle', 'reply'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type.' });
    }

    if (action === 'restore') {
      const table  = type === 'bottle' ? 'bottles' : 'replies';
      const column = type === 'bottle' ? 'is_active' : 'is_hidden';
      const value  = type === 'bottle' ? true : false;

      const { error } = await supabase
        .from(table)
        .update({ [column]: value, report_count: 0 })
        .eq('id', id);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    if (action === 'delete') {
      const table = type === 'bottle' ? 'bottles' : 'replies';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
