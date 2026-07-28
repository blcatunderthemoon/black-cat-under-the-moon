/**
 * GET /api/dashboard/moonlight-interest
 * Aggregate Moonlight Gathering #001 participation form for ops dashboard.
 *
 * Query: interest=interested|unsure|skip (optional — filters response list only)
 * Charts for dates / slots / price always use「有興趣／已報名」rows.
 */

import { authorizeDashboardAccess } from '../../../lib/dashboard-auth.js';
import { getAdminClient } from '../../../lib/server-auth.js';
import { fetchAllRows } from '../../../lib/supabase-fetch-all.js';
import {
  DATE_ORDER,
  TIME_SLOT_ORDER,
  formatMoonlightAnswers,
  formatMoonlightDate,
  formatMoonlightInterest,
  formatMoonlightPrice,
  formatMoonlightTimeSlot,
} from '../../../lib/moonlight-interest-meta.js';

function bump(map, key, amount = 1) {
  if (!key) return;
  map[key] = (map[key] || 0) + amount;
}

function toSortedBars(map, order, labelFn) {
  const allKeys = order?.length ? [...order] : Object.keys(map).sort((a, b) => (map[b] || 0) - (map[a] || 0));
  const seen = new Set();
  const rows = [];
  for (const key of allKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      key,
      name: labelFn ? labelFn(key) : key,
      value: map[key] || 0,
    });
  }
  for (const key of Object.keys(map)) {
    if (seen.has(key)) continue;
    rows.push({
      key,
      name: labelFn ? labelFn(key) : key,
      value: map[key] || 0,
    });
  }
  return rows;
}

function mapResponse(row) {
  return {
    id: row.id,
    interest: row.interest,
    interest_label: formatMoonlightInterest(row.interest),
    time_slots: row.time_slots || [],
    time_slot_labels: (row.time_slots || []).map(formatMoonlightTimeSlot),
    dates: row.dates || [],
    date_labels: (row.dates || []).map(formatMoonlightDate),
    price_range: row.price_range,
    price_label: formatMoonlightPrice(row.price_range),
    email: row.email || null,
    telegram_username: row.telegram_username || null,
    display_name: row.display_name || null,
    message: row.message || null,
    answers: row.answers || null,
    answers_summary: formatMoonlightAnswers(row.answers) || null,
    user_id: row.user_id || null,
    created_at: row.created_at,
  };
}

function respondWithRows(res, rows, interestFilter) {
  const interestCounts = { interested: 0, unsure: 0, skip: 0 };
  const dateCounts = {};
  const slotCounts = {};
  const priceCounts = {};

  for (const row of rows) {
    bump(interestCounts, row.interest);
    if (row.interest !== 'interested') continue;
    for (const d of row.dates || []) bump(dateCounts, d);
    for (const s of row.time_slots || []) bump(slotCounts, s);
    if (row.price_range) bump(priceCounts, row.price_range);
  }

  const datesByPopularity = Object.entries(dateCounts)
    .map(([key, value]) => ({
      key,
      name: formatMoonlightDate(key),
      value,
    }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));

  const listRows = interestFilter && ['interested', 'unsure', 'skip'].includes(interestFilter)
    ? rows.filter((r) => r.interest === interestFilter)
    : rows;

  return res.status(200).json({
    configured: true,
    totals: {
      all: rows.length,
      interested: interestCounts.interested || 0,
      unsure: interestCounts.unsure || 0,
      skip: interestCounts.skip || 0,
    },
    top_date: datesByPopularity[0] || null,
    charts: {
      interest: ['interested', 'unsure', 'skip'].map((key) => ({
        key,
        name: formatMoonlightInterest(key),
        value: interestCounts[key] || 0,
      })),
      dates: toSortedBars(dateCounts, DATE_ORDER, formatMoonlightDate),
      dates_ranked: datesByPopularity,
      time_slots: toSortedBars(slotCounts, TIME_SLOT_ORDER, formatMoonlightTimeSlot),
      prices: ['250-300', '300-350', '350-400'].map((key) => ({
        key,
        name: formatMoonlightPrice(key),
        value: priceCounts[key] || 0,
      })),
    },
    responses: listRows.map(mapResponse),
  });
}

export default async function handler(req, res) {
  if (!(await authorizeDashboardAccess(req, res))) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getAdminClient();
  const interestFilter = typeof req.query.interest === 'string' ? req.query.interest.trim() : '';

  try {
    const { data, error } = await fetchAllRows(() => admin
      .from('moonlight_interest')
      .select('id, interest, time_slots, dates, price_range, email, telegram_username, display_name, message, answers, user_id, created_at')
      .order('created_at', { ascending: false }));

    if (error) {
      if (error.code === '42703' || /answers|telegram_username/i.test(error.message || '')) {
        const fallback = await fetchAllRows(() => admin
          .from('moonlight_interest')
          .select('id, interest, time_slots, dates, price_range, email, display_name, message, user_id, created_at')
          .order('created_at', { ascending: false }));
        if (fallback.error) {
          console.error('[dashboard/moonlight-interest]', fallback.error.message, fallback.error.code);
          return res.status(500).json({ error: '無法讀取參加表回覆。' });
        }
        return respondWithRows(res, fallback.data || [], interestFilter);
      }
      if (error.code === '42P01') {
        return res.status(503).json({
          error: 'moonlight_interest 表尚未建立，請先執行 migration。',
          configured: false,
        });
      }
      console.error('[dashboard/moonlight-interest]', error.message, error.code);
      return res.status(500).json({ error: '無法讀取參加表回覆。' });
    }

    return respondWithRows(res, data || [], interestFilter);
  } catch (err) {
    console.error('[dashboard/moonlight-interest] unexpected:', err);
    return res.status(500).json({ error: '無法讀取參加表回覆。' });
  }
}
