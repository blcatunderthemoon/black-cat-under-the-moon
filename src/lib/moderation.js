/**
 * UGC moderation thresholds shared across report APIs.
 */

export const REPORT_MODERATOR_NOTIFY_THRESHOLD = 3;
export const REPORT_AUTO_HIDE_THRESHOLD = 5;

export function shouldNotifyModerators(reportCount) {
  return (reportCount || 0) >= REPORT_MODERATOR_NOTIFY_THRESHOLD;
}

export function shouldAutoHide(reportCount) {
  return (reportCount || 0) >= REPORT_AUTO_HIDE_THRESHOLD;
}
