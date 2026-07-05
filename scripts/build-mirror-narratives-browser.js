/**
 * Build public/js/mirror-narratives.js from src/lib ES modules.
 * Run: node scripts/build-mirror-narratives-browser.js
 */

import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PERSONALITY_TYPES } from '../src/lib/mirror-personality.js';
import { INSIGHTS } from '../src/lib/mirror-narratives/data/insights.js';
import { WARNINGS, Q9_TRIGGER_KEYS } from '../src/lib/mirror-narratives/data/warnings.js';
import { MISREAD } from '../src/lib/mirror-narratives/data/misread.js';
import { MOONLIGHT, MOONLIGHT_SHADOW } from '../src/lib/mirror-narratives/data/moonlight.js';
import { MIRROR_HEROES } from '../src/lib/mirror-narratives/data/heroes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PERSONALITY_LEGACY = Object.fromEntries(
  Object.entries(PERSONALITY_TYPES).map(([k, v]) => [k, { desc: v.desc, warning: v.warning }]),
);

const assembleSrc = readFileSync(join(root, 'src/lib/mirror-narratives/assemble.js'), 'utf8')
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/g, '')
  .replace(/^export /gm, '');

const out = `(function (global) {
'use strict';

const TRAIT_KEYS = ${JSON.stringify(['autonomy', 'validation', 'emotional_resonance', 'predictability', 'expressiveness', 'commitment'])};
const TYPE_ORDER = ${JSON.stringify(['solitary', 'sunny', 'mystical', 'sentinel'])};
const PERSONALITY_LEGACY = ${JSON.stringify(PERSONALITY_LEGACY)};
const INSIGHTS = ${JSON.stringify(INSIGHTS)};
const WARNINGS = ${JSON.stringify(WARNINGS)};
const Q9_TRIGGER_KEYS = ${JSON.stringify(Q9_TRIGGER_KEYS)};
const MISREAD = ${JSON.stringify(MISREAD)};
const MOONLIGHT = ${JSON.stringify(MOONLIGHT)};
const MOONLIGHT_SHADOW = ${JSON.stringify(MOONLIGHT_SHADOW)};
const MIRROR_HEROES = ${JSON.stringify(MIRROR_HEROES)};

${assembleSrc.replace(/PERSONALITY_TYPES\[mirrorType\]/g, 'PERSONALITY_LEGACY[mirrorType]').replace(/const p = PERSONALITY_TYPES/g, 'const p = PERSONALITY_LEGACY')}

global.MirrorNarratives = {
  assembleNarrative: assembleNarrative,
  buildLegacyNarrative: buildLegacyNarrative,
  formatWarningRows: formatWarningRows,
  formatWarningSteps: formatWarningSteps,
  rankTraits: rankTraits,
  MIRROR_HEROES: MIRROR_HEROES,
};
})(typeof window !== 'undefined' ? window : global);
`;

writeFileSync(join(root, 'public/js/mirror-narratives.js'), out, 'utf8');
console.log('Wrote public/js/mirror-narratives.js');
