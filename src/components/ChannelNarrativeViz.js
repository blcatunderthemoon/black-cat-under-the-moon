/**
 * Channel candle — lit while the channel is open, extinguished when closed.
 */
export default function ChannelNarrativeViz({
  remaining = null,
  max = null,
  lit = false,
  inline = false,
  size = 'default',
  className = '',
}) {
  const isChip = size === 'chip';
  const ratio = lit && remaining != null && max != null && max > 0
    ? Math.max(0, Math.min(1, remaining / max))
    : 0;
  const waxHeight = lit
    ? (isChip ? 4 + Math.round(ratio * 8) : 10 + Math.round(ratio * 26))
    : (isChip ? 4 : 8);
  const flameScale = 0.55 + ratio * 0.55;
  const low = lit && remaining != null && remaining <= 2;

  return (
    <span
      className={`channel-narrative-viz${lit ? '' : ' channel-narrative-viz--out'}${low ? ' channel-narrative-viz--low' : ''}${inline ? ' channel-narrative-viz--inline' : ''}${isChip ? ' channel-narrative-viz--chip' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={lit ? '通道蠟燭燃亮中' : '通道蠟燭已熄滅'}
    >
      <span className="channel-narrative-viz__candle" aria-hidden="true">
        {lit && (
          <span
            className="channel-narrative-viz__flame"
            style={{ transform: `scale(${flameScale.toFixed(2)})` }}
          />
        )}
        <span className="channel-narrative-viz__wick" />
        <span className="channel-narrative-viz__wax" style={{ height: `${waxHeight}px` }} />
      </span>
    </span>
  );
}
