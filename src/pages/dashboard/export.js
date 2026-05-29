import { useState } from 'react';
import Layout from '../../components/dashboard/Layout';
import styles from '../../styles/dashboard/Export.module.css';
import { dashFetch } from '../../lib/dashboard-fetch.js';

const FORMATS = [
  { value: 'html', icon: '📄', name: 'HTML', desc: '單張配對卡片' },
  { value: 'xlsx', icon: '📊', name: 'XLSX', desc: 'Excel 配對表格' },
  { value: 'zip',  icon: '🗜', name: 'ZIP',  desc: '批量 HTML 壓縮包' },
];

export default function ExportPage() {
  const [userId, setUserId] = useState('all');
  const [threshold, setThreshold] = useState(60);
  const [thresholdMax, setThresholdMax] = useState(100);
  const [format, setFormat] = useState('xlsx');
  const [status, setStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDownload = async () => {
    setStatus('loading');
    setProgress(0);
    setErrorMsg('');

    // Simulate progress while fetching
    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 90));
    }, 200);

    try {
      const params = new URLSearchParams({ format, threshold: String(threshold), thresholdMax: String(thresholdMax) });
      if (userId && userId !== 'all') params.set('userId', userId);
      else params.set('userId', 'all');

      const res = await dashFetch(`/api/dashboard/export?${params}`);
      clearInterval(ticker);
      setProgress(100);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = format === 'xlsx' ? '.xlsx' : format === 'zip' ? '.zip' : '.html';
      const ts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Hong_Kong' }).replace(/[-: ]/g, '').slice(0, 12);
      a.href = url;
      a.download = `match_export_${ts}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (err) {
      clearInterval(ticker);
      setProgress(0);
      setStatus('error');
      setErrorMsg(err.message || '匯出失敗');
    }
  };

  return (
    <Layout pageTitle="匯出下載" breadcrumb="儀表板 / 匯出下載">
      <div className={styles.page}>

        {/* Card: target user */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>匯出對象</div>
          <div className={styles.formGroup}>
            <label className={styles.label}>選擇用戶</label>
            <select
              className={styles.input}
              value={userId === 'all' ? 'all' : 'specific'}
              onChange={(e) => {
                if (e.target.value === 'all') setUserId('all');
                else setUserId('');
              }}
            >
              <option value="all">所有用戶（全體配對）</option>
              <option value="specific">指定用戶 ID</option>
            </select>
          </div>

          {userId !== 'all' && (
            <div className={styles.formGroup}>
              <label className={styles.label}>用戶 ID</label>
              <input
                className={styles.input}
                type="number"
                placeholder="輸入用戶 ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Card: threshold */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>分數範圍</div>
          <div className={styles.formGroup}>
            <label className={styles.label}>最低分數</label>
            <div className={styles.sliderRow}>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                step={5}
                value={threshold}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setThreshold(v);
                  if (v > thresholdMax) setThresholdMax(v);
                }}
              />
              <span className={styles.sliderValue}>{threshold}</span>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>最高分數</label>
            <div className={styles.sliderRow}>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                step={5}
                value={thresholdMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setThresholdMax(v);
                  if (v < threshold) setThreshold(v);
                }}
              />
              <span className={styles.sliderValue}>{thresholdMax}</span>
            </div>
          </div>
        </div>

        {/* Card: format */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>匯出格式</div>
          <div className={styles.formatOptions}>
            {FORMATS.map((f) => (
              <label key={f.value} className={styles.formatOption}>
                <input
                  type="radio"
                  name="format"
                  value={f.value}
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                />
                <div className={styles.formatLabel}>
                  <span className={styles.formatIcon}>{f.icon}</span>
                  <span className={styles.formatName}>{f.name}</span>
                  <span className={styles.formatDesc}>{f.desc}</span>
                </div>
              </label>
            ))}
          </div>

          <button
            className={styles.downloadBtn}
            onClick={handleDownload}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? '⏳ 生成中…' : '⬇ 下載'}
          </button>

          {status === 'loading' && (
            <div className={styles.progressWrap}>
              <div className={styles.progressLabel}>
                <span>處理中…</span>
                <span>{progress}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className={styles.successMsg}>
              ✓ 匯出成功，檔案已下載至你的裝置
            </div>
          )}

          {status === 'error' && (
            <div className={styles.errorMsg}>
              ✕ 匯出失敗：{errorMsg}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
