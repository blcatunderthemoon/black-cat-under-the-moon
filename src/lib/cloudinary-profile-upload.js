/**
 * Client-side unsigned upload to Cloudinary (profile exchange photos).
 */

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export function isCloudinaryProfileUploadConfigured() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_PROFILE_UPLOAD_PRESET
    || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  return Boolean(cloudName && preset);
}

function getUploadPreset() {
  return process.env.NEXT_PUBLIC_CLOUDINARY_PROFILE_UPLOAD_PRESET
    || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
}

function validateProfileImageFile(file) {
  if (!file || !(file instanceof File)) {
    throw new Error('請選擇圖片檔案。');
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('只支援 JPG、PNG、WEBP 格式。');
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
export function uploadProfileExchangePhoto(file, options = {}) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = getUploadPreset();
  if (!cloudName || !preset) {
    return Promise.reject(new Error('圖片上傳尚未設定，請稍後再試。'));
  }

  validateProfileImageFile(file);

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', preset);
  if (process.env.NEXT_PUBLIC_CLOUDINARY_PROFILE_FOLDER) {
    body.append('folder', process.env.NEXT_PUBLIC_CLOUDINARY_PROFILE_FOLDER);
  }

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

/**
 * Apply heavy blur via Cloudinary transformation (server-safe preview).
 * @param {string} url
 * @param {number} [amount]
 * @returns {string}
 */
export function cloudinaryBlurredUrl(url, amount = 2000) {
  const raw = String(url || '');
  if (!raw.includes('res.cloudinary.com') || !raw.includes('/upload/')) return raw;
  if (raw.includes('e_blur:')) return raw;
  return raw.replace('/upload/', `/upload/e_blur:${amount}/`);
}

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/**
 * Validate URL is from our Cloudinary account (basic guard).
 * @param {string} url
 * @returns {boolean}
 */
export function isAllowedProfilePhotoUrl(url) {
  const raw = String(url || '').trim();
  if (!raw.startsWith('https://')) return false;
  if (CLOUD_NAME && raw.includes('res.cloudinary.com')) {
    return raw.includes(`/v1_1/${CLOUD_NAME}/`) || raw.includes(`/${CLOUD_NAME}/`);
  }
  return raw.includes('res.cloudinary.com');
}
