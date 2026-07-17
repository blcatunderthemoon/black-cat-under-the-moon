/**
 * /gatherings/new — create gathering
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import GatheringShell from '../../components/gatherings/GatheringShell.js';
import GatheringCreateForm from '../../components/gatherings/GatheringCreateForm.js';
import MoonLoading from '../../components/MoonLoading.js';
import { useAuth } from '../../lib/auth-context.js';

function formatChosenDate(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  return `${y}年${m}月${d}日`;
}

export default function GatheringsNewPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [meta, setMeta] = useState(null);

  const chosenDateKey = typeof router.query.date === 'string' ? router.query.date : '';
  const [liveDateKey, setLiveDateKey] = useState('');
  const handleDateChange = useCallback((key) => setLiveDateKey(key || ''), []);
  const effectiveDateKey = liveDateKey || chosenDateKey;
  const chosenDateLabel = useMemo(
    () => (router.isReady ? formatChosenDate(effectiveDateKey) : null),
    [router.isReady, effectiveDateKey],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      router.replace('/login?redirect=/gatherings/new');
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    fetch('/api/gatherings/meta')
      .then((r) => r.json())
      .then((data) => setMeta(data))
      .catch(() => setMeta({ tags: [], families: [], gates: {} }));
  }, []);

  if (authLoading || !session) {
    return (
      <GatheringShell title="發起聚會" redirectPath="/gatherings/new" maxWidth="640px">
        <MoonLoading variant="hero" />
      </GatheringShell>
    );
  }

  const calendarHref = effectiveDateKey && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDateKey)
    ? `/gatherings?date=${encodeURIComponent(effectiveDateKey)}`
    : '/gatherings';

  return (
    <>
      <SeoHead title="發起聚會" description="發起一場月光聚會。" path="/gatherings/new" noindex />
      <GatheringShell title="發起聚會" redirectPath="/gatherings/new" maxWidth="640px">
        <header className="gatherings-hero gatherings-hero--create">
          <p className="gatherings-hero__eyebrow">發起聚會</p>
          {chosenDateLabel && (
            <p className="gatherings-hero__chosen-date">
              <span className="gatherings-hero__chosen-date-icon" aria-hidden="true">📅</span>
              <span className="gatherings-hero__chosen-date-label">選定日期</span>
              <strong>{chosenDateLabel}</strong>
            </p>
          )}
          <p className="gatherings-hero__lead gatherings-hero__lead--create">
            公開只顯示區域；詳細地址／連結只會畀批准嘅參加者睇。
          </p>
          <Link href={calendarHref} className="gatherings-hero__back">← 返回月曆</Link>
        </header>
        <GatheringCreateForm meta={meta} onDateChange={handleDateChange} />
      </GatheringShell>
    </>
  );
}
