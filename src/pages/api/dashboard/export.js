/**
 * GET /api/dashboard/export
 * Query params:
 *   userId    - specific user id, or "all" for all users
 *   format    - "html" | "xlsx" | "zip"
 *   threshold - min match score (default 40)
 *
 * Returns:
 *   html  → single HTML file using the original match card template
 *   xlsx  → Excel workbook with all match pairs above threshold
 *   zip   → ZIP archive of HTML match cards for each qualifying pair
 */

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { passesHardFilter } from '../../../lib/matching.js';
import { computeCompatibility } from '../../../lib/intelligence.js';
import { buildMatchCardHtml } from '../match_card/template.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { userId, format = 'xlsx', threshold = '0', thresholdMax = '100' } = req.query;
  const thresh = Number(threshold);
  const threshMax = Number(thresholdMax);

  try {
    const [{ data: allUsers, error }, { data: sentData, error: sentError }] = await Promise.all([
      supabase.from('responses').select('*'),
      supabase.from('sent_matches').select('user_a_id, user_b_id'),
    ]);
    if (error) return res.status(500).json({ error: error.message });
    if (sentError) return res.status(500).json({ error: sentError.message });

    const users = allUsers || [];

    // Build a Set of already-sent pair keys for O(1) lookup
    const sentSet = new Set(
      (sentData || []).map(({ user_a_id, user_b_id }) => {
        const [a, b] = user_a_id <= user_b_id ? [user_a_id, user_b_id] : [user_b_id, user_a_id];
        return `${a}-${b}`;
      })
    );

    // Determine which users to export
    let targetUsers = users;
    if (userId && userId !== 'all') {
      const uid = Number(userId);
      const u = users.find((x) => x.id === uid);
      if (!u) return res.status(404).json({ error: '找不到用戶' });
      targetUsers = [u];
    }

    // Build all qualifying pairs using v4 computeCompatibility (0–100 scale)
    const pairs = [];
    for (const user of targetUsers) {
      for (const c of users) {
        if (c.id === user.id) continue;
        if (!passesHardFilter(user, c)) continue;
        const intel = computeCompatibility(user, c);
        if (!intel?.match) continue;
        if (intel.finalScore < thresh) continue;
        if (intel.finalScore > threshMax) continue;
        // deduplicate — only if userId is "all" do we skip reverse pairs
        if (userId === 'all' && user.id > c.id) continue;
        // skip already-sent pairs
        const [a, b] = user.id <= c.id ? [user.id, c.id] : [c.id, user.id];
        if (sentSet.has(`${a}-${b}`)) continue;
        pairs.push({ user, match: c, intel });
      }
    }

    // ─── HTML ───
    if (format === 'html') {
      if (pairs.length === 0) {
        return res.status(200).send('<!DOCTYPE html><html><body style="color:#fff;background:#07060e;padding:40px;font-family:sans-serif"><p>No matches found above threshold.</p></body></html>');
      }
      const { user, match, intel } = pairs[0];
      const html = buildMatchCardHtml({ user, target: match, score: intel.finalScore, breakdown: intel.dimensionScores, intelligence: intel });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="match_${user.id}_${match.id}.html"`);
      return res.status(200).send(html);
    }

    // ─── XLSX ───
    if (format === 'xlsx') {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Black Cat Under The Moon';
      const ws = wb.addWorksheet('配對結果');

      ws.columns = [
        { header: '用戶 A ID', key: 'userA_id', width: 12 },
        { header: '用戶 A 姓名', key: 'userA_name', width: 16 },
        { header: '用戶 A 身份', key: 'userA_identity', width: 14 },
        { header: '用戶 B ID', key: 'userB_id', width: 12 },
        { header: '用戶 B 姓名', key: 'userB_name', width: 16 },
        { header: '用戶 B 身份', key: 'userB_identity', width: 14 },
        { header: '配對總分 (/100)', key: 'total', width: 14 },
        { header: '🔥 身體吸引力', key: 'attraction', width: 16 },
        { header: '💞 情感共鳴', key: 'emotional', width: 14 },
        { header: '📅 生活步調', key: 'lifestyle', width: 14 },
        { header: '💬 溝通與三觀', key: 'communication', width: 16 },
        { header: '💑 關係期待', key: 'relationship', width: 14 },
        { header: '🛡 相處安全感', key: 'conflictSafety', width: 16 },
      ];

      // Style header row
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C3BAA' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 22;

      for (const { user, match: m, intel } of pairs) {
        const b = intel.dimensionScores || {};
        const row = ws.addRow({
          userA_id: user.id,
          userA_name: user.name,
          userA_identity: user.identity,
          userB_id: m.id,
          userB_name: m.name,
          userB_identity: m.identity,
          total: intel.finalScore,
          attraction: b.attraction ?? 0,
          emotional: b.emotional ?? 0,
          lifestyle: b.lifestyle ?? 0,
          communication: b.communication ?? 0,
          relationship: b.relationship ?? 0,
          conflictSafety: b.conflictSafety ?? 0,
        });
        // Colour-code the total score cell
        const totalCell = row.getCell('total');
        const score = intel.finalScore;
        totalCell.font = { bold: true, color: { argb: score >= 75 ? 'FF34D399' : score >= 60 ? 'FFF59E0B' : 'FFF87171' } };
      }

      const buf = await wb.xlsx.writeBuffer();
      const xlsxTs = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Hong_Kong' }).replace(/[-: ]/g, '').slice(0, 12);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="match_export_${xlsxTs}.xlsx"`);
      return res.status(200).send(Buffer.from(buf));
    }

    // ─── ZIP ───
    if (format === 'zip') {
      const zip = new JSZip();
      for (const { user, match: m, intel } of pairs) {
        const htmlAB = buildMatchCardHtml({ user, target: m, score: intel.finalScore, breakdown: intel.dimensionScores, intelligence: intel });
        const htmlBA = buildMatchCardHtml({ user: m, target: user, score: intel.finalScore, breakdown: intel.dimensionScores, intelligence: intel });
        zip.file(`match_${user.id}_${m.id}_A.html`, htmlAB);
        zip.file(`match_${user.id}_${m.id}_B.html`, htmlBA);
      }
      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      const zipTs = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Hong_Kong' }).replace(/[-: ]/g, '').slice(0, 12);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="match_export_${zipTs}.zip"`);
      return res.status(200).send(buf);
    }

    return res.status(400).json({ error: '不支援的格式，請使用 html、xlsx 或 zip' });
  } catch (err) {
    console.error('export error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}