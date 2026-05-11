// migrate-images.js - 将 R2 根目录图片迁移到 2026slt/ 文件夹
// 并更新 GitHub 文章中的图片引用

const R2_ACCOUNT_ID = 'cloudflare_account_id';  // 需要填
const R2_ACCESS_KEY_ID = 'r2_access_key_id';    // 需要填
const R2_SECRET_ACCESS_KEY = 'r2_secret_access_key'; // 需要填
const R2_BUCKET = 'imgpg';
const R2_PUBLIC_BASE = 'https://img.pgoj.top';
const BUCKET_BASE = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// GitHub 配置
const GITHUB_TOKEN = 'github_token';  // 需要填
const GITHUB_REPO = 'youquyoulai/blog';
const POSTS_DIR = 'content/posts';

async function listRootObjects(prefix = '') {
  const url = `${BUCKET_BASE}/${R2_BUCKET}?prefix=${prefix}&max-keys=1000`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}`,
    }
  });
  const text = await res.text();
  console.log('List response status:', res.status);
  console.log('First 500 chars:', text.substring(0, 500));
  return text;
}

async function main() {
  console.log('=== 开始迁移 ===');
  await listRootObjects('');
}

main().catch(console.error);
