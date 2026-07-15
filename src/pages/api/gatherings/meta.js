/**
 * GET /api/gatherings/meta — tags, gates, copy for create form
 */

import {
  GATHERING_OPEN_HOST_LIMIT,
  GATHERING_MONTHLY_HOST_LIMIT,
  GATHERING_DEFAULT_MAX_PARTICIPANTS,
} from '../../../lib/gatherings.js';
import { GATHERING_TAGS } from '../../../lib/gathering-tags.js';
import {
  HK_DISTRICTS,
  GATHERING_LOCATION_ONLINE,
  GATHERING_PUBLIC_LOCATIONS,
} from '../../../lib/gathering-districts.js';
import { TYPE_ORDER, getFamilyNameZh } from '../../../lib/mirror-personality.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(200).json({
    tags: GATHERING_TAGS,
    districts: HK_DISTRICTS,
    locations: GATHERING_PUBLIC_LOCATIONS,
    location_online: GATHERING_LOCATION_ONLINE,
    families: TYPE_ORDER.map((id) => ({ id, label: getFamilyNameZh(id) })),
    gates: {
      host_min_level: 1,
      host_mirror_required: false,
      apply_mirror_required: false,
      member_only: true,
      open_host_limit: GATHERING_OPEN_HOST_LIMIT,
      monthly_host_limit: GATHERING_MONTHLY_HOST_LIMIT,
      default_max_participants: GATHERING_DEFAULT_MAX_PARTICIPANTS,
    },
    safety_notice:
      '線下見面請自行評估安全。平台僅提供聯繫與審批工具，並非活動主辦方；私密地址僅批准參加者可見。',
  });
}
