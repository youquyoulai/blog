/**
 * 博客管理后台 - Cloudflare Worker API
 * 功能：R2图片上传/列表/删除/Resize、GitHub文章管理
 * 部署：wrangler deploy admin/worker.js --name blog-admin-api
 */

// ═════════════════════════════════════════════════════════════════
// 配置
// ═════════════════════════════════════════════════════════════════
const R2_ORIGIN = 'https://img.pgoj.top';
const ALLOWED_ORIGIN = 'https://www.pgoj.top';  // 只允许自己的域名
const API_PREFIX = '/wgpjyhxlxn';  // API 路径前缀

// ═════════════════════════════════════════════════════════════════
// 安全响应头
// ═════════════════════════════════════════════════════════════════
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
};

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(body, status = 200, extraHeaders) {
  const origin = extraHeaders && extraHeaders['Origin'];
  const headers = {
    'Content-Type': 'application/json',
    ...SECURITY_HEADERS,
    ...getCorsHeaders(origin),
  };
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (key !== 'Origin') headers[key] = value;
    }
  }
  return new Response(body, { status, headers });
}

function checkAuth(request, env) {
  try {
    const token = request.headers.get('X-Admin-Token');
    const expectedToken = env.ADMIN_TOKEN;
    if (!token || !expectedToken || token !== expectedToken) {
      return false;
    }
    // 移除敏感日志
    return true;
  } catch (e) {
    return false;
  }
}

// 验证请求来源
function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;  // 无 Origin 头（直接访问）放行
  return origin === ALLOWED_ORIGIN || origin.endsWith('.pgoj.top');
}

// ═════════════════════════════════════════════════════════════════
// R2 图片操作
// ═════════════════════════════════════════════════════════════════
async function listImages(request, env) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || ''; // 文件夹前缀，如 "2026-05/"
  const baseUrl = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

  // 根据是否传了 prefix，决定是「文件夹视图」还是「文件列表视图」
  let folders = [];
  let objects = [];

  if (!prefix) {
    // 根视图：月份文件夹 + 根目录（虚拟文件夹显示无前缀的旧图片）
    const listed = await env.R2_BUCKET.list({ delimiter: '/', limit: 1000 });
    const allObjects = listed.objects || [];
    const allPrefixes = listed.delimitedPrefixes || [];

    // 所有真实文件夹（202605/、images/ 等）
    folders = allPrefixes.map(function(p) { return { name: p.replace(/\/$/, ''), prefix: p }; });

    // 根目录虚拟文件夹：无前缀的旧图片
    const rootObjects = allObjects.filter(function(obj) { return obj.key.indexOf('/') === -1; });
    if (rootObjects.length > 0) {
      folders.unshift({ name: '根目录', prefix: '' });
    }

    // 文件列表只显示当前文件夹的内容（根视图 = 无前缀文件）
    objects = rootObjects;
  } else {
    // 文件夹视图：列出该前缀下的对象和子文件夹
    const listed = await env.R2_BUCKET.list({ prefix: prefix, delimiter: '/', limit: 1000 });
    folders = (listed.delimitedPrefixes || []).map(function(p) {
      return { name: p.replace(prefix, '').replace(/\/$/, ''), prefix: p };
    });
    objects = (listed.objects || []);
  }

  // 提取文件名（不含目录）
  function getFileName(key) {
    const lastSlash = key.lastIndexOf('/');
    return lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
  }

  // 提取基础名（去掉 -orig / -800 / -300 等尺寸后缀）
  function getBaseName(key) {
    return getFileName(key).replace(/-(?:orig|800|300)\.webp$/, '.webp');
  }

  // 提取尺寸标签
  function getSizeLabel(key) {
    const m = getFileName(key).match(/-((?:orig|800|300))\.(webp|png|jpg|jpeg|gif)$/i);
    return m ? m[1] : 'orig';
  }

  // 提取原始扩展名
  function getExt(key) {
    const m = getFileName(key).match(/\.(webp|png|jpg|jpeg|gif|avif|heic)$/i);
    return m ? m[0] : '';
  }

  // 分组：同一基础名的文件归为一组
  const groups = {};
  for (const obj of objects) {
    const baseName = getBaseName(obj.key);
    const ext = getExt(obj.key);
    const groupKey = baseName; // 同一文件夹内按 baseName 分组

    if (!groups[groupKey]) {
      groups[groupKey] = {
        dir: prefix,
        base: baseName,
        ext: ext,
        files: [],
        totalSize: 0,
        latestUpload: null,
        count: 0,
      };
    }
    groups[groupKey].files.push({
      key: obj.key,
      url: baseUrl + '/' + obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      sizeLabel: getSizeLabel(obj.key),
    });
    groups[groupKey].totalSize += obj.size;
    groups[groupKey].count += 1;
    if (!groups[groupKey].latestUpload || obj.uploaded > groups[groupKey].latestUpload) {
      groups[groupKey].latestUpload = obj.uploaded;
    }
  }

  // 每组按尺寸优先级排序（orig > 800 > 300）
  const sizeOrder = { orig: 0, '800': 1, '300': 2 };
  for (const g of Object.values(groups)) {
    g.files.sort((a, b) => (sizeOrder[a.sizeLabel] ?? 9) - (sizeOrder[b.sizeLabel] ?? 9));
    const thumb = g.files.find(f => f.sizeLabel === '300') || g.files[0];
    g.thumbUrl = thumb.url;
    g.thumbKey = thumb.key;
  }

  const sortedGroups = Object.values(groups).sort((a, b) =>
    (b.latestUpload || 0) - (a.latestUpload || 0)
  );

  const flatList = objects.map(function(obj) {
    return {
      key: obj.key,
      url: baseUrl + '/' + obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
    };
  });

  // 文件夹按名称降序（最新的月份在前）
  folders.sort(function(a, b) { return b.name.localeCompare(a.name); });

  return corsResponse(JSON.stringify({
    folders: folders,
    images: flatList,
    groups: sortedGroups,
    totalGroups: sortedGroups.length,
    totalFiles: objects.length,
    currentPrefix: prefix,
  }));
}

async function uploadImage(request, env) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || ''; // 允许前端指定目标文件夹
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return corsResponse(JSON.stringify({ error: 'No file' }), 400);

  // 自动加月份前缀：优先级 prefix 参数 > 自动当月 > 空（根目录）
  let folder = prefix;
  if (!folder) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    folder = now.getFullYear() + mm + '/';
  }
  // 确保以 / 结尾
  if (folder && !folder.endsWith('/')) folder += '/';

  const baseName = file.name.replace(/^.*[\\\/]/, ''); // 去掉路径，只留文件名
  const key = folder + baseName;

  const arrayBuffer = await file.arrayBuffer();
  await env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const publicUrl = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '') + '/' + key;
  return corsResponse(JSON.stringify({ ok: true, key, url: publicUrl }));
}

async function deleteImage(key, env) {
  await env.R2_BUCKET.delete(key);
  return corsResponse(JSON.stringify({ ok: true }));
}

// 移动（复制+删除）文件
async function moveImages(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);

  const body = await request.json();
  const { from, to } = body; // from: "xxx.webp", to: "2026slt/xxx.webp"
  if (!from || !to) return corsResponse(JSON.stringify({ error: 'Missing from or to' }), 400);

  // 读取原文件
  const src = await env.R2_BUCKET.get(from);
  if (!src) return corsResponse(JSON.stringify({ error: 'Source file not found: ' + from }), 404);

  // 写入新位置（复制）
  await env.R2_BUCKET.put(to, src.body, {
    httpMetadata: src.httpMetadata,
    customMetadata: src.customMetadata,
  });

  // 删除原文件
  await env.R2_BUCKET.delete(from);

  return corsResponse(JSON.stringify({ ok: true, from, to }));
}

// 批量移动文件
async function batchMoveImages(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);

  const body = await request.json();
  const { files } = body; // [{ from: "xxx.webp", to: "2026slt/xxx.webp" }, ...]
  if (!files || !Array.isArray(files)) return corsResponse(JSON.stringify({ error: 'Missing files array' }), 400);

  const results = [];
  for (const { from, to } of files) {
    try {
      const src = await env.R2_BUCKET.get(from);
      if (!src) { results.push({ from, to, ok: false, error: 'not found' }); continue; }
      await env.R2_BUCKET.put(to, src.body, { httpMetadata: src.httpMetadata, customMetadata: src.customMetadata });
      await env.R2_BUCKET.delete(from);
      results.push({ from, to, ok: true });
    } catch (e) {
      results.push({ from, to, ok: false, error: e.message });
    }
  }

  return corsResponse(JSON.stringify({ ok: true, results }));
}

// ═════════════════════════════════════════════════════════════════
// 图片 resize（利用 Cloudflare Image Resizing）
// 用法：GET /api/images/resize?key=xxx&width=800&format=webp&quality=85
// 需要 Cloudflare Zone 开启 Image Resizing 功能（付费功能）
// ═════════════════════════════════════════════════════════════════
async function resizeImage(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const width = parseInt(url.searchParams.get('width') || '0', 10);
  const height = parseInt(url.searchParams.get('height') || '0', 10);
  const format = url.searchParams.get('format') || 'webp';
  const quality = parseInt(url.searchParams.get('quality') || '85', 10);

  if (!key) {
    return corsResponse(JSON.stringify({ error: 'Missing key param' }), 400);
  }

  const imageUrl = R2_ORIGIN + '/' + key;

  try {
    // 通过 fetch + cf.image 调用 Cloudflare Image Resizing
    const resized = await fetch(imageUrl, {
      cf: {
        image: {
          width: width || undefined,
          height: height || undefined,
          format: ['webp', 'avif', 'json'].includes(format) ? format : 'webp',
          quality: Math.min(Math.max(quality, 1), 100),
          fit: 'cover',
        },
      },
    });

    if (!resized.ok) {
      // Image Resizing 未开通或不可用
      return corsResponse(JSON.stringify({
        error: 'Image Resizing unavailable',
        hint: 'Please enable Cloudflare Image Resizing on your zone, or use client-side resize.',
        status: resized.status,
      }), 501);
    }

    const contentType = resized.headers.get('Content-Type') || 'image/webp';
    return new Response(resized.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e.message }), 500);
  }
}

// 替换 @image:xxx 为 Markdown 图片语法
async function replaceImageRefs(content, env) {
  const matches = content.match(/@image:([^\s\)]+)/g);
  if (!matches) return content;

  const listed = await env.R2_BUCKET.list({ limit: 1000 });
  const imageMap = {};
  listed.objects.forEach(o => {
    if (/\.(jpg|jpeg|png|gif|webp|svg|avif|heic)$/i.test(o.key)) {
      const filename = o.key.split('/').pop().toLowerCase();
      const url = (env.R2_PUBLIC_URL || '') + '/' + o.key;
      imageMap[filename] = url;
      imageMap[o.key.toLowerCase()] = url;
    }
  });

  let result = content;
  for (const match of matches) {
    const filename = match.replace('@image:', '').toLowerCase();
    if (imageMap[filename]) {
      result = result.replace(match, '![](' + imageMap[filename] + ')');
    }
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════
// GitHub 文章管理
// ═════════════════════════════════════════════════════════════════
const GITHUB_API = 'https://api.github.com';
const GITHUB_REPO = 'youquyoulai/blog';
const CONTENT_DIR = 'content';
const DEFAULT_SECTION = 'math';

function githubHeaders(token) {
  return {
    'Authorization': 'token ' + token,
    'Content-Type': 'application/json',
    'User-Agent': 'blog-admin',
  };
}

// UTF-8 安全的 base64 解码
function base64ToUtf8(base64) {
  const binaryString = atob(base64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

// UTF-8 安全的 base64 编码
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function githubFetch(path, method, token, body) {
  const res = await fetch(GITHUB_API + path, {
    method,
    headers: githubHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 204 || text === '') return {};
  if (!res.ok) {
    throw new Error('GitHub ' + res.status + ': ' + text.substring(0, 200));
  }
  return JSON.parse(text);
}

// 从文章 frontmatter 中提取分类/标签字段
function extractFrontmatterField(content, field) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return [];
  const fm = match[1];
  // 数组格式: field: [value1, value2]
  const arrMatch = fm.match(new RegExp(field + ':\\s*\\[([^\\]]*)\\]'));
  if (arrMatch) {
    return arrMatch[1].split(',').map(function(s) { return s.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean);
  }
  // 单值格式: field: value
  const singleMatch = fm.match(new RegExp(field + ':\\s*(.+)'));
  if (singleMatch) {
    return [singleMatch[1].trim().replace(/^['"]|['"]$/g, '')];
  }
  return [];
}

async function listPosts(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const dir = CONTENT_DIR + '/' + section;
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + dir,
    'GET',
    env.GITHUB_TOKEN
  );
  const posts = data
    .filter(function(f) { return f.name.endsWith('.md'); })
    .map(function(f) {
      const name = f.name;
      const slug = name.replace(/\.md$/, '');
      return { name: name, slug: slug, sha: f.sha, path: f.path };
    });
  return corsResponse(JSON.stringify(posts));
}

async function getPost(filename, request, env) {
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const dir = CONTENT_DIR + '/' + section;
  const token = env.GITHUB_TOKEN;
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + filename,
    'GET',
    token
  );
  const content = base64ToUtf8(data.content);
  return corsResponse(JSON.stringify({ content: content, sha: data.sha }));
}

async function createPost(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const body = await request.json();
  const { filename, content, section } = body;
  if (!filename || !content) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  const dir = CONTENT_DIR + '/' + (section || DEFAULT_SECTION);
  // 替换 @image:xxx 为 Markdown 图片语法
  const processedContent = await replaceImageRefs(content, env);
  const encoded = utf8ToBase64(processedContent);
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + filename,
    'PUT',
    env.GITHUB_TOKEN,
    { message: 'Create ' + filename, content: encoded }
  );
  return corsResponse(JSON.stringify({ ok: true, commit: data.commit }));
}

async function updatePost(slug, request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const body = await request.json();
  const { content, sha } = body;
  if (!content || !sha) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  const dir = CONTENT_DIR + '/' + section;
  // 替换 @image:xxx 为 Markdown 图片语法
  const processedContent = await replaceImageRefs(content, env);
  const encoded = utf8ToBase64(processedContent);
  const filename = slug.endsWith('.md') ? slug : slug + '.md';
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + filename,
    'PUT',
    env.GITHUB_TOKEN,
    { message: 'Update ' + filename, content: encoded, sha: sha }
  );
  return corsResponse(JSON.stringify({ ok: true, commit: data.commit }));
}

async function deletePost(slug, request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const body = await request.json();
  const sha = body.sha;
  if (!sha) return corsResponse(JSON.stringify({ error: 'Missing sha' }), 400);

  const dir = CONTENT_DIR + '/' + section;
  const filename = slug.endsWith('.md') ? slug : slug + '.md';
  await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + filename,
    'DELETE',
    env.GITHUB_TOKEN,
    { message: 'Delete ' + filename, sha: sha }
  );
  return corsResponse(JSON.stringify({ ok: true }));
}

// ═════════════════════════════════════════════════════════════════
// 构建触发
// ═════════════════════════════════════════════════════════════════
async function triggerDeploy(env) {
  // 通过 Cloudflare Pages 部署钩子触发构建
  const hookUrl = env.CF_DEPLOY_HOOK;
  if (!hookUrl) {
    throw new Error('Missing CF_DEPLOY_HOOK');
  }
  const res = await fetch(hookUrl, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Deploy hook ' + res.status + ': ' + text.substring(0, 200));
  }
  return corsResponse(JSON.stringify({ ok: true }));
}

// ═════════════════════════════════════════════════════════════════
// 通用 GitHub 文件读取
// ═════════════════════════════════════════════════════════════════
async function readGitHubFile(filePath, env) {
  try {
    const data = await githubFetch(
      '/repos/' + GITHUB_REPO + '/contents/' + filePath,
      'GET',
      env.GITHUB_TOKEN
    );
    return { content: base64ToUtf8(data.content), sha: data.sha };
  } catch (e) {
    // 文件不存在时返回 null
    if (e.message.includes('404')) return null;
    throw e;
  }
}

// ═════════════════════════════════════════════════════════════════
// 通用 GitHub 文件写入
// ═════════════════════════════════════════════════════════════════
async function writeGitHubFile(filePath, content, sha, message, env) {
  const body = {
    message: message,
    content: utf8ToBase64(content),
  };
  if (sha) body.sha = sha;
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + filePath,
    'PUT',
    env.GITHUB_TOKEN,
    body
  );
  return data;
}

// ═════════════════════════════════════════════════════════════════
// 分类/标签统计
// ═════════════════════════════════════════════════════════════════
async function getTaxonomies(request, env) {
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;

  // posts section: 使用 Hugo 生成的 taxonomies.json（覆盖大多数场景，快）
  if (section === DEFAULT_SECTION) {
    try {
      const res = await fetch('https://math.pgoj.top/taxonomies.json');
      if (res.ok) {
        const data = await res.json();
        return corsResponse(JSON.stringify(data));
      }
    } catch (e) {
      console.error('读取 taxonomies.json 失败:', e.message);
    }
    return corsResponse(JSON.stringify({ totalPosts: 0, categories: [], tags: [] }));
  }

  // 预设的 section taxonomy（即使没有文章也能显示）
  const SECTION_TAXONOMY_PRESETS = {
    'math': {
      categories: ['math-solutions', 'exam-analysis'],
      tags: ['gaokao-math', 'mock-exam'],
    },
  };

  // 非 posts section: 扫描目录文件，从 frontmatter 提取分类/标签并计数
  const dir = CONTENT_DIR + '/' + section;
  const presets = SECTION_TAXONOMY_PRESETS[section] || null;
  const catMap = {};
  const tagMap = {};

  try {
    const data = await githubFetch(
      '/repos/' + GITHUB_REPO + '/contents/' + dir,
      'GET',
      env.GITHUB_TOKEN
    );
    const mdFiles = data.filter(function(f) { return f.name.endsWith('.md') && f.name !== '_index.md'; });

    for (var i = 0; i < mdFiles.length; i++) {
      var f = mdFiles[i];
      var fileData = await githubFetch(
        '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + f.name,
        'GET',
        env.GITHUB_TOKEN
      );
      var content = base64ToUtf8(fileData.content);
      var cats = extractFrontmatterField(content, 'categories');
      var tags = extractFrontmatterField(content, 'tags');
      cats.forEach(function(c) { catMap[c] = (catMap[c] || 0) + 1; });
      tags.forEach(function(t) { tagMap[t] = (tagMap[t] || 0) + 1; });
    }

    // 合并预设分类/标签（count 以实际扫描为准，预设的补充为 0）
    if (presets) {
      presets.categories.forEach(function(c) {
        if (!(c in catMap)) catMap[c] = 0;
      });
      presets.tags.forEach(function(t) {
        if (!(t in tagMap)) tagMap[t] = 0;
      });
    }

    var catList = Object.keys(catMap).map(function(name) { return { name: name, count: catMap[name] }; });
    var tagList = Object.keys(tagMap).map(function(name) { return { name: name, count: tagMap[name] }; });

    return corsResponse(JSON.stringify({
      totalPosts: mdFiles.length,
      categories: catList,
      tags: tagList
    }));
  } catch (e) {
    // 目录不存在或扫描失败，回退返回预设
    if (presets) {
      return corsResponse(JSON.stringify({
        totalPosts: 0,
        categories: presets.categories.map(function(c) { return { name: c, count: 0 }; }),
        tags: presets.tags.map(function(t) { return { name: t, count: 0 }; }),
      }));
    }
    console.error('扫描 section taxonomies 失败:', e.message);
    return corsResponse(JSON.stringify({ totalPosts: 0, categories: [], tags: [] }));
  }
}

// ═════════════════════════════════════════════════════════════════
// 友链管理
// ═════════════════════════════════════════════════════════════════
const LINKS_PATH = 'themes/weisaygrace/data/links.yaml';

async function getLinks(env) {
  const file = await readGitHubFile(LINKS_PATH, env);
  if (!file) return corsResponse(JSON.stringify({ content: '', sha: null }));
  return corsResponse(JSON.stringify({ content: file.content, sha: file.sha }));
}

async function updateLinks(request, env) {
  const body = await request.json();
  const { content, sha } = body;
  if (content === undefined) return corsResponse(JSON.stringify({ error: 'Missing content' }), 400);
  const result = await writeGitHubFile(LINKS_PATH, content, sha, 'Update links', env);
  return corsResponse(JSON.stringify({ ok: true, sha: result.content.sha }));
}

// ═════════════════════════════════════════════════════════════════
// 文汇 RSS 源管理
const WENHUI_PATH = 'data/wenhui-feeds.json';

async function getWenhuiFeeds(env) {
  const file = await readGitHubFile(WENHUI_PATH, env);
  if (!file) return corsResponse(JSON.stringify({ feeds: [] }));
  try {
    const data = JSON.parse(file.content);
    return corsResponse(JSON.stringify(data));
  } catch(e) {
    return corsResponse(JSON.stringify({ feeds: [] }));
  }
}

async function updateWenhuiFeeds(request, env) {
  const body = await request.json();
  const { feeds } = body;
  const content = JSON.stringify({ feeds: feeds || [] }, null, 2);
  // 检查文件是否存在
  const existing = await readGitHubFile(WENHUI_PATH, env).catch(function(){ return null; });
  const sha = existing ? existing.sha : undefined;
  await writeGitHubFile(WENHUI_PATH, content, sha, 'Update wenhui feeds', env);
  return corsResponse(JSON.stringify({ ok: true }));
}

// ═════════════════════════════════════════════════════════════════
// 页面管理
// ═════════════════════════════════════════════════════════════════
const PAGES_DIR = 'content/pages';

async function listPages(env) {
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + PAGES_DIR,
    'GET',
    env.GITHUB_TOKEN
  );
  const pages = data
    .filter(function(f) { return f.name.endsWith('.md'); })
    .map(function(f) { return { name: f.name, slug: f.name.replace(/\.md$/, ''), sha: f.sha, path: f.path }; });
  return corsResponse(JSON.stringify(pages));
}

async function getPage(filename, env) {
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + PAGES_DIR + '/' + filename,
    'GET',
    env.GITHUB_TOKEN
  );
  return corsResponse(JSON.stringify({ content: base64ToUtf8(data.content), sha: data.sha }));
}

async function createPage(request, env) {
  const body = await request.json();
  const { filename, content } = body;
  if (!filename || !content) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);
  const processedContent = await replaceImageRefs(content, env);
  const result = await writeGitHubFile(PAGES_DIR + '/' + filename, processedContent, null, 'Create ' + filename, env);
  return corsResponse(JSON.stringify({ ok: true, sha: result.content.sha }));
}

async function updatePage(filename, request, env) {
  const body = await request.json();
  const { content, sha } = body;
  if (!content || !sha) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);
  const processedContent = await replaceImageRefs(content, env);
  const fname = filename.endsWith('.md') ? filename : filename + '.md';
  const result = await writeGitHubFile(PAGES_DIR + '/' + fname, processedContent, sha, 'Update ' + fname, env);
  return corsResponse(JSON.stringify({ ok: true, sha: result.content.sha }));
}

async function deletePage(filename, request, env) {
  const body = await request.json();
  if (!body.sha) return corsResponse(JSON.stringify({ error: 'Missing sha' }), 400);
  const fname = filename.endsWith('.md') ? filename : filename + '.md';
  await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + PAGES_DIR + '/' + fname,
    'DELETE',
    env.GITHUB_TOKEN,
    { message: 'Delete ' + fname, sha: body.sha }
  );
  return corsResponse(JSON.stringify({ ok: true }));
}

// ═════════════════════════════════════════════════════════════════
// 主请求处理器
// ═════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      return new Response(null, {
        status: 204,
        headers: {
          ...SECURITY_HEADERS,
          ...getCorsHeaders(origin),
        },
      });
    }

    // 公开的连接测试接口（无需认证）
    const url = new URL(request.url);
    if (url.pathname === '/wgpjyhxlxn/api/ping') {
      return corsResponse(JSON.stringify({ ok: true, timestamp: Date.now() }));
    }

    // 验证来源
    if (!checkOrigin(request)) {
      return corsResponse(JSON.stringify({ error: 'Forbidden' }), 403);
    }

    if (!checkAuth(request, env)) {
      return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
    }

    const path = url.pathname;

    try {
      // ─── R2 图片 API ─────────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/images' && request.method === 'GET') {
        return await listImages(request, env);
      }
      if (path === '/wgpjyhxlxn/api/images/upload' && request.method === 'POST') {
        return await uploadImage(request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/images/') && request.method === 'DELETE') {
        const key = decodeURIComponent(path.replace('/wgpjyhxlxn/api/images/', ''));
        return await deleteImage(key, env);
      }
      if (path === '/wgpjyhxlxn/api/images/move' && request.method === 'POST') {
        return await moveImages(request, env);
      }
      if (path === '/wgpjyhxlxn/api/images/batch-move' && request.method === 'POST') {
        return await batchMoveImages(request, env);
      }
      if (path === '/wgpjyhxlxn/api/images/resize' && request.method === 'GET') {
        return await resizeImage(request, env);
      }

      // ─── GitHub 文章 API ──────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/posts' && request.method === 'GET') {
        return await listPosts(request, env);
      }
      if (path === '/wgpjyhxlxn/api/posts' && request.method === 'POST') {
        return await createPost(request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/posts/') && request.method === 'PUT') {
        const slug = decodeURIComponent(path.replace('/wgpjyhxlxn/api/posts/', ''));
        return await updatePost(slug, request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/posts/') && request.method === 'DELETE') {
        const slug = decodeURIComponent(path.replace('/wgpjyhxlxn/api/posts/', ''));
        return await deletePost(slug, request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/post/') && request.method === 'GET') {
        const filename = decodeURIComponent(path.replace('/wgpjyhxlxn/api/post/', ''));
        return await getPost(filename, request, env);
      }

      // ─── 分类/标签 API ──────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/taxonomies' && request.method === 'GET') {
        return await getTaxonomies(request, env);
      }

      // ─── 友链 API ───────────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/links' && request.method === 'GET') {
        return await getLinks(env);
      }
      if (path === '/wgpjyhxlxn/api/links' && request.method === 'PUT') {
        return await updateLinks(request, env);
      }

      // ─── 文汇 RSS 源 API ─────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/wenhui-feeds' && request.method === 'GET') {
        return await getWenhuiFeeds(env);
      }
      if (path === '/wgpjyhxlxn/api/wenhui-feeds' && request.method === 'PUT') {
        return await updateWenhuiFeeds(request, env);
      }

      // ─── 页面管理 API ────────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/pages' && request.method === 'GET') {
        return await listPages(env);
      }
      if (path === '/wgpjyhxlxn/api/pages' && request.method === 'POST') {
        return await createPage(request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/pages/') && request.method === 'PUT') {
        const slug = decodeURIComponent(path.replace('/wgpjyhxlxn/api/pages/', ''));
        return await updatePage(slug, request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/pages/') && request.method === 'DELETE') {
        const slug = decodeURIComponent(path.replace('/wgpjyhxlxn/api/pages/', ''));
        return await deletePage(slug, request, env);
      }
      if (path.startsWith('/wgpjyhxlxn/api/page/') && request.method === 'GET') {
        const filename = decodeURIComponent(path.replace('/wgpjyhxlxn/api/page/', ''));
        return await getPage(filename, env);
      }

      // ─── 构建触发 ─────────────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/deploy' && request.method === 'POST') {
        return await triggerDeploy(env);
      }

      return corsResponse(JSON.stringify({ error: 'Not Found' }), 404);
    } catch (e) {
      console.error('Worker 错误:', e.message);
      return corsResponse(JSON.stringify({ error: e.message }), 500);
    }
  },
};
