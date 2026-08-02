/**
 * /matches — View connection records.
 * Passport: live discovery of ≥60% pairs + deliveries.
 * Free: inbox + sent_matches (notified) only.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context.js';
import AppShell from '../components/AppShell.js';
import AppHeaderAuth from '../components/AppHeaderAuth.js';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import MoonLoading from '../components/MoonLoading.js';
import { HeaderMailIcon, ForumPawIcon } from '../components/UiIcons.js';

function ScoreRing({ score }) {
  const r = 24;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 85 ? '#50fa7b' : score >= 70 ? '#bd93f9' : '#6272a4';
  return (
    <svg width={64} height={64} style={{ flexShrink: 0 }}>
      <circle cx={32} cy={32} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={6} />
      <circle
        cx={32} cy={32} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={32} y={37} textAnchor="middle" fill={color}
        style={{ fontSize: 12, fontFamily: '"Press Start 2P", monospace', fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

function SummaryPanel({ summary }) {
  if (!summary || typeof summary !== 'object' || Object.keys(summary).length === 0) {
    return <p className="pixel-muted" style={{ padding: 0, textAlign: 'left' }}>暫無詳細摘要</p>;
  }
  return (
    <div className="match-summary-grid" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
      {Object.entries(summary).map(([key, val]) => (
        <div key={key} className="match-summary-item">
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {typeof val === 'number' ? `${val}/100` : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function syncMatchCardFrameHeight(frame) {
  if (!frame) return;
  try {
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;
    const height = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.body?.scrollHeight || 0,
      480,
    );
    frame.style.height = `${height}px`;
  } catch {
    /* cross-origin guard */
  }
}

const matchCardHtmlCache = new Map();

function MatchCardDrawer({ open, onClose, partnerResponseId, myResponseId, partnerName, accessToken }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const frameRef = useRef(null);

  const refreshFrameHeight = useCallback(() => {
    syncMatchCardFrameHeight(frameRef.current);
  }, []);

  useEffect(() => {
    if (!open || !partnerResponseId || !accessToken) return undefined;

    let cancelled = false;
    setLoading(true);
    setError('');
    setHtml('');

    const cacheKey = `v2:${myResponseId || 0}:${partnerResponseId}`;
    const cached = matchCardHtmlCache.get(cacheKey);
    if (cached) {
      setHtml(cached);
      setLoading(false);
      return undefined;
    }

    const payload = { partner_response_id: partnerResponseId };
    if (myResponseId) payload.my_response_id = myResponseId;

    fetch('/api/matches/card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = data.error
            || (data.premium_required ? `需要 ${MOONLIGHT_PASSPORT_BRAND} 才能查看共鳴分析卡` : null)
            || (r.status >= 500 ? '伺服器暫時無法產生共鳴分析卡，請稍後再試' : '載入失敗，請稍後再試');
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          const htmlDoc = data.html || '';
          if (htmlDoc) matchCardHtmlCache.set(cacheKey, htmlDoc);
          setHtml(htmlDoc);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '載入失敗，請稍後再試');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, partnerResponseId, myResponseId, accessToken]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.documentElement.classList.add('body-scroll-locked');
    document.body.classList.add('body-scroll-locked');
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('body-scroll-locked');
      document.body.classList.remove('body-scroll-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !html) return undefined;
    refreshFrameHeight();
    const t1 = window.setTimeout(refreshFrameHeight, 80);
    const t2 = window.setTimeout(refreshFrameHeight, 320);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, html, loading, refreshFrameHeight]);

  return (
    <div className={`match-card-drawer${open ? ' active' : ''}`} aria-hidden={!open}>
      <div className="match-card-drawer__backdrop" onClick={onClose} />
      <aside className="match-card-drawer__panel" role="dialog" aria-label="共鳴分析卡">
        <header className="match-card-drawer__header">
          <h2 className="match-card-drawer__title pixel-title" style={{ fontSize: 10, margin: 0 }}>
            {partnerName ? `${partnerName} · 共鳴分析卡` : '共鳴分析卡'}
          </h2>
          <button type="button" className="match-card-drawer__close" onClick={onClose} aria-label="關閉">✕</button>
        </header>
        <div className="match-card-drawer__body">
          {loading && (
            <div className="match-card-drawer__loading">
              <MoonLoading centered={false} />
            </div>
          )}
          {error && !loading && <p className="match-card-drawer__loading match-card-drawer__error">{error}</p>}
          {!loading && !error && html && (
            <iframe
              ref={frameRef}
              className="match-card-drawer__frame"
              title="共鳴分析卡"
              sandbox="allow-scripts allow-same-origin allow-downloads"
              srcDoc={html}
              onLoad={refreshFrameHeight}
            />
          )}
        </div>
      </aside>
    </div>
  );
}

function MatchCard({ match, onOpenCard }) {
  const [expanded, setExpanded] = useState(false);
  const { thread_id, match_score, match_summary, email_notified, partner_response_id, other_user } = match;
  const cardHref = other_user.mirror_card_slug
    ? `/mirror-card/${other_user.mirror_card_slug}`
    : null;

  const scoreLabel = match_score == null ? '—' : `${match_score}%`;

  const nameEl = cardHref ? (
    <Link href={cardHref} className="pixel-link" style={{ fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
      {other_user.display_name}
    </Link>
  ) : (
    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{other_user.display_name}</div>
  );

  return (
    <div className="match-card">
      <div className="match-card__top">
        {match_score != null ? <ScoreRing score={match_score} /> : (
          <div style={{ width: 64, height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>—</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 4 }}>{nameEl}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            同步率 {scoreLabel}
            {' · 電郵通知 '}
            <span style={{ color: email_notified ? '#50fa7b' : 'var(--text-muted)' }}>
              {email_notified ? '已通知' : '—'}
            </span>
          </div>
          <div className="match-card__actions">
            {partner_response_id && (
              <button
                type="button"
                onClick={() => onOpenCard?.(match)}
                className="pixel-btn pixel-btn--ghost"
                style={{ padding: '4px 10px', fontSize: 6 }}
              >
                共鳴分析卡 ▸
              </button>
            )}
            <button type="button" onClick={() => setExpanded((v) => !v)} className="pixel-btn pixel-btn--ghost" style={{ padding: '4px 10px', fontSize: 6 }}>
              {expanded ? '收起摘要 ▴' : '共鳴摘要 ▾'}
            </button>
            {cardHref && (
              <Link href={cardHref} className="pixel-link" style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border-glow)' }}>
                查看鏡像卡 ▸
              </Link>
            )}
            {thread_id && (
              <Link href={`/inbox/${thread_id}`} className="pixel-link" style={{ fontSize: 12, padding: '4px 10px', border: '1px solid rgba(80,250,123,.3)', color: '#50fa7b' }}>
                開啟對話 <span aria-hidden="true"><HeaderMailIcon size={12} /></span>
              </Link>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="match-summary-grid">
          <SummaryPanel summary={match_summary} />
        </div>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [state, setState] = useState('loading');
  const [matches, setMatches] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [drawerMatch, setDrawerMatch] = useState(null);

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login?redirect=/matches');
    }
  }, [session, loading, router]);

  const loadMatches = useCallback(async () => {
    if (!session?.access_token) return;
    setState('loading');
    try {
      const r = await fetch('/api/matches', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!r.ok) { setState('error'); return; }
      const data = await r.json();
      setMatches(data.matches || []);
      setHasSubmitted(!!data.has_submitted);
      setDiscoveryEnabled(!!data.discovery_enabled);
      setState(data.matches?.length ? 'ready' : 'empty');
    } catch {
      setState('error');
    }
  }, [session?.access_token]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  if (loading || !session) return null;

  return (
    <>
      <Head>
        <title>我的連線 — Black Cat Under The Moon</title>
        <meta name="description" content="查看你的心靈契合度連線與靈魂共鳴分析。" />
      </Head>
      <AppShell
        title="我的連線"
        maxWidth="680px"
        headerVariant="account"
        backHref="/index.html"
        nav={
          <>
            <AppHeaderAuth redirectPath="/matches" />
            <button
              type="button"
              className="app-header__action"
              onClick={loadMatches}
              disabled={state === 'loading'}
              style={{ marginLeft: 4 }}
            >
              {state === 'loading' ? '…' : '刷新'}
            </button>
          </>
        }
      >
        {state === 'loading' && <MoonLoading variant="hero" />}

        {state === 'error' && (
          <div className="pixel-empty">
            <p className="pixel-subtitle">載入失敗，請稍後再試。</p>
            <button type="button" onClick={loadMatches} className="pixel-btn pixel-btn--ghost">重試</button>
          </div>
        )}

        {state === 'empty' && (
          <div className="pixel-empty">
            <p style={{ fontSize: 32, margin: 0 }} aria-hidden="true"><ForumPawIcon size={32} /></p>
            <p className="pixel-title" style={{ fontSize: 10 }}>
              {hasSubmitted ? '暫無連線記錄' : '連線尚未開始'}
            </p>
            <p className="pixel-subtitle" style={{ lineHeight: 1.7 }}>
              {hasSubmitted ? (
                discoveryEnabled ? (
                  <>
                    黑貓已記錄你的問卷；所有 ≥60% 同步率連線會顯示於此<br />
                    電郵通知欄會標示是否已寄出連線通知
                  </>
                ) : (
                  <>
                    已電郵／Inbox 通知嘅連線會顯示於此<br />
                    即時掃描全部 ≥60% 連線需要{' '}
                    <Link href="/premium" className="pixel-link">{MOONLIGHT_PASSPORT_BRAND}</Link>
                  </>
                )
              ) : (
                <>
                  填寫 Echo Mode 問卷後，黑貓會為你分析心靈契合度<br />
                  連線成功後會出現在這裡
                </>
              )}
            </p>
            {!hasSubmitted && (
              <a href="/echo.html" className="pixel-btn pixel-btn--ghost">前往 Echo Mode 問卷 ▸</a>
            )}
          </div>
        )}

        {state === 'ready' && (
          <>
            <p className="pixel-subtitle" style={{ fontSize: 13, marginBottom: 0 }}>
              找到 {matches.length} 個連線
            </p>
            {!discoveryEnabled && (
              <p className="pixel-subtitle" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 4 }}>
                目前只顯示已通知／已投送嘅連線。
                <Link href="/premium" className="pixel-link"> {MOONLIGHT_PASSPORT_BRAND}</Link>
                {' '}可即時查看所有 ≥60% 同步率連線。
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matches.map((m, i) => (
                <MatchCard
                  key={m.thread_id || `${m.other_user?.display_name}-${i}`}
                  match={m}
                  onOpenCard={setDrawerMatch}
                />
              ))}
            </div>
          </>
        )}
      </AppShell>
      <MatchCardDrawer
        open={!!drawerMatch}
        onClose={() => setDrawerMatch(null)}
        partnerResponseId={drawerMatch?.partner_response_id}
        myResponseId={drawerMatch?.my_response_id}
        partnerName={drawerMatch?.other_user?.display_name}
        accessToken={session?.access_token}
      />
    </>
  );
}
