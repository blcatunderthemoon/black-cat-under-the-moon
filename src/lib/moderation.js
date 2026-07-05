/**
 * UGC moderation thresholds shared across report APIs.
 */

export const REPORT_AUTO_HIDE_THRESHOLD = 5;

export function shouldAutoHide(reportCount) {
  return (reportCount || 0) >= REPORT_AUTO_HIDE_THRESHOLD;
}
