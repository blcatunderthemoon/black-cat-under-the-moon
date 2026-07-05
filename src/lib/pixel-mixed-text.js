const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff·\u2014\u2013]/u;

/** Punctuation / digits that should share the Chinese font run for baseline balance. */
const ATTACH_TO_ZH_RE = /^[\s!！?？.,，。:：;；…~～'""''「」【】（）()\-—―0-9]+$/u;

function shouldAttachToZh(part) {
  return !part.zh && ATTACH_TO_ZH_RE.test(part.text);
}

function mergeAttachedParts(parts) {
  if (!parts.length) return parts;

  const merged = [];
  for (const part of parts) {
    if (shouldAttachToZh(part) && merged.length > 0 && merged[merged.length - 1].zh) {
      const prev = merged[merged.length - 1];
      merged[merged.length - 1] = { text: prev.text + part.text, zh: true };
    } else {
      merged.push({ ...part });
    }
  }

  if (merged.length >= 2 && shouldAttachToZh(merged[0]) && merged[1].zh) {
    merged[1] = { text: merged[0].text + merged[1].text, zh: true };
    merged.shift();
  }

  return merged;
}

/** Split UI copy into Chinese vs Latin runs for mixed pixel typography. */
export function splitPixelMixedText(text) {
  if (text == null || text === '') return [];

  const parts = String(text)
    .split(/([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff·\u2014\u2013]+)/u)
    .filter(Boolean)
    .map((part) => ({ text: part, zh: CJK_RE.test(part) }));

  return mergeAttachedParts(parts);
}
