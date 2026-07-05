import { useEffect, useState } from 'react';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Format remaining view time for completed photo exchanges. */
export function formatExchangeExpiryCountdown(expiresAt) {
  if (!expiresAt) return { label: '', expired: true };
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: '雙方相片查看期限已結束', expired: true };

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return {
      label: `雙方相片尚可查看 ${days} 日 ${hours} 時 ${pad2(minutes)} 分`,
      expired: false,
    };
  }
  if (hours > 0) {
    return {
      label: `雙方相片尚可查看 ${hours} 時 ${pad2(minutes)} 分 ${pad2(seconds)} 秒`,
      expired: false,
    };
  }
  return {
    label: `雙方相片尚可查看 ${minutes} 分 ${pad2(seconds)} 秒`,
    expired: false,
  };
}

function countdownTickInterval(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  if (ms > 24 * 60 * 60 * 1000) return 60_000;
  return 1000;
}

export function useExchangeExpiryCountdown(expiresAt) {
  const [snapshot, setSnapshot] = useState(() => formatExchangeExpiryCountdown(expiresAt));

  useEffect(() => {
    if (!expiresAt) {
      setSnapshot({ label: '', expired: true });
      return undefined;
    }

    const tick = () => setSnapshot(formatExchangeExpiryCountdown(expiresAt));
    tick();

    let timer = null;
    const schedule = () => {
      const interval = countdownTickInterval(expiresAt);
      if (!interval) {
        tick();
        return;
      }
      timer = window.setTimeout(() => {
        tick();
        schedule();
      }, interval);
    };
    schedule();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [expiresAt]);

  return snapshot;
}
