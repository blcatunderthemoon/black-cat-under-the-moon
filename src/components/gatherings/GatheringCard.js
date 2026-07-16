/**
 * Gathering list card — interactive surface for RSVP discovery.
 */

import Link from 'next/link';

const STATUS_LABEL = {
  open: '招募中',
  full: '已滿額',
  completed: '已結束',
  cancelled: '已取消',
};

const ATTENDANCE_LABEL = {
  pending: '審核中',
  approved: '已獲邀',
  rejected: '未獲邀',
  withdrawn: '已撤回',
};

export default function GatheringCard({ gathering }) {
  if (!gathering) return null;
  const seats = `${gathering.approved_count || 0}/${gathering.max_participants || 0}`;
  const pct = gathering.max_participants
    ? Math.min(100, Math.round(((gathering.approved_count || 0) / gathering.max_participants) * 100))
    : 0;

  return (
    <Link href={`/gatherings/${gathering.id}`} className="gathering-card">
      <div className="gathering-card__glow" aria-hidden="true" />
      <div className="gathering-card__corners" aria-hidden="true" />
      <div className="gathering-card__top">
        <span className={`gathering-card__badge gathering-card__badge--${gathering.is_online ? 'online' : 'offline'}`}>
          {gathering.is_online ? '線上' : '線下'}
        </span>
        <span className={`gathering-card__status gathering-card__status--${gathering.status}`}>
          {STATUS_LABEL[gathering.status] || gathering.status}
        </span>
        {gathering.my_attendance?.status && (
          <span className="gathering-card__mine-chip">
            {ATTENDANCE_LABEL[gathering.my_attendance.status] || gathering.my_attendance.status}
          </span>
        )}
      </div>
      <p className="gathering-card__quest-label">QUEST</p>
      <h3 className="gathering-card__title">{gathering.title}</h3>
      <p className="gathering-card__meta">
        <span className="gathering-card__meta-item">{gathering.starts_at_hk || gathering.starts_at}</span>
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
      <div className="gathering-card__seats" aria-label={`人數 ${seats}`}>
        <div className="gathering-card__seats-track">
          <div className="gathering-card__seats-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="gathering-card__seats-label">{seats}</span>
      </div>
    </Link>
  );
}
