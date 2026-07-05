/**
 * Copy html-to-image + html2canvas browser bundles into public/js/vendor/.
 * Run: node scripts/vendor-mirror-capture.js
 */

import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'public/js/vendor');

mkdirSync(vendorDir, { recursive: true });

copyFileSync(
  join(root, 'node_modules/html-to-image/dist/html-to-image.js'),
  join(vendorDir, 'html-to-image.min.js'),
);
copyFileSync(
  join(root, 'node_modules/html2canvas/dist/html2canvas.min.js'),
  join(vendorDir, 'html2canvas.min.js'),
);

console.log('Vendored mirror capture libs → public/js/vendor/');
