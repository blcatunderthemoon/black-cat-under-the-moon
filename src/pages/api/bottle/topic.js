/**
 * GET /api/bottle/topic
 *
 * Returns the current pinned topic banner config from the `topic_banner` DB table.
 * Falls back to BOTTLE_TOPIC_JSON env var if the table doesn't exist yet.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  // Try reading from DB first
  if (supabaseUrl && supabaseAnonKey) {
    const { data, error } = await supabase
      .from('topic_banner')
      .select('active, type, text, tag, bottle_id, count')
      .eq('id', 1)
      .maybeSingle();

    // If table exists and returned a row, use it
    if (!error && data) {
      if (!data.active) return res.status(200).json({ active: false });
      const rawTag = data.tag || null;
      let parsedTags = [];
      if (rawTag) {
        if (rawTag.startsWith('[')) {
          try { parsedTags = JSON.parse(rawTag); } catch { parsedTags = [rawTag]; }
        } else {
          parsedTags = [rawTag];
        }
      }
      return res.status(200).json({
        active:   true,
        type:     data.type === 'featured' ? 'featured' : 'official',
        text:     data.text || '',
        tag:      parsedTags[0] || null,
        tags:     parsedTags,
        bottleId: data.bottle_id || null,
        count:    Number.isFinite(Number(data.count)) ? Number(data.count) : null,
      });
    }
  }

  // Fallback: env var (for local dev or before DB migration is run)
  const raw = process.env.BOTTLE_TOPIC_JSON;
  if (!raw) return res.status(200).json({ active: false });

  try {
    const topic = JSON.parse(raw);
    if (typeof topic !== 'object' || topic === null) return res.status(200).json({ active: false });
    return res.status(200).json({
      active:   Boolean(topic.active),
      type:     topic.type === 'featured' ? 'featured' : 'official',
      text:     typeof topic.text === 'string' ? topic.text.slice(0, 200) : '',
      tag:      typeof topic.tag === 'string'  ? topic.tag  : null,
      bottleId: typeof topic.bottleId === 'string' ? topic.bottleId : null,
      count:    Number.isFinite(Number(topic.count)) ? Number(topic.count) : null,
    });
  } catch {
    return res.status(200).json({ active: false });
  }
}

