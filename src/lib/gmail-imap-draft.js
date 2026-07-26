/**
 * Append a message to Gmail Drafts via IMAP (does not send).
 *
 * Env: GMAIL_USER, GMAIL_APP_PASSWORD
 */

import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';

export function isGmailDraftConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

async function buildRawMime({ from, to, subject, html, text, bcc }) {
  const streamTransport = nodemailer.createTransport({ streamTransport: true, newline: 'unix' });
  const info = await streamTransport.sendMail({
    from,
    ...(to ? { to } : {}),
    ...(bcc ? { bcc } : {}),
    subject,
    html,
    text,
  });
  const chunks = [];
  for await (const chunk of info.message) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function findDraftsPath(client) {
  const tree = await client.listTree();
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.specialUse && String(node.specialUse).toLowerCase().includes('drafts')) {
        return node.path;
      }
      if (node.folders?.length) {
        const found = walk(node.folders);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(tree.folders || []) || '[Gmail]/Drafts';
}

/**
 * @param {{
 *   to?: string,
 *   subject: string,
 *   html: string,
 *   text?: string,
 * }} opts
 * @returns {Promise<{ ok: true, draftsPath: string } | { ok: false, error: string, hint?: string }>}
 */
export async function appendGmailDraft(opts) {
  if (!isGmailDraftConfigured()) {
    return {
      ok: false,
      error: 'Gmail not configured.',
      hint: 'Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart.',
    };
  }

  const from = `"Black Cat Under The Moon" <${process.env.GMAIL_USER}>`;
  const subject = String(opts.subject || '').trim();
  const html = String(opts.html || '');
  const text = opts.text != null ? String(opts.text) : undefined;
  const to = typeof opts.to === 'string' ? opts.to.trim() : '';

  if (!subject || !html) {
    return { ok: false, error: 'subject and html are required.' };
  }

  const rawMime = await buildRawMime({
    from,
    to: to || undefined,
    subject,
    html,
    text,
  });

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    logger: false,
  });

  try {
    await client.connect();
    const draftsPath = await findDraftsPath(client);
    await client.append(draftsPath, rawMime, ['\\Draft', '\\Seen']);
    await client.logout();
    return { ok: true, draftsPath };
  } catch (err) {
    try { await client.logout(); } catch { /* ignore */ }
    console.error('[gmail-imap-draft]', err);
    return { ok: false, error: err.message || 'Failed to create Gmail draft.' };
  }
}
