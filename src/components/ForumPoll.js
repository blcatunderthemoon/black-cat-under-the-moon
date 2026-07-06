import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MoonLoading from './MoonLoading.js';

function percent(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

export default function ForumPoll({
  poll,
  legacy = false,
  preview = false,
  loggedIn = false,
  accessToken,
  onVote,
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    poll?.viewer_option_index ?? null,
  );
  const [counts, setCounts] = useState(poll?.counts || []);
  const [totalVotes, setTotalVotes] = useState(poll?.total_votes || 0);
  const [hasVoted, setHasVoted] = useState(!!poll?.has_voted);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelected(poll?.viewer_option_index ?? null);
    setCounts(poll?.counts || []);
    setTotalVotes(poll?.total_votes || 0);
    setHasVoted(!!poll?.has_voted);
  }, [poll]);

  if (!poll?.options?.length) {
    return (
      <div className="forum-poll forum-poll--missing">
        <p className="forum-poll__title">📊 投票</p>
        <MoonLoading label="投票資料載入中…" centered={false} size={24} />
      </div>
    );
  }

  const showResults = hasVoted && !legacy && !preview;
  const title = poll.title || '投票';

  async function submitVote() {
    if (legacy || preview) return;
    if (selected === null || selected === undefined) {
      setError('請先選擇一個選項。');
      return;
    }
    if (!loggedIn || !accessToken) {
      router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (voting) return;

    setVoting(true);
    setError('');
    try {
      const r = await fetch(`/api/forum/polls/${encodeURIComponent(poll.id)}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ option_index: selected }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || '投票失敗，請稍後再試。');
        return;
      }
      setHasVoted(true);
      if (Array.isArray(data.counts)) {
        setCounts(data.counts);
        setTotalVotes(data.total_votes ?? data.counts.reduce((s, n) => s + n, 0));
      }
      onVote?.({
        ...poll,
        counts: data.counts || counts,
        total_votes: data.total_votes ?? totalVotes,
        viewer_option_index: data.viewer_option_index ?? selected,
        has_voted: true,
      });
    } catch {
      setError('網路錯誤，請重試。');
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className={`forum-poll${legacy ? ' forum-poll--legacy' : ''}${showResults ? ' forum-poll--results' : ''}`}>
      <div className="forum-poll__head">
        <span className="forum-poll__icon" aria-hidden="true">📊</span>
        <h3 className="forum-poll__title">{title}</h3>
      </div>

      <ul className="forum-poll__options" role={showResults ? 'list' : 'radiogroup'} aria-label={title}>
        {poll.options.map((label, index) => {
          const count = counts[index] || 0;
          const pct = percent(count, totalVotes);
          const isSelected = selected === index;
          const isViewerChoice = hasVoted && (selected === index || poll.viewer_option_index === index);

          if (showResults) {
            return (
              <li
                key={`${poll.id}-opt-${index}`}
                className={`forum-poll__result${isViewerChoice || (hasVoted && isSelected) ? ' forum-poll__result--mine' : ''}`}
              >
                <div className="forum-poll__result-top">
                  <span className="forum-poll__result-label">{label}</span>
                  <span className="forum-poll__result-meta">
                    {legacy ? '' : `${pct}% · `}
                    {!legacy && <span>{count} 票</span>}
                  </span>
                </div>
                {!legacy && (
                  <div className="forum-poll__bar" aria-hidden="true">
                    <span className="forum-poll__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          }

          return (
            <li key={`${poll.id}-opt-${index}`} className="forum-poll__option-item">
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`forum-poll__option${isSelected ? ' forum-poll__option--selected' : ''}`}
                onClick={() => {
                  setSelected(index);
                  setError('');
                }}
                disabled={legacy || preview || voting}
              >
                <span className="forum-poll__radio" aria-hidden="true" />
                <span className="forum-poll__option-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {legacy && (
        <p className="forum-poll__hint">此為舊版投票範本，僅供預覽，無法計票。請重新插入投票以啟用互動功能。</p>
      )}

      {preview && !legacy && (
        <p className="forum-poll__hint">預覽模式 — 發文後其他貓友即可投票。</p>
      )}

      {!legacy && !preview && !showResults && (
        <div className="forum-poll__actions">
          <button
            type="button"
            className="pixel-btn forum-poll__submit"
            onClick={submitVote}
            disabled={voting || selected === null}
          >
            {voting ? '提交中…' : '投票'}
          </button>
          {!loggedIn && (
            <p className="forum-poll__hint">
              <button
                type="button"
                className="pixel-link forum-poll__login-link"
                onClick={() => router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`)}
              >
                登入
              </button>
              {' '}後即可投票
            </p>
          )}
        </div>
      )}

      {!legacy && !preview && showResults && totalVotes > 0 && (
        <p className="forum-poll__footer">共 {totalVotes} 人投票</p>
      )}

      {!legacy && !preview && showResults && totalVotes === 0 && (
        <p className="forum-poll__footer">尚無投票</p>
      )}

      {error && <p className="forum-poll__error" role="alert">{error}</p>}
    </div>
  );
}
