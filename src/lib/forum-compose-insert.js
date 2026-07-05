/**
 * Textarea selection helpers for forum compose toolbar.
 */

/**
 * @param {HTMLTextAreaElement | null} el
 * @param {string} value
 * @param {(next: string) => void} onChange
 * @param {{ before?: string, after?: string, placeholder?: string, block?: boolean }} opts
 */
export function insertAtSelection(el, value, onChange, opts = {}) {
  if (!el) return;
  const { before = '', after = '', placeholder = '', block = false } = opts;
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const selected = value.slice(start, end) || placeholder;
  const glueBefore = block && start > 0 && value[start - 1] !== '\n' ? '\n' : '';
  const glueAfter = block && end < value.length && value[end] !== '\n' ? '\n' : '';
  const insert = `${glueBefore}${before}${selected}${after}${glueAfter}`;
  const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
  const cursor = start + insert.length;
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(cursor, cursor);
  });
}

export const FORUM_POLL_TEMPLATE = `::poll[POLL_ID_PLACEHOLDER]`;
