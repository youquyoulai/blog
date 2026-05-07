/**
 * image-processor.js - 前端图片处理工具
 * 功能：压缩图片、转换格式、按尺寸裁剪
 * 依赖：纯原生 API，无外部库
 */

const ImageProcessor = {

  /**
   * 获取图片 MIME 类型
   */
  getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeMap = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
    };
    return mimeMap[ext] || 'image/jpeg';
  },

  /**
   * 检查浏览器是否支持 WebP 编码
   */
  async supportsWebP() {
    if (this._webpSupported !== undefined) return this._webpSupported;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    this._webpSupported = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    return this._webpSupported;
  },

  /**
   * 加载图片文件为 Image 对象
   */
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  },

  /**
   * 使用 Canvas 压缩并转换图片
   * @param {File|Blob} file - 原始文件
   * @param {Object} options - 处理选项
   * @param {number} options.maxWidth - 最大宽度，默认 1920
   * @param {number} options.maxHeight - 最大高度，默认 1920
   * @param {number} options.quality - JPEG/WebP 质量 0-1，默认 0.85
   * @param {boolean} options.toWebP - 是否强制转为 WebP，默认 true
   * @returns {Promise<{blob: Blob, width: number, height: number, originalSize: number, newSize: number}>}
   */
  async processImage(file, options = {}) {
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      quality = 0.85,
      toWebP = true,
    } = options;

    const originalSize = file.size;
    const img = await this.loadImage(file);

    // 计算缩放后的尺寸
    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    // 使用更好的插值算法
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 填充白色背景（JPEG 不支持透明）
    if (toWebP) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(img.src);

    // 确定输出格式
    let mimeType;
    if (toWebP) {
      const canWebP = await this.supportsWebP();
      mimeType = canWebP ? 'image/webp' : 'image/jpeg';
    } else {
      mimeType = this.getMimeType(file.name);
      // JPEG 不支持透明，PNG 保留格式
      if (mimeType === 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      }
    }

    // 转换为 Blob
    const blob = await new Promise((resolve) => {
      if (mimeType === 'image/webp') {
        canvas.toBlob(resolve, 'image/webp', quality);
      } else if (mimeType === 'image/jpeg') {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      } else {
        canvas.toBlob(resolve, mimeType);
      }
    });

    // 生成新文件名
    const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}.${ext}`;

    return {
      blob,
      width,
      height,
      originalSize,
      newSize: blob.size,
      newName,
      mimeType,
      savedBytes: originalSize - blob.size,
      savedPercent: Math.round((1 - blob.size / originalSize) * 100),
    };
  },

  /**
   * 预览处理结果的简化版（用于 UI 显示）
   */
  async preview(file, options = {}) {
    const result = await this.processImage(file, options);
    return {
      previewUrl: URL.createObjectURL(result.blob),
      newSize: result.newSize,
      savedPercent: result.savedPercent,
      newName: result.newName,
    };
  },

  /**
   * 直接处理并上传到 Worker
   * @param {File} file - 要上传的文件
   * @param {Object} options - 处理选项
   * @param {string} options.uploadUrl - Worker 上传端点
   * @param {string} options.token - 认证 Token
   * @returns {Promise<Object>} 上传结果
   */
  async processAndUpload(file, options = {}) {
    const {
      uploadUrl = '/api/images/upload',
      token = '',
      processOptions = {},
      onProgress = null,
    } = options;

    // 1. 处理图片
    if (onProgress) onProgress({ stage: 'processing', message: '正在压缩图片...' });
    const processed = await this.processImage(file, processOptions);

    // 2. 构建 FormData 上传
    if (onProgress) onProgress({ stage: 'uploading', message: '正在上传...' });
    const formData = new FormData();
    formData.append('file', processed.blob, processed.newName);

    const headers = {
      'X-Admin-Token': token,
    };

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || '上传失败');
    }

    const result = await response.json();

    return {
      ...result,
      processing: {
        originalSize: processed.originalSize,
        newSize: processed.newSize,
        savedBytes: processed.savedBytes,
        savedPercent: processed.savedPercent,
        width: processed.width,
        height: processed.height,
        format: processed.mimeType,
      },
    };
  },

  /**
   * 格式化文件大小
   */
  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  },

  /**
   * 生成缩略图 URL（利用 Cloudflare Image Resizing）
   * @param {string} imageUrl - 原图 URL
   * @param {number} width - 目标宽度
   * @param {number} height - 目标高度
   * @param {string} format - 格式：webp, avif, auto
   */
  thumbnailUrl(imageUrl, width = 200, height = 200, format = 'webp') {
    const separator = imageUrl.includes('?') ? '&' : '?';
    return `${imageUrl}${separator}width=${width}&height=${height}&format=${format}&quality=80`;
  },

  /**
   * 生成不同尺寸的 srcset（用于响应式图片）
   */
  buildSrcSet(imageUrl, sizes = [400, 800, 1200, 1600], format = 'webp') {
    return sizes.map(w => {
      const separator = imageUrl.includes('?') ? '&' : '?';
      return `${imageUrl}${separator}width=${w}&format=${format}&quality=80 ${w}w`;
    }).join(', ');
  },
};

// 导出
window.ImageProcessor = ImageProcessor;
