/**
 * /wishes — Moonlight Wishes wall
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SeoHead from '../../components/SeoHead.js';
import WishShell from '../../components/wishes/WishShell.js';
import WishCard from '../../components/wishes/WishCard.js';
import { ForumMoonIcon } from '../../components/ForumIcons.js';
import { UiFlagIcon } from '../../components/UiIcons.js';
import { useAuth } from '../../lib/auth-context.js';
import { WISH_CATEGORIES } from '../../lib/wishes.js';

const SORTS = [
  { id: 'newest', label: '最新' },
  { id: 'cheers', label: '最多打氣' },
  { id: 'ending', label: '即將到期' },
];

export default function WishesIndexPage() {
  const { session, loading: authLoading } = useAuth();
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const viewerId = session?.user?.id || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ status: 'active', sort, limit: '60' });
      if (category) params.set('category', category);
      const res = await fetch(`/api/wishes?${params}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
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
      setWishes([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, category, sort]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  function handleCheered(id, nextWish) {
    setWishes((prev) => prev.map((w) => (w.id === id ? { ...w, ...nextWish } : w)));
  }

  return (
    <>
      <SeoHead
        title="月光心願"
        description="公開設立近期想完成的小事，互相打氣，慢慢同行。"
        path="/wishes"
      />
      <WishShell title="月光心願" hideHeaderTitle redirectPath="/wishes" maxWidth="1080px">
        <header className="wishes-hero">
          <h1 className="wishes-hero__title">
            <span className="wishes-hero__title-icon" aria-hidden="true"><UiFlagIcon size={32} /></span>
            月光心願
          </h1>
          <p className="wishes-hero__lead">
            設立一個近期想完成的小事或心事，讓同路人為你打氣——唔係強制打卡，係一齊慢慢變好。
          </p>
        </header>

        <div className="wishes-toolbar">
          <div className="wishes-toolbar__row">
            <div className="wishes-toolbar__filters" role="tablist" aria-label="心願分類">
              <button
                type="button"
                className={`wishes-chip${!category ? ' is-active' : ''}`}
                onClick={() => setCategory('')}
              >
                全部
              </button>
              {WISH_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`wishes-chip wishes-chip--cat${category === c ? ' is-active' : ''}`}
                  data-cat={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="wishes-toolbar__aside">
              <label className="wishes-sort">
                <span className="wishes-sort__label">排序</span>
                <select
                  className="wishes-sort__select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="排序方式"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              {session && (
                <Link href="/wishes/my" className="wishes-btn wishes-btn--mine">
                  <span className="wishes-btn--mine__ico" aria-hidden="true">
                    <ForumMoonIcon size={14} />
                  </span>
                  我的心願
                </Link>
              )}
              <Link href="/wishes/new" className="wishes-btn wishes-btn--primary wishes-btn--create wishes-btn--create-inline">
                + 許下心願
              </Link>
            </div>
          </div>
        </div>

        {loading && <p className="wishes-status">載入中…</p>}
        {!loading && error && <p className="wishes-error">{error}</p>}
        {!loading && !error && wishes.length === 0 && (
          <div className="wishes-empty">
            <span className="wishes-empty__icon" aria-hidden="true">
              <ForumMoonIcon size={36} />
            </span>
            <p className="wishes-empty__title">暫時未有公開心願</p>
            <p className="wishes-empty__hint">慢一點都唔緊要——做第一個許願嘅人？</p>
            <Link href="/wishes/new" className="wishes-btn wishes-btn--primary">
              成為第一個許願的人
            </Link>
          </div>
        )}
        {!loading && !error && wishes.length > 0 && (
          <div className="wishes-grid">
            {wishes.map((wish) => (
              <WishCard
                key={wish.id}
                wish={wish}
                accessToken={session?.access_token}
                viewerId={viewerId}
                onCheered={handleCheered}
              />
            ))}
          </div>
        )}

        <Link href="/wishes/new" className="wish-fab" aria-label="許下心願">
          <span className="wish-fab__icon" aria-hidden="true">+</span>
          <span className="wish-fab__text">許下心願</span>
        </Link>
      </WishShell>
    </>
  );
}
