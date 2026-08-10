/**
 * Admin editor for Moonlight Gathering #001 calendar card
 * (capacity, remaining seats, title, location, host, schedule copy).
 */

import { useCallback, useEffect, useState } from 'react';
import styles from '../../styles/dashboard/MoonlightInterest.module.css';

const EMPTY = {
  title: '',
  capacity: 12,
  seats_left: 7,
  approved_count: 4,
  time_range_hk: '',
  location_public: '',
  host_name: '',
  starts_at_hk: '',
};

/**
 * @param {{ apiFetch: (url: string, options?: RequestInit) => Promise<Response> }} props
 */
export default function MoonlightGathering001Editor({ apiFetch }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    if (!apiFetch) return;
    setLoading(true);
    setError('');
    setOkMsg('');
    try {
      const res = await apiFetch('/api/dashboard/moonlight-gathering-001');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '載入失敗');
        return;
      }
      const cfg = data.config || {};
      const capacity = Number(cfg.capacity) || 12;
      const seatsLeft = Number(cfg.seats_left) ?? 7;
      setForm({
        title: cfg.title || '',
        capacity,
        seats_left: seatsLeft,
        approved_count: Math.max(0, capacity - seatsLeft),
        time_range_hk: cfg.time_range_hk || '',
        location_public: cfg.location_public || '',
        host_name: cfg.host_name || '',
        starts_at_hk: cfg.starts_at_hk || '',
      });
      setPreview(data.card || null);
    } catch {
      setError('網絡錯誤');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'capacity' || key === 'approved_count') {
        const cap = key === 'capacity' ? Number(value) : Number(next.capacity);
        const approved = key === 'approved_count' ? Number(value) : Number(next.approved_count);
        if (Number.isFinite(cap) && Number.isFinite(approved)) {
          next.capacity = Math.max(1, Math.round(cap));
          next.approved_count = Math.max(0, Math.min(next.capacity, Math.round(approved)));
          next.seats_left = Math.max(0, next.capacity - next.approved_count);
        }
      }
      if (key === 'seats_left') {
        const cap = Number(next.capacity) || 0;
        const left = Math.max(0, Math.min(cap, Math.round(Number(value) || 0)));
        next.seats_left = left;
        next.approved_count = Math.max(0, cap - left);
      }
      return next;
    });
    setOkMsg('');
  }

  async function onSave(e) {
    e.preventDefault();
    if (!apiFetch || saving) return;
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const res = await apiFetch('/api/dashboard/moonlight-gathering-001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          capacity: Number(form.capacity),
          seats_left: Number(form.seats_left),
          time_range_hk: form.time_range_hk,
          location_public: form.location_public,
          host_name: form.host_name,
          starts_at_hk: form.starts_at_hk,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '儲存失敗');
        return;
      }
      setOkMsg('已更新聚會資料（月曆／Forum 會用新數字）');
      setPreview(data.card || null);
      const cfg = data.config || {};
      const capacity = Number(cfg.capacity) || form.capacity;
      const seatsLeft = Number(cfg.seats_left) ?? form.seats_left;
      setForm((prev) => ({
        ...prev,
        ...cfg,
        capacity,
        seats_left: seatsLeft,
        approved_count: Math.max(0, capacity - seatsLeft),
      }));
    } catch {
      setError('網絡錯誤');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className={styles.editorCard} aria-busy="true">
        <h2 className={styles.editorTitle}>聚會資料 · #001</h2>
        <p className={styles.editorHint}>載入中…</p>
      </section>
    );
  }

  return (
    <section className={styles.editorCard}>
      <header className={styles.editorHeader}>
        <div>
          <h2 className={styles.editorTitle}>聚會資料 · #001</h2>
          <p className={styles.editorHint}>
            改名額／剩餘座位／文案後會即時反映喺月光聚會月曆同 Forum「仲有 N 個位」。
            Thank you 確認信寄出／建草稿／標記已寄出後，出席人數會跟參加表已寄名單自動更新。
            首次使用請喺 Supabase 執行 <code>scripts/sql/ops-settings.sql</code>。
          </p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={load} disabled={saving}>
          重新載入
        </button>
      </header>

      {error ? <p className={styles.editorError} role="alert">{error}</p> : null}
      {okMsg ? <p className={styles.editorOk} role="status">{okMsg}</p> : null}

      {preview ? (
        <p className={styles.editorPreview}>
          預覽：<strong>{preview.approved_count}/{preview.max_participants}</strong>
          {' · '}
          {preview.status === 'open' ? `仲有 ${preview.seats_left} 個位` : preview.status}
          {' · '}
          {preview.tag_labels?.join(' / ')}
        </p>
      ) : null}

      <form className={styles.editorForm} onSubmit={onSave}>
        <label className={styles.editorField}>
          <span>標題</span>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            maxLength={80}
            required
          />
        </label>

        <div className={styles.editorRow}>
          <label className={styles.editorField}>
            <span>名額上限</span>
            <input
              type="number"
              min={1}
              max={100}
              value={form.capacity}
              onChange={(e) => updateField('capacity', e.target.value)}
              required
            />
          </label>
          <label className={styles.editorField}>
            <span>已確認人數</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.approved_count}
              onChange={(e) => updateField('approved_count', e.target.value)}
              required
            />
          </label>
          <label className={styles.editorField}>
            <span>剩餘座位</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.seats_left}
              onChange={(e) => updateField('seats_left', e.target.value)}
              required
            />
          </label>
        </div>

        <label className={styles.editorField}>
          <span>時間顯示（月曆）</span>
          <input
            type="text"
            value={form.time_range_hk}
            onChange={(e) => updateField('time_range_hk', e.target.value)}
            placeholder="19/09/2026 (週六) 14:00–17:00"
            maxLength={80}
          />
        </label>

        <label className={styles.editorField}>
          <span>開始時間短標</span>
          <input
            type="text"
            value={form.starts_at_hk}
            onChange={(e) => updateField('starts_at_hk', e.target.value)}
            placeholder="19/09/2026 (週六) 14:00"
            maxLength={60}
          />
        </label>

        <label className={styles.editorField}>
          <span>地點／形式說明</span>
          <input
            type="text"
            value={form.location_public}
            onChange={(e) => updateField('location_public', e.target.value)}
            maxLength={120}
          />
        </label>

        <label className={styles.editorField}>
          <span>主辦顯示名</span>
          <input
            type="text"
            value={form.host_name}
            onChange={(e) => updateField('host_name', e.target.value)}
            maxLength={80}
          />
        </label>

        <div className={styles.editorActions}>
          <button type="submit" className={styles.editorSave} disabled={saving}>
            {saving ? '儲存中…' : '儲存聚會資料'}
          </button>
        </div>
      </form>
    </section>
  );
}
