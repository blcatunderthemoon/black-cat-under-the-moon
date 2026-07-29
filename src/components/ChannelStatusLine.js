import ChannelNarrativeViz from './ChannelNarrativeViz.js';
import { ScrollMixedText } from './PixelScrollMessage.js';
import { stripChannelStatusLead } from '../lib/inbox-channel.js';
import { ForumMoonIcon } from './UiIcons.js';

/**
 * Compact channel / whisper status chip.
 * @param {'channel'|'whisper'} [variant]
 */
export default function ChannelStatusLine({
  text,
  channelOpen = false,
  remaining = null,
  max = null,
  className = '',
  align = 'center',
  variant = 'channel',
}) {
  const body = stripChannelStatusLead(text);
  if (!body && remaining == null) return null;

  const isWhisper = variant === 'whisper';
  const hasQuota = remaining != null && max != null && max > 0;
  const showStructured = hasQuota && (channelOpen || isWhisper);
  const safeRemaining = hasQuota ? Math.max(0, Math.min(max, Number(remaining) || 0)) : 0;
  const low = showStructured && safeRemaining <= 1;

  const aria = isWhisper && hasQuota
    ? `月光低語尚餘 ${safeRemaining} 則，雙方共用最多 ${max} 則`
    : showStructured
      ? `通道尚餘 ${safeRemaining} 次來回，每次開通道最多 ${max} 次`
      : body;

  return (
    <div
      className={[
        'channel-status-line',
        `channel-status-line--${align}`,
        isWhisper ? 'channel-status-line--whisper' : '',
        low ? 'channel-status-line--low' : '',
        className,
      ].filter(Boolean).join(' ')}
      role="status"
      aria-label={aria}
    >
      <div className="channel-status-line__glyphs" aria-hidden="true">
        <span className="channel-status-line__cat">
          <ForumMoonIcon size={isWhisper ? 15 : 14} />
        </span>
        {isWhisper && hasQuota ? (
          <span className="channel-status-line__pips">
            {Array.from({ length: max }, (_, i) => (
              <span
                key={i}
                className={`channel-status-line__pip${i < safeRemaining ? ' is-lit' : ' is-spent'}`}
              />
            ))}
          </span>
        ) : (
          <ChannelNarrativeViz
            remaining={remaining}
            max={max}
            lit={channelOpen}
            inline
            size="chip"
          />
        )}
      </div>
      <div className="channel-status-line__copy">
        {showStructured && isWhisper ? (
          <>
            <span className="channel-status-line__primary">
              月光低語尚餘
              {' '}
              <span className="channel-status-line__num">{safeRemaining}</span>
              {' '}
              則
            </span>
            <span className="channel-status-line__secondary">
              雙方共用最多
              {' '}
              <span className="channel-status-line__num channel-status-line__num--soft">{max}</span>
              {' '}
              則短訊
            </span>
          </>
        ) : showStructured ? (
          <>
            <span className="channel-status-line__primary">
              通道尚餘
              {' '}
              <span className="channel-status-line__num">{safeRemaining}</span>
              {' '}
              次來回
            </span>
            <span className="channel-status-line__secondary">
              每次開通道最多
              {' '}
              {max}
              {' '}
              次
            </span>
          </>
        ) : (
          <span className="channel-status-line__primary channel-status-line__primary--solo">
            <ScrollMixedText text={body} />
          </span>
        )}
      </div>
    </div>
  );
}
