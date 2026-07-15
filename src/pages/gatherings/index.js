/**
 * /gatherings — month calendar (from 2026-07), HKT under the hood
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SeoHead from '../../components/SeoHead.js';
import GatheringShell from '../../components/gatherings/GatheringShell.js';
import GatheringMonthCalendar from '../../components/gatherings/GatheringMonthCalendar.js';
import GatheringSafetyNotice from '../../components/gatherings/GatheringSafetyNotice.js';
import { useAuth } from '../../lib/auth-context.js';
import { getHongKongDateParts, getHongKongDateString } from '../../lib/hong-kong-time.js';
import {
  clampGatheringYm,
  currentGatheringYm,
  formatGatheringYm,
  gatheringMonthRangeIso,
  parseGatheringYm,
} from '../../lib/gathering-calendar.js';

function todayKeyIfInMonth(year, month) {
  const today = getHongKongDateString();
  const { year: ty, month: tm } = getHongKongDateParts();
  if (ty === year && tm === month) return today;
  return null;
}

export default function GatheringsIndexPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [gatherings, setGatherings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const initialYm = useMemo(() => currentGatheringYm(), []);
  const [year, setYear] = useState(initialYm.year);
  const [month, setMonth] = useState(initialYm.month);
  const [selectedDate, setSelectedDate] = useState(() => todayKeyIfInMonth(initialYm.year, initialYm.month));
  const [ymReady, setYmReady] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;

    let nextYear = initialYm.year;
    let nextMonth = initialYm.month;
    let nextDate = null;

    const fromQuery = parseGatheringYm(router.query.ym);
    if (fromQuery) {
      const clamped = clampGatheringYm(fromQuery.year, fromQuery.month);
      nextYear = clamped.year;
      nextMonth = clamped.month;
    }

    const dateInQuery = typeof router.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(router.query.date)
      ? router.query.date
      : null;

    if (dateInQuery) {
      nextDate = dateInQuery;
      const parts = dateInQuery.split('-');
      const clamped = clampGatheringYm(Number(parts[0]), Number(parts[1]));
      nextYear = clamped.year;
      nextMonth = clamped.month;
    } else {
      // Default: anchor selection to today when browsing the current month
      nextDate = todayKeyIfInMonth(nextYear, nextMonth);
    }

    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(nextDate);
    setYmReady(true);

    // Keep URL in sync when landing without an explicit date
    if (!dateInQuery && nextDate) {
      const ym = formatGatheringYm(nextYear, nextMonth);
      router.replace(
        { pathname: '/gatherings', query: { ym, date: nextDate } },
        undefined,
        { shallow: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync from URL query shape
  }, [router.isReady, router.query.ym, router.query.date, initialYm.year, initialYm.month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { from, to } = gatheringMonthRangeIso(year, month);
      const params = new URLSearchParams({
        from,
        to,
        limit: '100',
      });
      const res = await fetch(`/api/gatherings?${params}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '載入失敗');
        setGatherings([]);
        return;
      }
      setGatherings(data.gatherings || []);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, year, month]);

  useEffect(() => {
    if (authLoading || !ymReady) return;
    load();
  }, [authLoading, ymReady, load]);

  function handleMonthChange(next) {
    const clamped = clampGatheringYm(next.year, next.month);
    setYear(clamped.year);
    setMonth(clamped.month);
    const nextDate = todayKeyIfInMonth(clamped.year, clamped.month);
    setSelectedDate(nextDate);
    const ym = formatGatheringYm(clamped.year, clamped.month);
    const query = nextDate ? { ym, date: nextDate } : { ym };
    router.replace(
      { pathname: '/gatherings', query },
      undefined,
      { shallow: true },
    );
  }

  function handleSelectDate(dateKey) {
    setSelectedDate(dateKey);
    const ym = formatGatheringYm(year, month);
    router.replace(
      { pathname: '/gatherings', query: { ym, date: dateKey } },
      undefined,
      { shallow: true },
    );
  }

  return (
    <>
      <SeoHead
        title="月光聚會"
        description="以月曆瀏覽與發起黑貓社群線上／線下聚會。"
        path="/gatherings"
      />
      <GatheringShell maxWidth="880px">
        <header className="gatherings-hero gatherings-hero--compact gatherings-hero--cal">
          <div className="gatherings-hero__copy">
            <p className="gatherings-hero__eyebrow">Moonlight Gatherings</p>
            <h1 className="gatherings-hero__title">
              <span className="gatherings-hero__cal" aria-hidden="true">📅</span>
              {' '}月光聚會
            </h1>
            <p className="gatherings-hero__lead">
              揀日子發起/參加聚會
            </p>
          </div>
          <div className="gatherings-hero__actions">
            <Link
              href={selectedDate ? `/gatherings/new?date=${encodeURIComponent(selectedDate)}` : '/gatherings/new'}
              className="gatherings-hero__cta"
            >
              發起聚會
            </Link>
            <Link href="/gatherings/my" className="gatherings-hero__cta gatherings-hero__cta--ghost">
              我的聚會
            </Link>
          </div>
        </header>

        <GatheringMonthCalendar
          year={year}
          month={month}
          gatherings={gatherings}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          onMonthChange={handleMonthChange}
          loading={loading}
          error={error}
        />

        <GatheringSafetyNotice />
      </GatheringShell>
    </>
  );
}
