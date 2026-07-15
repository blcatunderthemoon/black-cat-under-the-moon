/**
 * HKT month calendar for Moonlight Gatherings.
 */

import {
  GATHERING_CALENDAR_MIN,
  buildGatheringMonthGrid,
  gatheringWeekdayLabelsZh,
  groupGatheringsByHkDate,
  isGatheringYmAtMin,
  shiftGatheringYm,
} from '../../lib/gathering-calendar.js';
import GatheringCard from './GatheringCard.js';
import LoadingText from '../LoadingText.js';

function formatMonthTitle(year, month) {
  return `${year}年${month}月`;
}

function formatSelectedLabel(dateKey) {
  if (!dateKey) return '';
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

export default function GatheringMonthCalendar({
  year,
  month,
  gatherings = [],
  selectedDate,
  onSelectDate,
  onMonthChange,
  loading = false,
  error = '',
}) {
  const byDate = groupGatheringsByHkDate(gatherings);
  const grid = buildGatheringMonthGrid(year, month);
  const weekdays = gatheringWeekdayLabelsZh();
  const atMin = isGatheringYmAtMin(year, month);
  const selectedList = selectedDate ? (byDate.get(selectedDate) || []) : [];

  function go(delta) {
    const next = shiftGatheringYm(year, month, delta);
    if (delta < 0 && isGatheringYmAtMin(year, month)) return;
    if (
      delta < 0
      && (next.year < GATHERING_CALENDAR_MIN.year
        || (next.year === GATHERING_CALENDAR_MIN.year && next.month < GATHERING_CALENDAR_MIN.month))
    ) {
      return;
    }
    onMonthChange?.(next);
  }

  return (
    <section className="gathering-cal" aria-label="月光聚會月曆">
      <div className="gathering-cal__toolbar">
        <button
          type="button"
          className="gathering-cal__nav"
          disabled={atMin}
          onClick={() => go(-1)}
          aria-label="上個月"
        >
          ‹
        </button>
        <h2 className="gathering-cal__month">
          {formatMonthTitle(year, month)}
        </h2>
        <button
          type="button"
          className="gathering-cal__nav"
          onClick={() => go(1)}
          aria-label="下個月"
        >
          ›
        </button>
      </div>

      <p className="gathering-cal__hint">點日子睇詳情 · 左右換月</p>

      <div className="gathering-cal__weekdays" aria-hidden="true">
        {weekdays.map((label) => (
          <span key={label} className="gathering-cal__weekday">{label}</span>
        ))}
      </div>

      <div className="gathering-cal__grid" role="grid" aria-label={`${formatMonthTitle(year, month)} 日曆`}>
        {grid.map((cell) => {
          const count = cell.inMonth ? (byDate.get(cell.dateKey)?.length || 0) : 0;
          const selected = selectedDate === cell.dateKey;
          return (
            <button
              key={cell.dateKey + (cell.inMonth ? '' : '-out')}
              type="button"
              role="gridcell"
              disabled={!cell.inMonth}
              className={[
                'gathering-cal__day',
                cell.inMonth ? '' : 'is-out',
                cell.isToday ? 'is-today' : '',
                count > 0 ? 'has-events' : '',
                selected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              aria-label={`${cell.dateKey}${count ? `，${count} 場聚會` : ''}`}
              aria-pressed={selected}
              onClick={() => cell.inMonth && onSelectDate?.(cell.dateKey)}
            >
              <span className="gathering-cal__day-num">{cell.day}</span>
              {count > 0 && (
                <span className="gathering-cal__dots" aria-hidden="true">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <i key={i} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="gathering-cal__panel">
        <div className="gathering-cal__panel-head">
          <h3 className="gathering-cal__panel-title">
            {selectedDate ? formatSelectedLabel(selectedDate) : '揀一日睇聚會'}
          </h3>
        </div>

        {loading ? (
          <LoadingText className="gatherings-empty" />
        ) : error ? (
          <p className="gatherings-empty gatherings-empty--err">{error}</p>
        ) : !selectedDate ? (
          <p className="gatherings-empty">點日曆上面嘅日子，睇當日聚會或用上方「發起聚會」開新局。</p>
        ) : selectedList.length === 0 ? (
          <div className="gatherings-empty-panel gatherings-empty-panel--compact">
            <p className="gatherings-empty-panel__title">呢日仲好靜</p>
            <p className="gatherings-empty-panel__lead">未有聚會 —— 撳上方「發起聚會」做召集人。</p>
          </div>
        ) : (
          <div className="gatherings-list">
            {selectedList.map((g, i) => (
              <div key={g.id} className="gatherings-list__item" style={{ '--i': i }}>
                <GatheringCard gathering={g} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
