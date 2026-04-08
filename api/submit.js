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
    const { fields } = req.body;
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Invalid payload: "fields" object required' });
    }

    const response = await fetch(
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

    const data = await response.json();

    if (!response.ok) {
      console.error('Airtable error:', data);
      return res.status(response.status).json({ error: data.error || 'Airtable rejected the request' });
    }

    return res.status(200).json({ success: true, id: data.records?.[0]?.id });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
