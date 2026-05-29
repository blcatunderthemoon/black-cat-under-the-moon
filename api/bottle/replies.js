import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.SUPABASE_URL     || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid bottle ID.' });

  try {
    const { data, error } = await supabase
      .from('replies')
      .select('id, content, created_at')
      .eq('bottle_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ replies: data || [] });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
