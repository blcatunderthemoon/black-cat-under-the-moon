/**
 * /gatherings/my — my hosted + joined gatherings
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import GatheringShell from '../../components/gatherings/GatheringShell.js';
import GatheringCard from '../../components/gatherings/GatheringCard.js';
import MoonLoading from '../../components/MoonLoading.js';
import LoadingText from '../../components/LoadingText.js';
import { ForumMoonIcon } from '../../components/UiIcons.js';
import { useAuth } from '../../lib/auth-context.js';

export default function GatheringsMyPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [hosted, setHosted] = useState([]);
  const [joined, setJoined] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!session) router.replace('/login?redirect=/gatherings/my');
  }, [authLoading, session, router]);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [hostRes, joinedRes] = await Promise.all([
        fetch('/api/gatherings?host=me', { headers }),
        fetch('/api/gatherings?joined=me', { headers }),
      ]);
      const hostData = await hostRes.json().catch(() => ({}));
      const joinedData = await joinedRes.json().catch(() => ({}));
      if (!hostRes.ok) {
        setError(hostData.error || '載入失敗');
        return;
      }
      if (!joinedRes.ok) {
        setError(joinedData.error || '載入失敗');
        return;
      }
      setHosted(hostData.gatherings || []);
      setJoined(joinedData.gatherings || []);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session) return;
    load();
  }, [session, load]);

  if (authLoading || !session) {
    return (
      <GatheringShell title="我的聚會" redirectPath="/gatherings/my">
        <MoonLoading variant="hero" />
      </GatheringShell>
    );
  }

  return (
    <>
      <SeoHead title="我的聚會" path="/gatherings/my" noindex />
      <GatheringShell title="我的聚會" redirectPath="/gatherings/my">
        <header className="gatherings-hero gatherings-hero--compact">
          <div className="gatherings-hero__copy">
            <h1 className="gatherings-hero__title">我的聚會</h1>
          </div>
          <nav className="gathering-tabs" aria-label="聚會檢視">
            <Link href="/gatherings" className="gathering-tab">
              所有聚會
            </Link>
            <Link href="/gatherings/my" className="gathering-tab is-active" aria-current="page">
              我的聚會
            </Link>
          </nav>
        </header>

        {error && <p className="gatherings-empty gatherings-empty--err">{error}</p>}

        <h2 className="gatherings-section-title">我發起的</h2>
        {loading ? (
          <LoadingText />
        ) : hosted.length === 0 ? (
          <p className="gatherings-empty">你仲未發起過聚會。</p>
        ) : (
          <div className="gatherings-list">
            {hosted.map((g) => <GatheringCard key={g.id} gathering={g} />)}
          </div>
        )}

        <h2 className="gatherings-section-title">我參加的</h2>
        {loading ? (
          <LoadingText />
        ) : joined.length === 0 ? (
          <p className="gatherings-empty">暫時冇報名中的聚會。</p>
        ) : (
          <div className="gatherings-list">
            {joined.map((g) => <GatheringCard key={g.id} gathering={g} />)}
          </div>
        )}

        <Link href="/gatherings/new" className="gathering-fab" aria-label="發起聚會">
          <span className="gathering-fab__icon" aria-hidden="true">
            <ForumMoonIcon size={18} />
          </span>
          <span className="gathering-fab__text">發起聚會</span>
        </Link>
      </GatheringShell>
    </>
  );
}
