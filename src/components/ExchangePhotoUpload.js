/**
 * Upload + save exchange photo to profile.
 */

import { useRef, useState, useEffect } from 'react';
import {
  isCloudinaryProfileUploadConfigured,
  uploadProfileExchangePhoto,
} from '../lib/cloudinary-profile-upload.js';

export default function ExchangePhotoUpload({
  accessToken,
  currentUrl,
  onSaved,
  compact = false,
  layout = 'default',
  saveToProfile = true,
  hideSelectButton = false,
}) {
  const isPage = layout === 'page';
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentUrl || '');

  useEffect(() => {
    setPreview(currentUrl || '');
  }, [currentUrl]);

  const configured = isCloudinaryProfileUploadConfigured();

  async function handleFile(file) {
    if (!file || !accessToken) return;
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadProfileExchangePhoto(file, {
        onProgress: setProgress,
      });
      if (!saveToProfile) {
        setPreview(url);
        onSaved?.(url);
        return;
      }
      const r = await fetch('/api/profile/exchange-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ photo_url: url }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data.error || '儲存相片失敗。');
      }
      setPreview(data.exchange_photo_url || url);
      onSaved?.(data.exchange_photo_url || url);
    } catch (err) {
      setError(err.message || '上傳失敗，請稍後再試。');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  if (!configured) {
    return (
      <p className="photo-exchange-upload__hint pixel-subtitle">
        圖片上傳尚未設定，請稍後再試。
      </p>
    );
  }

  function openPicker() {
    if (!uploading) inputRef.current?.click();
  }

  const previewInner = preview ? (
    <img
      src={preview}
      alt="你的交換用相片"
      className="photo-exchange-upload__preview"
      draggable={false}
    />
  ) : (
    <div className="photo-exchange-upload__placeholder">
      <span className="photo-exchange-upload__placeholder-icon" aria-hidden="true">📷</span>
      {isPage ? (
        <>
          <span className="photo-exchange-upload__placeholder-title">點擊選擇相片</span>
          <span className="photo-exchange-upload__placeholder-sub">或拖放至此</span>
        </>
      ) : (
        <span>尚未上傳</span>
      )}
    </div>
  );

  const progressOverlay = uploading ? (
    <div className="photo-exchange-upload__progress" aria-live="polite">
      上傳中 {progress}%
    </div>
  ) : null;

  return (
    <div
      className={[
        'photo-exchange-upload',
        compact ? 'photo-exchange-upload--compact' : '',
        isPage ? 'photo-exchange-upload--page' : '',
      ].filter(Boolean).join(' ')}
    >
      {isPage ? (
        <button
          type="button"
          className={[
            'photo-exchange-upload__preview-wrap',
            'photo-exchange-upload__dropzone',
            preview ? 'photo-exchange-upload__dropzone--has-photo' : '',
          ].filter(Boolean).join(' ')}
          disabled={uploading}
          onClick={openPicker}
          aria-label={preview ? '更換交換用相片' : '選擇交換用相片'}
        >
          {previewInner}
          {preview && !uploading && (
            <span className="photo-exchange-upload__change-badge">更換相片</span>
          )}
          {progressOverlay}
        </button>
      ) : (
        <div className="photo-exchange-upload__preview-wrap">
          {previewInner}
        </div>
      )}
      <div className="photo-exchange-upload__actions">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="photo-exchange-upload__input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        {!hideSelectButton && (
        <button
          type="button"
          className={`pixel-btn photo-exchange-upload__btn${isPage ? ' pixel-btn--primary' : ' pixel-btn--ghost'}`}
          disabled={uploading}
          onClick={openPicker}
        >
          {uploading ? `上傳中 ${progress}%` : preview ? '更換相片' : '選擇相片'}
        </button>
        )}
        <p className="photo-exchange-upload__hint pixel-subtitle">
          {isPage ? '支援JPG · PNG · WEBP · 最大 5MB' : 'JPG / PNG / WEBP，最大 5MB。交換成功後對方可查看 7 日。'}
        </p>
        {error && <p className="pixel-error photo-exchange-upload__error">{error}</p>}
      </div>
    </div>
  );
}
