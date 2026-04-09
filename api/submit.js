export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE = process.env.AIRTABLE_BASE || 'appnlUHCAudTacXKo';
  const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Responses';

  if (!AIRTABLE_TOKEN) {
    return res.status(500).json({ error: 'Server misconfigured: missing token' });
  }

  try {
    // Support environments where req.body may be a JSON string
    const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { fields } = parsedBody;
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: "fields" object required' });
    }

    const fetchImpl = typeof fetch === 'function'
      ? fetch
      : (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

    const response = await fetchImpl(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: [{ fields }], typecast: true })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Airtable error:', data);
      const message = typeof data?.error === 'string'
        ? data.error
        : (data?.error?.message || 'Airtable rejected the request');
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json({ success: true, id: data.records?.[0]?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
