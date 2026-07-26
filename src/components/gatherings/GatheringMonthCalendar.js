/**
 * HKT month calendar for Moonlight Gatherings.
 */

import {
  GATHERING_CALENDAR_MIN,
  buildGatheringMonthGrid,
  gatheringWeekdayLabelsZh,
  groupGatheringsByHkDate,
  isGatheringPastEvent,
  isGatheringYmAtMin,
  shiftGatheringYm,
} from '../../lib/gathering-calendar.js';
import { getHongKongDateString } from '../../lib/hong-kong-time.js';
import GatheringCard from './GatheringCard.js';
import LoadingText from '../LoadingText.js';
import { ForumMoonIcon } from '../UiIcons.js';

function formatMonthTitle(year, month) {
  return `${year}年${month}月`;
}

function formatSelectedLabel(dateKey) {
  if (!dateKey) return '';
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateKey;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

function DayEventList({ items, past = false }) {
  if (!items.length) return null;
  return (
    <div className={`gatherings-list${past ? ' gatherings-list--past' : ''}`}>
      {items.map((g, i) => (
        <div key={g.id} className="gatherings-list__item" style={{ '--i': i }}>
          <GatheringCard gathering={g} past={past} />
        </div>
      ))}
    </div>
  );
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
  const todayKey = getHongKongDateString();
  const byDate = groupGatheringsByHkDate(gatherings);
  const grid = buildGatheringMonthGrid(year, month);
  const weekdays = gatheringWeekdayLabelsZh();
  const atMin = isGatheringYmAtMin(year, month);
  const selectedList = selectedDate ? (byDate.get(selectedDate) || []) : [];
  const upcoming = [];
  const past = [];
  for (const g of selectedList) {
    if (isGatheringPastEvent(g)) past.push(g);
    else upcoming.push(g);
  }
  const selectedIsPastDay = Boolean(selectedDate && selectedDate < todayKey);

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
      <div className="gathering-cal__legend" aria-label="日曆圖示說明">
        <button
          type="button"
          className="gathering-cal__legend-item gathering-cal__legend-item--live"
          data-tip="進行中／即將"
          title="進行中／即將"
          aria-label="進行中／即將"
        >
          <ForumMoonIcon size={12} />
        </button>
        <button
          type="button"
          className="gathering-cal__legend-item gathering-cal__legend-item--past"
          data-tip="已結束"
          title="已結束"
          aria-label="已結束"
        >
          <ForumMoonIcon size={12} />
        </button>
      </div>

      <div className="gathering-cal__weekdays" aria-hidden="true">
        {weekdays.map((label) => (
          <span key={label} className="gathering-cal__weekday">{label}</span>
        ))}
      </div>

      <div className="gathering-cal__grid" role="grid" aria-label={`${formatMonthTitle(year, month)} 日曆`}>
        {grid.map((cell) => {
          const dayList = cell.inMonth ? (byDate.get(cell.dateKey) || []) : [];
          const liveCount = dayList.filter((g) => !isGatheringPastEvent(g) && g.status !== 'cancelled').length;
          const pastCount = dayList.filter((g) => isGatheringPastEvent(g) && g.status !== 'cancelled').length;
          const activeCount = liveCount + pastCount;
          const selected = selectedDate === cell.dateKey;
          const markerPastOnly = pastCount > 0 && liveCount === 0;
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
                cell.isPast ? 'is-past' : '',
                activeCount > 0 ? 'has-events' : '',
                markerPastOnly ? 'has-events--past' : '',
                liveCount > 0 ? 'has-events--live' : '',
                selected ? 'is-selected' : '',
              ].filter(Boolean).join(' ')}
              aria-label={`${cell.dateKey}${liveCount ? `，${liveCount} 場進行中` : ''}${pastCount ? `，${pastCount} 場已結束` : ''}`}
              aria-pressed={selected}
              onClick={() => cell.inMonth && onSelectDate?.(cell.dateKey)}
            >
              <span className="gathering-cal__day-num">{cell.day}</span>
              {activeCount > 0 && (
                <span className={`gathering-cal__marker${markerPastOnly ? ' is-past' : ''}`} aria-hidden="true">
                  <span className="gathering-cal__marker-moon">
                    <ForumMoonIcon size={11} />
                  </span>
                  {activeCount > 1 && <span className="gathering-cal__marker-count">{activeCount}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={`gathering-cal__panel${selectedIsPastDay ? ' gathering-cal__panel--past' : ''}`}>
        <div className="gathering-cal__panel-head">
          <h3 className="gathering-cal__panel-title">
            {selectedDate ? formatSelectedLabel(selectedDate) : '揀一日睇聚會'}
          </h3>
          {selectedDate && selectedList.length > 0 && (
            <p className="gathering-cal__panel-kicker">
              {selectedIsPastDay
                ? '過去聚會'
                : upcoming.length && past.length
                  ? '進行中／即將 · 已結束'
                  : past.length && !upcoming.length
                    ? '已結束'
                    : '進行中／即將'}
            </p>
          )}
        </div>

        {loading ? (
          <LoadingText className="gatherings-empty" />
        ) : error ? (
          <p className="gatherings-empty gatherings-empty--err">{error}</p>
        ) : !selectedDate ? (
          <p className="gatherings-empty">點日曆上面嘅日子，睇當日聚會或撳右下角「發起聚會」開新局。</p>
        ) : selectedList.length === 0 ? (
          <div className="gatherings-empty-panel gatherings-empty-panel--compact">
            <p className="gatherings-empty-panel__title">呢日仲好靜</p>
            <p className="gatherings-empty-panel__lead">未有聚會 —— 撳右下角「發起聚會」做召集人。</p>
          </div>
        ) : (
          <div className="gathering-cal__sections">
            {upcoming.length > 0 && (
              <section className="gathering-cal__section" aria-label="進行中或即將開始">
                {past.length > 0 && (
                  <h4 className="gathering-cal__section-title gathering-cal__section-title--live">
                    進行中／即將
                  </h4>
                )}
                <DayEventList items={upcoming} />
              </section>
            )}
            {past.length > 0 && (
              <section className="gathering-cal__section" aria-label="已結束的聚會">
                {(upcoming.length > 0 || !selectedIsPastDay) && (
                  <h4 className="gathering-cal__section-title gathering-cal__section-title--past">
                    已結束
                  </h4>
                )}
                <DayEventList items={past} past />
              </section>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
