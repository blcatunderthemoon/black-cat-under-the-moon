/** Unified loading copy — trailing "..." animates via `.loading-dots` (mirror card style). */
export const LOADING_LABEL = '載入中...';

export function splitLoadingLabel(label) {
  if (!label) return { text: '', dots: false };
  const match = String(label).match(/^(.*?)(…|\.{3})$/);
  if (match) return { text: match[1], dots: true };
  return { text: label, dots: false };
}
