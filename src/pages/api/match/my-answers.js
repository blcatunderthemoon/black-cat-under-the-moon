/**
 * GET /api/match/my-answers
 * Logged-in users only. Returns the latest Echo questionnaire answers when
 * the submission is owned by this account (user_id) or matches the verified
 * account email (legacy email-only rows may be auto-linked first).
 */

import { requireUser, sendAuthError, getAdminClient, getProfile } from '../../../lib/server-auth.js';
import {
  autoLinkLegacyMatchResponses,
  findLatestMatchResponse,
} from '../../../lib/match-submission.js';

const ANSWER_KEYS = [
  'name',
  'age',
  'height',
  'body_type',
  'identity',
  'hair_style',
  'fashion_styles',
  'bed_role',
  'social_energy',
  'weekend_mode',
  'interests',
  'exercise_habits',
  'travel_mode',
  'relationship_goal',
  'time_commitment',
  'deal_breakers',
  'love_languages',
  'security_needs',
  'daily_love_ritual',
  'decision_making',
  'communication_style',
  'expense_splitting',
  'living_together',
  'ideal_identity',
  'ideal_body_type',
  'ideal_height_gap',
  'ideal_age_gap',
  'gap_moe',
  'preferred_attribute',
  'ideal_appearance',
  'personal_traits',
  'email',
  'ig_username',
  'tg_username',
  'feedback',
];

function normalizeEmail(email) {
  return (email || '').toLowerCase().trim();
}

function responseEmailMatchesAccount(row, accountEmail) {
  const account = normalizeEmail(accountEmail);
  if (!account || !row) return false;
  const rowNorm = normalizeEmail(row.normalized_email || row.email);
  return Boolean(rowNorm) && rowNorm === account;
}

function pickAnswers(row) {
  const answers = {};
  for (const key of ANSWER_KEYS) {
    if (row[key] == null || row[key] === '') continue;
    answers[key] = row[key];
  }
  // Legacy column aliases used by older submissions
  if (!answers.preferred_attribute && answers.ideal_identity) {
    answers.preferred_attribute = answers.ideal_identity;
  }
  if (!answers.ideal_appearance && answers.ideal_body_type) {
    answers.ideal_appearance = answers.ideal_body_type;
  }
  delete answers.ideal_identity;
  delete answers.ideal_body_type;
  return answers;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return sendAuthError(res, err);
  }

  const accountEmail = normalizeEmail(user.email);
  if (!accountEmail) {
    return res.status(403).json({ error: 'Account email required' });
  }

  const admin = getAdminClient();
  const profile = await getProfile(user.id);

  await autoLinkLegacyMatchResponses(admin, user.id, user.email);

  const row = await findLatestMatchResponse(admin, {
    userId: user.id,
    email: user.email,
    profileEmail: profile?.email,
  });

  if (!row) {
    return res.status(404).json({ error: 'No submission found' });
  }

  const ownedByUser = row.user_id === user.id;
  const emailMatches = responseEmailMatchesAccount(row, accountEmail);
  if (!ownedByUser && !emailMatches) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // 1A: account email must match the submission email when present
  if (row.email || row.normalized_email) {
    if (!emailMatches) {
      return res.status(403).json({ error: 'Email mismatch' });
    }
  }

  return res.status(200).json({
    id: row.id,
    submitted_at: row.created_at,
    answers: pickAnswers(row),
  });
}
