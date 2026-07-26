/**
 * Gathering list card — interactive surface for RSVP discovery.
 */

import Link from 'next/link';
import {
  getGatheringDisplayStatus,
  isGatheringOngoing,
} from '../../lib/gathering-phase.js';

const ATTENDANCE_LABEL = {
  pending: '審核中',
  approved: '已獲邀',
  rejected: '未獲邀',
  withdrawn: '已撤回',
};

export default function GatheringCard({ gathering, past = false }) {
  if (!gathering) return null;
  const approved = gathering.approved_count || 0;
  const max = gathering.max_participants || 0;
  const remaining = Math.max(0, max - approved);
  const pct = max
    ? Math.min(100, Math.round((approved / max) * 100))
    : 0;
  const seatsFull = max > 0 && remaining === 0;
  const display = getGatheringDisplayStatus(gathering);
  const ongoing = isGatheringOngoing(gathering);
  const isPast = past || display.key === 'completed';
  const timeLabel = gathering.time_range_hk
    || gathering.starts_at_hk
    || gathering.starts_at;

  return (
    <Link
      href={`/gatherings/${gathering.id}`}
      className={[
        'gathering-card',
        gathering.status === 'cancelled' ? 'gathering-card--cancelled' : '',
        isPast ? 'gathering-card--past' : '',
        ongoing ? 'gathering-card--ongoing' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="gathering-card__glow" aria-hidden="true" />
      <div className="gathering-card__top">
        <div className="gathering-card__top-start">
          <span className={`gathering-card__badge gathering-card__badge--${gathering.is_online ? 'online' : 'offline'}`}>
            {gathering.is_online ? '線上' : '線下'}
          </span>
          {gathering.status !== 'cancelled' && gathering.my_attendance?.status && (
            <span className="gathering-card__mine-chip">
              {ATTENDANCE_LABEL[gathering.my_attendance.status] || gathering.my_attendance.status}
            </span>
          )}
        </div>
        <span className={`gathering-card__status gathering-card__status--${display.key}`}>
          {display.label}
        </span>
      </div>
      <h3 className="gathering-card__title">{gathering.title}</h3>
      <p className="gathering-card__meta">
        <span className="gathering-card__meta-item">{timeLabel}</span>
        <span className="gathering-card__meta-dot" aria-hidden="true">·</span>
        <span className="gathering-card__meta-item">{gathering.location_public}</span>
      </p>
      {gathering.host && (
        <p className="gathering-card__host">
          主辦 {gathering.host.display_name}
          {gathering.host.family_zh ? ` · ${gathering.host.family_zh}` : ''}
        </p>
      )}
      {!!gathering.tag_labels?.length && (
        <div className="gathering-card__tags">
          {gathering.tag_labels.map((label) => (
            <span key={label} className="gathering-card__tag">{label}</span>
          ))}
        </div>
      )}
      <div className="gathering-card__seats" aria-label={`已報名 ${approved}，限額 ${max} 人`}>
        <div className="gathering-card__seats-head">
          <span className="gathering-card__seats-label">
            <b>{approved}</b>/<b>{max}</b>
          </span>
          <span className={`gathering-card__seats-remain${seatsFull ? ' is-full' : ''}`}>
            {seatsFull ? '已滿額' : `仲有 ${remaining} 個位`}
          </span>
        </div>
        <div className="gathering-card__seats-track">
          <div className="gathering-card__seats-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}
