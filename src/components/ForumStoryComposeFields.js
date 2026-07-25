import { useRef, useState } from 'react';
import {
  isCloudinaryForumUploadConfigured,
  optimizeForumDisplayUrl,
  uploadForumImage,
} from '../lib/cloudinary-forum-upload.js';
import { STORY_SYNOPSIS_MAX } from '../lib/forum-story.js';
import { ForumBookIcon } from './ForumIcons.js';

export default function ForumStoryComposeFields({
  coverUrl,
  synopsis,
  onCoverChange,
  onSynopsisChange,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const canUpload = isCloudinaryForumUploadConfigured();
  const synopsisLen = (synopsis || '').length;
  const uploadLocked = disabled || uploading || !canUpload;

  async function uploadFile(file) {
    if (!file || uploadLocked) return;
    setUploadError('');
    setUploading(true);
    try {
      const url = await uploadForumImage(file);
      onCoverChange?.(url);
    } catch (err) {
      setUploadError(err?.message || '封面上傳失敗');
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
    if (uploadLocked) return;
    inputRef.current?.click();
  }

  function handleDragOver(e) {
    if (uploadLocked) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  }

  async function handleDrop(e) {
    if (uploadLocked) return;
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    await uploadFile(file);
  }

  return (
    <div className="forum-story-compose">
      <section className="forum-story-compose__section forum-story-compose__section--cover" aria-labelledby="story-cover-label">
        <div className="forum-story-compose__section-head">
          <h3 id="story-cover-label" className="forum-story-compose__section-title">封面</h3>
          <span className="forum-story-compose__section-tag">可選</span>
        </div>

        <div
          className={`forum-story-compose__cover-zone${dragOver ? ' forum-story-compose__cover-zone--drag' : ''}${coverUrl ? ' forum-story-compose__cover-zone--filled' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="forum-story-compose__file-input"
            onChange={handleFileChange}
            disabled={uploadLocked}
          />

          <button
            type="button"
            className={`forum-story-compose__cover-preview${coverUrl ? ' forum-story-compose__cover-preview--filled' : ''}${uploading ? ' forum-story-compose__cover-preview--uploading' : ''}`}
            disabled={uploadLocked}
            onClick={openPicker}
            aria-label={coverUrl ? '更換故事封面' : '上傳故事封面'}
          >
            {coverUrl ? (
              <img
                src={optimizeForumDisplayUrl(coverUrl)}
                alt=""
                className="forum-story-compose__cover-img"
              />
            ) : (
              <span className="forum-story-compose__cover-placeholder">
                <span className="forum-story-compose__cover-icon" aria-hidden="true">
                  <ForumBookIcon size={22} />
                </span>
                <span className="forum-story-compose__cover-ratio">2:3</span>
              </span>
            )}
            <span className="forum-story-compose__spine" aria-hidden="true" />
            <span className="forum-story-compose__cover-overlay" aria-hidden="true">
              {uploading ? '上傳中…' : (coverUrl ? '更換封面' : '點擊上傳')}
            </span>
          </button>

          <div className="forum-story-compose__cover-meta">
            <p className="forum-story-compose__cover-lead">
              {coverUrl ? '書封已就緒' : '為故事放上書封'}
            </p>
            <p className="forum-story-compose__hint">
              拖曳圖片到左側書封，或點擊上傳。建議直式 2:3，會顯示在書架上。
            </p>
            <div className="forum-story-compose__cover-actions">
              <button
                type="button"
                className="forum-story-compose__cover-btn forum-story-compose__cover-btn--primary"
                disabled={uploadLocked}
                onClick={openPicker}
              >
                {uploading ? '上傳中…' : (coverUrl ? '更換封面' : '選擇圖片')}
              </button>
              {coverUrl && (
                <button
                  type="button"
                  className="forum-story-compose__cover-btn forum-story-compose__cover-btn--ghost"
                  disabled={disabled || uploading}
                  onClick={() => onCoverChange?.('')}
                >
                  移除
                </button>
              )}
            </div>
            {!canUpload && (
              <p className="forum-story-compose__hint forum-story-compose__hint--warn">圖片上傳尚未設定，可稍後再補封面。</p>
            )}
            {uploadError && <p className="pixel-error forum-story-compose__error">{uploadError}</p>}
          </div>
        </div>
      </section>

      <section className="forum-story-compose__section forum-story-compose__section--synopsis" aria-labelledby="story-synopsis-label">
        <div className="forum-story-compose__section-head">
          <h3 id="story-synopsis-label" className="forum-story-compose__section-title">簡介</h3>
          <span className="forum-story-compose__section-tag">書架預覽</span>
        </div>
        <label className="forum-story-compose__synopsis-label">
          <textarea
            className="pixel-textarea forum-story-compose__synopsis"
            value={synopsis}
            onChange={(e) => onSynopsisChange?.(e.target.value)}
            maxLength={STORY_SYNOPSIS_MAX}
            rows={3}
            placeholder="用幾句話介紹這個故事，吸引讀者翻開第一頁…"
            disabled={disabled}
          />
          <span className={`forum-story-compose__char-count${synopsisLen >= STORY_SYNOPSIS_MAX ? ' forum-story-compose__char-count--max' : ''}`}>
            {synopsisLen}/{STORY_SYNOPSIS_MAX}
          </span>
        </label>
      </section>
    </div>
  );
}
