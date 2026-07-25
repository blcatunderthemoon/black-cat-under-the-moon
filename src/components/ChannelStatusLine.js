import ChannelNarrativeViz from './ChannelNarrativeViz.js';
import { ScrollMixedText } from './PixelScrollMessage.js';
import { stripChannelStatusLead } from '../lib/inbox-channel.js';
import { ForumMoonIcon } from './UiIcons.js';

/**
 * Compact channel status chip — cat + candle glyphs, structured copy.
 */
export default function ChannelStatusLine({
  text,
  channelOpen = false,
  remaining = null,
  max = null,
  className = '',
  align = 'center',
}) {
  const body = stripChannelStatusLead(text);
  if (!body) return null;

  const showQuotaCopy = channelOpen && remaining != null && max != null;

  return (
    <div
      className={`channel-status-line channel-status-line--${align}${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={showQuotaCopy
        ? `通道尚餘 ${remaining} 次來回，每次開通道最多 ${max} 次`
        : body}
    >
      <div className="channel-status-line__glyphs" aria-hidden="true">
        <span className="channel-status-line__cat">
          <ForumMoonIcon size={14} />
        </span>
        <ChannelNarrativeViz
          remaining={remaining}
          max={max}
          lit={channelOpen}
          inline
          size="chip"
        />
      </div>
      <div className="channel-status-line__copy">
        {showQuotaCopy ? (
          <>
            <span className="channel-status-line__primary">
              通道尚餘
              {' '}
              <span className="channel-status-line__num">{remaining}</span>
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
