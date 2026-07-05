/**
 * Premium inbox user search — find users and send letter / photo exchange.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { MOONLIGHT_PASSPORT_BRAND } from '../lib/premium.js';
import PixelMixedLabel from './PixelMixedLabel.js';
import LetterComposeForm from './LetterComposeForm.js';
import { COMPOSE_HINT_OPEN, COMPOSE_PLACEHOLDER, COMPOSE_TITLE_OPEN, COMPOSE_TITLE_REPLY } from '../lib/inbox-channel.js';
import { INBOX_MESSAGE_MAX_LENGTH } from '../lib/inbox-limits.js';
import { DEFAULT_LETTER_PREFS } from '../lib/letter-gameplay.js';

const LETTER_REASON_LABEL = {
  blocked: '無法聯絡此用戶',
  quota_exhausted: '本月主動投信額度已用完',
  channel_closed: '通道已關閉',
  premium_required: `需要 ${MOONLIGHT_PASSPORT_BRAND}`,
};

const EXCHANGE_REASON_LABEL = {
  blocked: '無法交換',
  quota_exhausted: '本月交換相額度已用完',
  no_exchange_photo: '請先上傳交換用相片',
  pending_outgoing: '已發送邀請',
  pending_incoming: '對方已邀請你',
  active_completed: '交換仍在有效期',
  premium_required: `需要 ${MOONLIGHT_PASSPORT_BRAND}`,
};

function reasonLabel(reason, map) {
  if (!reason) return '';
  return map[reason] || '';
}

export default function InboxUserSearch({ accessToken, onSent }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [composeTarget, setComposeTarget] = useState(null);
  const [letter, setLetter] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [exchangeBusyId, setExchangeBusyId] = useState(null);
  const [exchangeError, setExchangeError] = useState('');
  const [letterPrefs, setLetterPrefs] = useState(DEFAULT_LETTER_PREFS);
  const debounceRef = useRef(null);
  const prefsSaveRef = useRef(null);
  const abortRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (!accessToken || !q.trim()) {
      abortRef.current?.abort();
      setResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setSearchError('');
    try {
      const r = await fetch('/api/inbox/users/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ q: q.trim() }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const data = await r.json().catch(() => ({}));
      if (r.status === 403) {
        setResults([]);
        setSearchError(`需要 ${MOONLIGHT_PASSPORT_BRAND} 才能搜尋用戶。`);
        return;
      }
      if (!r.ok) {
        setResults([]);
        setSearchError(data.error || '搜尋失敗，請稍後再試。');
        return;
      }
      setResults(data.users || []);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setResults([]);
      setSearchError('網路錯誤，請重試。');
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!r.ok || cancelled) return;
        const data = await r.json();
        if (data?.profile?.letter_prefs) {
          setLetterPrefs(data.profile.letter_prefs);
        }
      } catch {
        /* optional */
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  const saveLetterPrefs = useCallback((nextPrefs) => {
    setLetterPrefs(nextPrefs);
    if (prefsSaveRef.current) window.clearTimeout(prefsSaveRef.current);
    if (!accessToken) return;
    prefsSaveRef.current = window.setTimeout(async () => {
      try {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            letter_prefs: {
              stamp_id: nextPrefs.stamp_id,
              note_color: nextPrefs.note_color,
              note_font: nextPrefs.note_font,
              sound_enabled: nextPrefs.sound_enabled,
            },
          }),
        });
      } catch {
        /* non-critical */
      }
    }, 400);
  }, [accessToken]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearchError('');
      return undefined;
    }
    debounceRef.current = window.setTimeout(() => runSearch(query), 180);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  function openCompose(user) {
    if (!user.letter?.can_send) return;
    setComposeTarget(user);
    setLetter('');
    setSendError('');
  }

  function closeCompose() {
    setComposeTarget(null);
    setLetter('');
    setSendError('');
  }

  async function handleSendLetter(e, letterStyle) {
    e?.preventDefault?.();
    if (!composeTarget || !accessToken || sending || !letter.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const r = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient_id: composeTarget.id,
          content: letter.trim(),
          thread_id: composeTarget.letter?.existing_thread_id || null,
          source_type: 'inbox_search',
          letter_style: letterStyle || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSendError(data.error || '發送失敗，請稍後再試。');
        return;
      }
      closeCompose();
      onSent?.();
      if (data.thread_id) {
        router.push(`/inbox/${data.thread_id}`);
      }
    } catch {
      setSendError('網路錯誤，請重試。');
    } finally {
      setSending(false);
    }
  }

  async function handleExchange(user) {
    if (!accessToken || exchangeBusyId) return;
    const threadId = user.exchange?.inbox_thread_id;
    if (user.exchange?.reason === 'pending_outgoing' && threadId) {
      router.push(`/inbox/${threadId}`);
      return;
    }
    if (user.exchange?.reason === 'pending_incoming' && threadId) {
      router.push(`/inbox/${threadId}`);
      return;
    }
    if (!user.exchange?.can_request) return;

    setExchangeBusyId(user.id);
    setExchangeError('');
    try {
      const r = await fetch('/api/photo-exchange/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ recipient_id: user.id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setExchangeError(data.error || '發起交換失敗，請稍後再試。');
        return;
      }
      onSent?.();
      if (data.inbox_thread_id) {
        router.push(`/inbox/${data.inbox_thread_id}`);
      } else {
        await runSearch(query);
      }
    } catch {
      setExchangeError('網路錯誤，請重試。');
    } finally {
      setExchangeBusyId(null);
    }
  }

  function gotoThread(user) {
    const threadId = user.letter?.existing_thread_id || user.exchange?.inbox_thread_id;
    if (threadId) router.push(`/inbox/${threadId}`);
  }

  return (
    <section className="inbox-user-search" aria-label="搜尋用戶">
      <div className="inbox-user-search__head">
        <div className="inbox-user-search__head-text">
          <span className="inbox-user-search__label">搜尋用戶</span>
          <p className="inbox-user-search__desc">輸入顯示名稱，寄信或發起交換相</p>
        </div>
        <span className="inbox-user-search__badge">{MOONLIGHT_PASSPORT_BRAND}</span>
      </div>
      <div className="inbox-user-search__input-wrap">
        <span className="inbox-user-search__search-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" shapeRendering="crispEdges">
            <rect x="6" y="6" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2" y="2" width="2" height="2" fill="currentColor" />
            <rect x="4" y="4" width="2" height="1" fill="currentColor" />
            <rect x="3" y="5" width="1" height="2" fill="currentColor" />
          </svg>
        </span>
        <input
          type="search"
          className="pixel-input inbox-user-search__input"
          placeholder="輸入顯示名稱…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          maxLength={24}
          aria-label="搜尋顯示名稱"
        />
      </div>
      {searching && <p className="inbox-user-search__status pixel-muted">搜尋中…</p>}
      {searchError && <p className="pixel-error inbox-user-search__status">{searchError}</p>}
      {exchangeError && <p className="pixel-error inbox-user-search__status">{exchangeError}</p>}

      {results.length > 0 && (
        <ul className="inbox-user-search__results">
          {results.map((user) => {
            const canLetter = user.letter?.can_send;
            const canExchange = user.exchange?.can_request;
            const letterHint = reasonLabel(user.letter?.reason, LETTER_REASON_LABEL);
            const exchangeHint = reasonLabel(user.exchange?.reason, EXCHANGE_REASON_LABEL);
            const showGoto = !canLetter && user.letter?.existing_thread_id;

            return (
              <li key={user.id} className="inbox-user-search__result">
                <div className="inbox-user-search__result-main">
                  <span className="inbox-user-search__name">
                    <PixelMixedLabel
                      text={user.display_name}
                      zhClass="inbox-user-search__zh"
                      enClass="inbox-user-search__en inbox-user-search__en--name"
                    />
                  </span>
                  {user.mirror_card_slug && (
                    <Link
                      href={`/mirror-card/${encodeURIComponent(user.mirror_card_slug)}`}
                      className="inbox-user-search__mirror-link pixel-link"
                    >
                      Mirror Card
                    </Link>
                  )}
                </div>
                <div className="inbox-user-search__actions">
                  {canLetter ? (
                    <button
                      type="button"
                      className="pixel-btn inbox-user-search__action inbox-user-search__action--letter"
                      onClick={() => openCompose(user)}
                    >
                      寄信
                    </button>
                  ) : showGoto ? (
                    <button
                      type="button"
                      className="pixel-btn inbox-user-search__action inbox-user-search__action--letter"
                      onClick={() => gotoThread(user)}
                    >
                      查看對話
                    </button>
                  ) : letterHint ? (
                    <span className="inbox-user-search__hint">{letterHint}</span>
                  ) : null}
                  {canExchange ? (
                    <button
                      type="button"
                      className="pixel-btn inbox-user-search__action inbox-user-search__action--exchange"
                      disabled={exchangeBusyId === user.id}
                      onClick={() => handleExchange(user)}
                    >
                      {exchangeBusyId === user.id ? '…' : '交換相'}
                    </button>
                  ) : (user.exchange?.reason === 'pending_outgoing' || user.exchange?.reason === 'pending_incoming') ? (
                    <button
                      type="button"
                      className="pixel-btn inbox-user-search__action inbox-user-search__action--exchange"
                      onClick={() => handleExchange(user)}
                    >
                      {user.exchange.reason === 'pending_incoming' ? '回應交換' : '查看邀請'}
                    </button>
                  ) : exchangeHint ? (
                    <span className="inbox-user-search__hint">
                      {user.exchange?.reason === 'no_exchange_photo' ? (
                        <>
                          <Link href="/exchange-photo" className="pixel-link">上傳交換用相片</Link>
                        </>
                      ) : exchangeHint}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {query.trim() && !searching && !searchError && results.length === 0 && (
        <p className="inbox-user-search__status pixel-muted">找不到符合的用戶。</p>
      )}

      {composeTarget && (
        <div className="inbox-user-search__overlay" role="presentation" onClick={closeCompose}>
          <div
            className="inbox-user-search__modal pixel-card pixel-card--moon"
            role="dialog"
            aria-labelledby="inbox-compose-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="inbox-compose-title" className="inbox-user-search__modal-title">
              寄信給 {composeTarget.display_name}
            </p>
            <LetterComposeForm
              mode={composeTarget.letter?.action === 'reply' ? 'reply' : 'open'}
              title={composeTarget.letter?.action === 'reply' ? COMPOSE_TITLE_REPLY : COMPOSE_TITLE_OPEN}
              hint={composeTarget.letter?.action === 'reply' ? null : COMPOSE_HINT_OPEN}
              placeholder={COMPOSE_PLACEHOLDER}
              value={letter}
              onChange={setLetter}
              onSubmit={handleSendLetter}
              sending={sending}
              error={sendError}
              maxLength={INBOX_MESSAGE_MAX_LENGTH}
              letterPrefs={letterPrefs}
              onLetterPrefsChange={saveLetterPrefs}
              showGameplay
              viewerTier="premium"
              compact
              showCancel
              onCancel={closeCompose}
            />
          </div>
        </div>
      )}
    </section>
  );
}
