import { useEffect, useRef, useState } from 'react';
import {
  isCloudinaryForumUploadConfigured,
  optimizeForumDisplayUrl,
  uploadForumImage,
} from '../lib/cloudinary-forum-upload.js';

export default function ForumStoryCoverEdit({
  postId,
  coverUrl,
  accessToken,
  onUpdated,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const blobUrlRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingCoverUrl, setPendingCoverUrl] = useState(null);
  const [imgError, setImgError] = useState(false);
  const canUpload = isCloudinaryForumUploadConfigured();
  const locked = disabled || uploading || !canUpload;

  const displayCover = pendingCoverUrl !== null ? pendingCoverUrl : coverUrl;
  const showCoverImage = !!displayCover && !imgError;

  useEffect(() => {
    if (pendingCoverUrl !== null && coverUrl === pendingCoverUrl) {
      setPendingCoverUrl(null);
    }
  }, [coverUrl, pendingCoverUrl]);

  useEffect(() => () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    setImgError(false);
  }, [displayCover]);

  function clearBlobPreview() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }

  async function saveCover(url) {
    const res = await fetch(`/api/forum/posts/${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ cover_image_url: url || null }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.error || '更新封面失敗。');
    }
    onUpdated?.(payload.post);
  }

  async function uploadFile(file) {
    if (!file || locked) return;
    setError('');
    clearBlobPreview();
    const blobUrl = URL.createObjectURL(file);
    blobUrlRef.current = blobUrl;
    setPendingCoverUrl(blobUrl);
    setUploading(true);
    try {
      const url = await uploadForumImage(file);
      clearBlobPreview();
      setPendingCoverUrl(url);
      await saveCover(url);
    } catch (err) {
      clearBlobPreview();
      setPendingCoverUrl(null);
      setError(err?.message || '封面上傳失敗');
    } finally {
      setUploading(false);
    }
  }
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    await uploadFile(file);
  }

  function openPicker() {
    if (locked) return;
    inputRef.current?.click();
  }

  async function handleRemove(e) {
    e.stopPropagation();
    if (locked || !displayCover) return;
    setError('');
    setPendingCoverUrl('');
    setUploading(true);
    try {
      await saveCover('');
    } catch (err) {
      setPendingCoverUrl(null);
      setError(err?.message || '移除封面失敗');
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className={`forum-story-cover-edit${uploading ? ' forum-story-cover-edit--uploading' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="forum-story-cover-edit__file-input"
        onChange={handleFileChange}
        disabled={locked}
      />
      <button
        type="button"
        className={`forum-story-reader__cover-hero forum-story-cover-edit__trigger${displayCover ? ' forum-story-cover-edit__trigger--filled' : ''}`}
        onClick={openPicker}
        disabled={locked}
        aria-label={displayCover ? '更換故事封面' : '上傳故事封面'}
      >
        {showCoverImage ? (
          <img
            key={displayCover}
            src={optimizeForumDisplayUrl(displayCover)}
            alt=""
            className="forum-story-reader__cover-img"
            onError={() => setImgError(true)}
          />
        ) : displayCover && imgError ? (
          <span className="forum-story-cover-edit__placeholder forum-story-cover-edit__placeholder--error">
            <span className="forum-story-cover-edit__placeholder-icon" aria-hidden="true">⚠️</span>
            <span className="forum-story-cover-edit__placeholder-text">封面無法載入</span>
          </span>
        ) : (
          <span className="forum-story-cover-edit__placeholder">
            <span className="forum-story-cover-edit__placeholder-icon" aria-hidden="true">📖</span>
            <span className="forum-story-cover-edit__placeholder-text">上傳封面</span>
          </span>
        )}
        <span className="forum-story-reader__cover-spine" aria-hidden="true" />
        <span className="forum-story-reader__cover-shine" aria-hidden="true" />
        <span className="forum-story-cover-edit__overlay" aria-hidden="true">
          {uploading ? '更新中…' : (displayCover ? '更換封面' : '選擇圖片')}
        </span>
      </button>
      {displayCover && (
        <button
          type="button"
          className="forum-story-cover-edit__remove"
          onClick={handleRemove}
          disabled={locked}
        >
          移除封面
        </button>
      )}
      {!canUpload && !displayCover && (
        <p className="forum-story-cover-edit__hint">圖片上傳尚未設定。</p>
      )}
      {error && <p className="pixel-error forum-story-cover-edit__error">{error}</p>}
    </div>
  );
}
