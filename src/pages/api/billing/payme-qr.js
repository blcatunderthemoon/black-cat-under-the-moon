/**
 * GET /api/billing/payme-qr
 * Streams the PayMe QR image — logged-in members only.
 */

import fs from 'fs';
import path from 'path';
import { requireUser, sendAuthError } from '../../../lib/server-auth.js';

export const config = {
  api: {
    responseLimit: false,
  },
};

function resolveQrPath() {
  if (process.env.PAYME_QR_FILE_PATH) {
    return path.resolve(process.env.PAYME_QR_FILE_PATH);
  }
  return path.join(process.cwd(), 'secure-assets', 'PayCode.jpg');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const filePath = resolveQrPath();
  if (!fs.existsSync(filePath)) {
    console.error('[billing/payme-qr] file missing:', filePath);
    return res.status(404).json({ error: 'qr_not_configured' });
  }

  const ext = path.extname(filePath).toLowerCase();
  const type =
    ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
        : 'image/jpeg';

  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('[billing/payme-qr] read error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'qr_read_failed' });
    else res.end();
  });
  stream.pipe(res);
}
