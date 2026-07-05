/**
 * Single premium upsell for mirror-card visitors — avoids duplicate Passport CTAs.
 */

import Link from 'next/link';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import PixelMixedLabel from './PixelMixedLabel.js';

export function buildMirrorVisitorPremiumPerks({
  premiumLocked,
  messaging,
  photoExchange,
  session,
}) {
  const perks = [];
  if (premiumLocked) perks.push('完整 Mirror Card 詳細資料');
  if (session && messaging?.reason === 'premium_required') {
    perks.push('主動留信聯絡有共鳴的人');
  }
  if (session && photoExchange?.reason === 'premium_required') {
    perks.push('發起真人相片交換邀請（每月 3 次）');
  }
  return perks;
}

export default function MirrorVisitorPremiumUpsell({ perks }) {
  if (!perks?.length) return null;

  return (
    <div className="pixel-notice pixel-notice--premium mirror-premium-notice mirror-visitor-premium">
      <p className="pixel-notice__text mirror-visitor-premium__lead">
        升級 {MOONLIGHT_PASSPORT_BRAND} 解鎖：
      </p>
      <ul className="mirror-visitor-premium__list">
        {perks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
      <Link href="/premium" className="pixel-btn pixel-btn--primary mirror-premium-notice__btn">
        <PixelMixedLabel text={`了解 ${MOONLIGHT_PASSPORT_BRAND}`} />
      </Link>
    </div>
  );
}
