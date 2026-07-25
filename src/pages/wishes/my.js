/**
 * /wishes/my — my moonlight wishes
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import WishShell from '../../components/wishes/WishShell.js';
import WishCard from '../../components/wishes/WishCard.js';
import { useAuth } from '../../lib/auth-context.js';

export default function MyWishesPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const didRedirect = useRef(false);
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || session || didRedirect.current) return;
    didRedirect.current = true;
    router.replace('/login?redirect=/wishes/my');
  }, [authLoading, session, router]);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/me/wishes', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '載入失敗');
        setWishes([]);
        return;
      }
      setWishes(data.wishes || []);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (authLoading || !session) return;
    load();
  }, [authLoading, session, load]);

  if (authLoading || !session) {
    return (
      <WishShell title="我的心願" redirectPath="/wishes/my">
        <p className="wishes-status">載入中…</p>
      </WishShell>
    );
  }

  return (
    <>
      <SeoHead title="我的心願" path="/wishes/my" noindex />
      <WishShell title="我的心願" redirectPath="/wishes/my" backHref="/wishes" backLabel="心願牆" maxWidth="1080px">
        <header className="wishes-hero">
          <h1 className="wishes-hero__title">我的心願</h1>
          <p className="wishes-hero__lead">進行中、已完成、已放棄都會留喺呢度（隱藏嘅只有你睇到）。</p>
        </header>

        <div className="wishes-toolbar wishes-toolbar--mine">
          <div className="wishes-toolbar__aside">
            <Link href="/wishes/new" className="wishes-btn wishes-btn--primary wishes-btn--create">
              + 設立新心願
            </Link>
            <Link href="/wishes" className="wishes-btn wishes-btn--ghost">
              ← 心願牆
            </Link>
          </div>
        </div>

        {loading && <p className="wishes-status">載入中…</p>}
        {!loading && error && <p className="wishes-error">{error}</p>}
        {!loading && !error && wishes.length === 0 && (
          <p className="wishes-empty">你尚未設立心願。</p>
        )}
        {!loading && !error && wishes.length > 0 && (
          <div className="wishes-grid">
            {wishes.map((wish) => (
              <WishCard
                key={wish.id}
                wish={wish}
                accessToken={session.access_token}
                viewerId={session.user?.id}
              />
            ))}
          </div>
        )}
      </WishShell>
    </>
  );
}
