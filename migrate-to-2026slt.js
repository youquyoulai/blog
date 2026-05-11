#!/usr/bin/env node
// migrate-to-2026slt.js
// 将 R2 根目录图片迁移到 2026slt/，并更新文章中的引用
// 用法: node migrate-to-2026slt.js <ADMIN_TOKEN> <GITHUB_TOKEN>

const API_BASE = 'https://api.pgoj.top';
const GITHUB_REPO = 'youquyoulai/blog';
const POSTS_DIR = 'content/posts';
const GITHUB_RAW = 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/main';
const TARGET_FOLDER = '2026slt/';
const OLD_BASE = 'https://img.pgoj.top/';
const NEW_BASE = 'https://img.pgoj.top/' + TARGET_FOLDER;

const [,, adminToken, githubToken] = process.argv;
if (!adminToken || !githubToken) {
  console.error('用法: node migrate-to-2026slt.js <ADMIN_TOKEN> <GITHUB_TOKEN>');
  process.exit(1);
}

async function api(path, method = 'GET', body = null) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return res.json();
}

async function githubRaw(path) {
  const res = await fetch(GITHUB_RAW + '/' + path);
  return res.text();
}

async function githubApi(path, method = 'GET', body = null) {
  const res = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      'Authorization': 'token ' + githubToken,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'blog-admin-migrate'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return res.json();
}

async function main() {
  // 第 1 步：获取 R2 根目录图片
  console.log('=== 第 1 步：获取 R2 根目录图片 ===');
  const list = await api('/api/images');
  const rootImages = (list.images || []).filter(img => !img.key.includes('/'));

  if (rootImages.length === 0) {
    console.log('根目录没有图片，无需迁移');
    return;
  }

  console.log(`找到 ${rootImages.length} 个根目录图片`);
  rootImages.forEach(img => console.log('  ' + img.key));

  // 第 2 步：批量移动到 2026slt/
  console.log('\n=== 第 2 步：批量移动图片到 ' + TARGET_FOLDER + ' ===');
  const moves = rootImages.map(img => ({
    from: img.key,
    to: TARGET_FOLDER + img.key
  }));

  const moveResult = await api('/api/images/batch-move', 'POST', { files: moves });
  const movedFiles = (moveResult.results || []).filter(r => r.ok).map(r => r.from);
  const failedFiles = (moveResult.results || []).filter(r => !r.ok);

  console.log(`移动成功: ${movedFiles.length} 个`);
  if (failedFiles.length > 0) {
    console.log('移动失败:');
    failedFiles.forEach(f => console.log('  ' + f.from + ' - ' + f.error));
  }

  if (movedFiles.length === 0) {
    console.log('没有图片移动成功，跳过文章更新');
    return;
  }

  // 第 3 步：更新文章引用
  console.log('\n=== 第 3 步：扫描并更新文章中的图片引用 ===');
  const posts = await githubApi('/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR);
  const mdFiles = (Array.isArray(posts) ? posts : []).filter(f => f.name.endsWith('.md'));

  console.log(`扫描 ${mdFiles.length} 篇文章...`);

  let updatedCount = 0;
  let imageUpdates = {};

  for (const file of mdFiles) {
    const content = await githubRaw(POSTS_DIR + '/' + encodeURIComponent(file.name));

    let newContent = content;
    for (const from of movedFiles) {
      const oldUrl = OLD_BASE + from;
      const newUrl = NEW_BASE + from;
      if (newContent.includes(oldUrl)) {
        newContent = newContent.split(oldUrl).join(newUrl);
        imageUpdates[from] = imageUpdates[from] || [];
        imageUpdates[from].push(file.name);
      }
    }

    if (newContent !== content) {
      const fileData = await githubApi('/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + file.name);
      const encoded = Buffer.from(newContent).toString('base64');

      await githubApi('/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + file.name, 'PUT', {
        message: 'migrate: move images to ' + TARGET_FOLDER,
        content: encoded,
        sha: fileData.sha
      });

      updatedCount++;
      console.log('  ✓ 更新文章: ' + file.name);
    }
  }

  console.log('\n=== 完成 ===');
  console.log(`共移动 ${movedFiles.length} 个图片到 ${TARGET_FOLDER}`);
  console.log(`共更新 ${updatedCount} 篇文章`);

  if (Object.keys(imageUpdates).length > 0) {
    console.log('\n图片引用更新明细:');
    for (const [img, files] of Object.entries(imageUpdates)) {
      console.log('  ' + img + ' -> ' + files.join(', '));
    }
  }
}

main().catch(console.error);
