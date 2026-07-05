/**
 * Client-side unsigned upload to Cloudinary (forum images).
 */

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export function isCloudinaryForumUploadConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    && process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
  );
}

function validateForumImageFile(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('請選擇圖片檔案。');
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('只支援 JPG、PNG、GIF、WEBP 格式。');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('圖片不能超過 5MB。');
  }
}

/**
 * @param {File} file
 * @param {{ onProgress?: (percent: number) => void }} [options]
 * @returns {Promise<string>} secure_url
 */
export function uploadForumImage(file, options = {}) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) {
    return Promise.reject(new Error('圖片上傳尚未設定，請稍後再試。'));
  }

  validateForumImageFile(file);

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', preset);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || typeof options.onProgress !== 'function') return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      options.onProgress(percent);
    });

    xhr.addEventListener('load', () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        reject(new Error('圖片上傳失敗，請稍後再試。'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data?.error?.message || '圖片上傳失敗，請稍後再試。'));
        return;
      }
      if (!data?.secure_url) {
        reject(new Error('圖片上傳失敗，請稍後再試。'));
        return;
      }
      if (typeof options.onProgress === 'function') {
        options.onProgress(100);
      }
      resolve(data.secure_url);
    });

    xhr.addEventListener('error', () => {
      reject(new Error('網路錯誤，圖片上傳失敗。'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('圖片上傳已取消。'));
    });

    xhr.send(body);
  });
}

export function optimizeForumDisplayUrl(url) {
  const raw = String(url || '');
  if (!raw.includes('res.cloudinary.com') || !raw.includes('/upload/')) return raw;
  if (raw.includes('/upload/w_')) return raw;
  return raw.replace('/upload/', '/upload/w_800,c_limit,q_auto,f_auto/');
}

export function buildForumImageMarkdown(url, alt = '圖片') {
  const safeAlt = String(alt || '圖片').replace(/[\[\]]/g, '');
  const displayUrl = optimizeForumDisplayUrl(url);
  return `\n![${safeAlt}](${displayUrl})\n`;
}
