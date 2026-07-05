/**
 * Build public/js/mirror-v3.js from src/lib ES modules.
 * Run: node scripts/build-mirror-v3-browser.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { MIRROR_PSYCH_QUESTIONS_V3 } from '../src/lib/mirror-questions-v3.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scoringSrc = readFileSync(join(root, 'src/lib/mirror-scoring-v3.js'), 'utf8')
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/g, '')
  .replace(/^export /gm, '');

const tensionRules = `const MIRROR_V3_TENSION_RULES = [
  { id: 'freedom_vs_attention', when: function (a) { return a.m_q2 === 'reserve_time' && a.m_q4 === 'worry_mood'; }, copy_zh: '你渴望自由，但真正安靜落嚟時，又會害怕自己唔被需要。' },
  { id: 'independent_but_wants_proof', when: function (a) { return a.m_q2 === 'reserve_time' && (a.m_q4 === 'ping_when_free' || a.m_q4 === 'want_heads_up'); }, copy_zh: '你重視獨立，但心入面仍然需要一啲信號確認自己重要。' },
  { id: 'give_space_but_need_signal', when: function (a) { return a.m_q8 === 'accept_trust' && (a.m_q4 === 'worry_mood' || a.m_q4 === 'want_heads_up'); }, copy_zh: '你習慣自己扛，但心入面仍然渴望有人主動靠近。' },
];`;

const psych = `const MIRROR_PSYCH_QUESTIONS_V3 = ${JSON.stringify(MIRROR_PSYCH_QUESTIONS_V3, null, 2)};`;

const footer = `
function getMirrorQuestionBank(profileQuestions) {
  return (profileQuestions || []).concat(MIRROR_PSYCH_QUESTIONS_V3);
}
global.MirrorV3 = {
  SCORING_VERSION_V3,
  MIRROR_PSYCH_QUESTIONS_V3,
  TRAIT_LABELS,
  computeMirrorResultV3,
  computeTraitScores,
  traitToCat,
  getTopTraitBars,
  getTraitBars,
  detectTensions,
  shuffleOptionDefs,
  isTraitQuestion,
  getMirrorQuestionBank,
};
`;

const out = `(function (global) {\n'use strict';\n${psych}\n${tensionRules}\n${scoringSrc}\n${footer}\n})(typeof window !== 'undefined' ? window : global);\n`;

writeFileSync(join(root, 'public/js/mirror-v3.js'), out);
console.log('Built public/js/mirror-v3.js (' + out.length + ' bytes)');

await import('./build-mirror-narratives-browser.js');
