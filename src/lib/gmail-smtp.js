/**
 * Gmail SMTP transport — prefers IPv4 and supports port 465 when 587 is blocked.
 */

import dns from 'dns';
import nodemailer from 'nodemailer';

function ipv4Lookup(hostname, _options, callback) {
  dns.lookup(hostname, { family: 4 }, callback);
}

export function getGmailSmtpConfig() {
  const port = Number(process.env.GMAIL_SMTP_PORT || 465);
  const secure = process.env.GMAIL_SMTP_SECURE != null
    ? process.env.GMAIL_SMTP_SECURE === 'true'
    : port === 465;

  return {
    host: process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    lookup: ipv4Lookup,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,
    ...(secure ? { tls: { servername: 'smtp.gmail.com' } } : {}),
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  };
}

export function getGmailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport(getGmailSmtpConfig());
}
