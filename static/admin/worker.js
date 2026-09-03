/**
 * 博客管理后台 - Cloudflare Worker API
 * 功能：R2图片上传/列表/删除/Resize、GitHub文章管理
 * 部署：wrangler deploy admin/worker.js --name blog-admin-api
 */

// ═════════════════════════════════════════════════════════════════
// 配置
// ═════════════════════════════════════════════════════════════════
const R2_ORIGIN = 'https://img.pgoj.top';
const ALLOWED_ORIGIN = 'https://pennear.pgoj.top';  // 只允许自己的域名
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
  // 使用 '*' 通配符：API 请求跨域且不携带 Cookie，checkOrigin 已做来源验证
  return {
    'Access-Control-Allow-Origin': '*',
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
    const token = request.headers.get('X-Admin-Token') || '';
    const expected = env.ADMIN_TOKEN || '';
    // S03: 恒定时间比较，避免逐字节计时侧信道
    if (token.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  } catch (e) {
    return false;
  }
}

function isLocalDev(request) {
  const host = request.headers.get('Host') || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

// 验证请求来源
function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === ALLOWED_ORIGIN || 
         origin.endsWith('.pgoj.top') || 
         origin.startsWith('http://localhost') || 
         origin.startsWith('http://127.0.0.1');
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

  let listed;
  try {
    listed = await env.R2_BUCKET.list({ limit: 1000 });
  } catch (e) {
    // R2 绑定异常时不阻断保存，仅跳过图片引用替换（保留原始 @image: 标记）
    console.warn('R2 列表失败，跳过图片替换:', e.message);
    return content;
  }
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
const DEFAULT_SECTION = 'posts';

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
  // 剥离 UTF-8 BOM（\uFEFF），否则 /^---\s*\n/ 锚定正则会匹配失败，
  // 导致 frontmatter（categories/tags/正文）解析为空。
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
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

// 从 frontmatter 提取单值字段
function extractFMValue(content, field) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return '';
  const fm = match[1];
  const m = fm.match(new RegExp(field + ':\\s*"?([^"\\n]*)"'));
  return m ? m[1].trim() : '';
}

// 从 frontmatter 提取数组字段
function extractFMArray(content, field) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return [];
  const fm = match[1];
  const arrMatch = fm.match(new RegExp(field + ':\\s*\\[([^\\]]*)\\]'));
  if (arrMatch) {
    return arrMatch[1].split(',').map(function(s) { return s.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean);
  }
  // YAML block list format: field:\n  - item1\n  - item2
  const blockMatch = fm.match(new RegExp(field + ':\\s*\\n((?:\\s+-\\s+.+\\n?)+)'));
  if (blockMatch) {
    return blockMatch[1].match(/\s+-\s+(.+)/g).map(function(s) { return s.replace(/^\s+-\s+/, '').trim().replace(/^['"]|['"]$/g, ''); });
  }
  return [];
}

// 提取 frontmatter 之后的正文
function extractBody(content) {
  const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return match ? match[1].trim() : '';
}

async function listSubSections(request, env) {
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

  const subSections = [];
  for (const item of data) {
    if (item.type !== 'dir') continue;
    let info = { name: item.name, path: item.path, title: item.name, description: '', icon: '', layout: '', image: '', birth: '', death: '', era: '', achievements: [], articleCount: 0, sha: '' };
    try {
      const idxData = await githubFetch(
        '/repos/' + GITHUB_REPO + '/contents/' + item.path + '/_index.md',
        'GET',
        env.GITHUB_TOKEN
      );
      const content = base64ToUtf8(idxData.content);
      info.sha = idxData.sha;
      info.title = extractFMValue(content, 'title') || item.name;
      info.description = extractFMValue(content, 'description');
      info.icon = extractFMValue(content, 'icon');
      info.layout = extractFMValue(content, 'layout');
      info.image = extractFMValue(content, 'image');
      info.birth = extractFMValue(content, 'birth');
      info.death = extractFMValue(content, 'death');
      info.era = extractFMValue(content, 'era');
      info.achievements = extractFMArray(content, 'achievements');
    } catch (e) { /* _index.md might not exist */ }
    // count articles
    try {
      const subData = await githubFetch(
        '/repos/' + GITHUB_REPO + '/contents/' + item.path,
        'GET',
        env.GITHUB_TOKEN
      );
      info.articleCount = subData.filter(function(f) { return f.type === 'file' && f.name.endsWith('.md') && f.name !== '_index.md'; }).length;
    } catch (e) {}
    subSections.push(info);
  }

  return corsResponse(JSON.stringify(subSections));
}

async function createSubSection(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const body = await request.json();
  const { section, subsection, title, description, icon, layout, image, birth, death, era, achievements, content } = body;
  if (!section || !subsection) return corsResponse(JSON.stringify({ error: 'Missing section or subsection' }), 400);

  // Build frontmatter
  var lines = ['---'];
  lines.push('title: "' + (title || subsection) + '"');
  if (description) lines.push('description: "' + description + '"');
  if (icon) lines.push('icon: "' + icon + '"');
  if (layout) lines.push('layout: "' + layout + '"');
  if (image) lines.push('image: "' + image + '"');
  if (birth) lines.push('birth: ' + birth);
  if (death) lines.push('death: ' + death);
  if (era) lines.push('era: "' + era + '"');
  if (achievements && achievements.length > 0) {
    lines.push('achievements:');
    achievements.forEach(function(a) { lines.push('  - "' + a + '"'); });
  }
  lines.push('---');
  lines.push('');
  if (content) lines.push(content);

  var fullContent = lines.join('\n');
  var encoded = utf8ToBase64(fullContent);
  var dir = CONTENT_DIR + '/' + section + '/' + subsection;
  var data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + dir + '/_index.md',
    'PUT',
    env.GITHUB_TOKEN,
    { message: 'Create subsection ' + subsection, content: encoded }
  );
  return corsResponse(JSON.stringify({ ok: true, commit: data.commit }));
}

async function listPosts(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const dir = CONTENT_DIR + '/' + section;

  const posts = [];

  // Get top-level contents
  let data;
  try {
    data = await githubFetch(
      '/repos/' + GITHUB_REPO + '/contents/' + dir,
      'GET',
      env.GITHUB_TOKEN
    );
  } catch (e) {
    // 目录不存在时返回空数组
    console.error('listPosts failed for ' + dir + ':', e.message);
    return corsResponse(JSON.stringify([]));
  }

  // GitHub 返回单个文件时是对象而非数组
  if (!Array.isArray(data)) {
    return corsResponse(JSON.stringify([]));
  }

  for (const f of data) {
    if (f.type === 'file' && f.name.endsWith('.md') && f.name !== '_index.md') {
      posts.push({ name: f.name, slug: f.name.replace(/\.md$/, ''), sha: f.sha, path: f.path, subSection: '' });
    } else if (f.type === 'dir') {
      // Recursively fetch subdirectory contents
      try {
        const subData = await githubFetch(
          '/repos/' + GITHUB_REPO + '/contents/' + f.path,
          'GET',
          env.GITHUB_TOKEN
        );
        if (Array.isArray(subData)) {
          for (const sf of subData) {
            if (sf.type === 'file' && sf.name.endsWith('.md') && sf.name !== '_index.md') {
              posts.push({ name: sf.name, slug: sf.name.replace(/\.md$/, ''), sha: sf.sha, path: sf.path, subSection: f.name });
            }
          }
        }
      } catch (e) {
        console.error('Failed to list subdir ' + f.path + ':', e.message);
      }
    }
  }

  return corsResponse(JSON.stringify(posts));
}

async function getPost(filename, request, env) {
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const subSection = url.searchParams.get('subsection') || '';
  let dir = CONTENT_DIR + '/' + section;
  if (subSection) dir += '/' + subSection;
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
  const { filename, content, section, subsection } = body;
  if (!filename || !content) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  let dir = CONTENT_DIR + '/' + (section || DEFAULT_SECTION);
  if (subsection) dir += '/' + subsection;
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
  const subSection = url.searchParams.get('subsection') || '';
  const body = await request.json();
  const { content, sha } = body;
  if (!content || !sha) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  let dir = CONTENT_DIR + '/' + section;
  if (subSection) dir += '/' + subSection;
  // 替换 @image:xxx 为 Markdown 图片语法
  const processedContent = await replaceImageRefs(content, env);
  const encoded = utf8ToBase64(processedContent);
  const filename = slug.endsWith('.md') ? slug : slug + '.md';

  // 处理陈旧 sha：编辑时前端拿到的 sha 若已过期（GitHub 返回 409），
  // 自动重新拉取最新 sha 后重试一次，避免「编辑保存」稳定失败。
  let attemptSha = sha;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await githubFetch(
        '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + filename,
        'PUT',
        env.GITHUB_TOKEN,
        { message: 'Update ' + filename, content: encoded, sha: attemptSha }
      );
      return corsResponse(JSON.stringify({ ok: true, commit: data.commit }));
    } catch (e) {
      if (attempt === 0 && /409/.test(e.message)) {
        try {
          const latest = await githubFetch(
            '/repos/' + GITHUB_REPO + '/contents/' + dir + '/' + filename,
            'GET', env.GITHUB_TOKEN
          );
          if (latest && latest.sha) { attemptSha = latest.sha; continue; }
        } catch (e2) { /* 取最新 sha 失败，落到下方抛错 */ }
      }
      throw e;
    }
  }
}

async function deletePost(slug, request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const url = new URL(request.url);
  const section = url.searchParams.get('section') || DEFAULT_SECTION;
  const subSection = url.searchParams.get('subsection') || '';
  const body = await request.json();
  const sha = body.sha;
  if (!sha) return corsResponse(JSON.stringify({ error: 'Missing sha' }), 400);

  let dir = CONTENT_DIR + '/' + section;
  if (subSection) dir += '/' + subSection;
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
// 分类/标签统计（带 5min 模块级缓存 + 并发拉取）
// ═════════════════════════════════════════════════════════════════
// 分类/标签统计
// 策略：用 git trees API 一次拿全仓库文件路径（1 次 subrequest），
//       再按 offset/limit 分批用 git blobs 拉内容（每批 ≤40，
//       单次 invocation 不触发 Cloudflare subrequest 上限）。
//       前端循环调用把所有批次的 categories/tags 累加即可。
// ═════════════════════════════════════════════════════════════════
async function getTaxonomies(request, env) {
  // 直接读取 content/categories、content/tags 的 term 目录，不再逐篇扫 post 算计数。
  // 这样分类/标签列表秒开，且不会出现「观感 266」这类需要拉数百个 blob 的慢请求。
  const token = env.GITHUB_TOKEN;
  const base = '/repos/' + GITHUB_REPO + '/contents/' + CONTENT_DIR;
  try {
    const [cats, tags] = await Promise.all([
      githubFetch(base + '/categories', 'GET', token),
      githubFetch(base + '/tags', 'GET', token),
    ]);
    const categories = await resolveTermTitles(cats, token, base + '/categories');
    const tagList = await resolveTermTitles(tags, token, base + '/tags');
    return corsResponse(JSON.stringify({
      categories: categories,
      tags: tagList,
      hasMore: false,
    }));
  } catch (e) {
    console.error('读取分类/标签目录失败:', e.message);
    return corsResponse(JSON.stringify({
      error: e.message,
      categories: [], tags: [],
      hasMore: false,
      hint: 'Worker 读取 GitHub 分类/标签目录失败，请稍后重试'
    }), 500);
  }
}

// 列出 term 目录名，并尽量从各自的 _index.md 读取中文 title（无则回退 slug）
async function resolveTermTitles(entries, token, dirPath) {
  const dirs = (entries || []).filter(function(e) { return e.type === 'dir'; });
  return Promise.all(dirs.map(async function(d) {
    const name = d.name;
    let title = name;
    try {
      const f = await githubFetch(dirPath + '/' + name + '/_index.md', 'GET', token);
      if (f && f.content) {
        const c = base64ToUtf8(f.content);
        const m = c.match(/title:\s*["']?([^"'\n]+)["']?/);
        if (m) title = m[1].trim();
      }
    } catch (e) { /* 无 _index.md 时回退 slug */ }
    return { name: name, title: title };
  }));
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
// DEPRECATED: 文汇功能已暂停（源列表 wenhui-hidden.md 不存在，输出恒为空）。
// 接口与代码保留仅作历史参考，恢复前请勿在此扩展。
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
// 博客联盟站点管理
// ═════════════════════════════════════════════════════════════════
const ALLIANCE_PATH = 'data/alliance.json';

// GitHub Contents API 单文件上限 1MB（按 base64 编码后计算，约膨胀 33%）。
// 1200 个站点紧凑 JSON 约 457KB → base64 后约 609KB，余量约 415KB。
// 所以这里必须用无缩进的 JSON.stringify，绝不能加 (null, 2) 美化，
// 否则缩进会让体积膨胀到接近上限。
async function getAlliance(env) {
  const file = await readGitHubFile(ALLIANCE_PATH, env);
  if (!file) return corsResponse(JSON.stringify({ total: 0, blogs: [] }));
  try {
    return corsResponse(JSON.stringify(JSON.parse(file.content)));
  } catch(e) {
    return corsResponse(JSON.stringify({ total: 0, blogs: [] }));
  }
}

async function updateAlliance(request, env) {
  const body = await request.json();
  const blogs = body.blogs || [];
  // 活跃 = 最近 365 天内有更新
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const payload = {
    updated: new Date().toISOString(),
    source: body.source || 'https://www.boyouquan.com/blogs',
    total: blogs.length,
    active: blogs.filter(function(b) {
      return b.updated && String(b.updated).slice(0, 10) >= since;
    }).length,
    blogs: blogs
  };
  const content = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(content).length;
  // base64 按 1.4 倍估算，留出安全边界
  if (bytes * 1.4 > 1000 * 1024) {
    return corsResponse(JSON.stringify({
      error: '数据过大：' + Math.round(bytes / 1024) + 'KB。GitHub 单文件上限 1MB，请精简后再保存。'
    }), 413);
  }
  const existing = await readGitHubFile(ALLIANCE_PATH, env).catch(function() { return null; });
  const sha = existing ? existing.sha : undefined;
  await writeGitHubFile(ALLIANCE_PATH, content, sha, 'Update alliance blogs', env);
  return corsResponse(JSON.stringify({ ok: true, total: blogs.length, bytes: bytes }));
}

// 公开提交接口：供 pennear.pgoj.top 提交页调用，无需 admin token。
// checkOrigin 已限制来源为 *.pgoj.top，配合下面的 isPublicPath 放行匿名 POST。
// S04: 基于 KV 的提交速率限制（IP 维度，每日上限 3 次）。
// 无 SUBMISSIONS_KV binding 时返回 null，调用方照常放行（优雅降级）。
async function checkSubmitRateLimit(request, env) {
  if (!env || !env.SUBMISSIONS_KV) return null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = 'ratelimit:submit:' + ip;
  const count = parseInt(await env.SUBMISSIONS_KV.get(key) || '0', 10);
  if (count >= 3) {
    return corsResponse(JSON.stringify({ error: '今日提交次数已达上限，明天再试' }), 429);
  }
  await env.SUBMISSIONS_KV.put(key, String(count + 1), { expirationTtl: 86400 });
  return null;
}

async function submitBlog(request, env) {
  let body;
  try { body = await request.json(); } catch (e) {
    return corsResponse(JSON.stringify({ error: '请求格式错误' }), 400);
  }
  const name = (body.name || '').toString().trim();
  const feed = (body.feed || '').toString().trim();
  const siteIn = (body.site || body.domain || '').toString().trim();
  const desc = (body.desc || '').toString().trim();
  const tags = Array.isArray(body.tags)
    ? body.tags.map(function (t) { return String(t).trim(); }).filter(Boolean)
    : String(body.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  if (!name) return corsResponse(JSON.stringify({ error: '请填写博客名称' }), 400);
  if (!feed) return corsResponse(JSON.stringify({ error: '请填写 RSS / Atom 地址' }), 400);
  function isUrl(u) { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch (e) { return false; } }
  if (!isUrl(feed)) return corsResponse(JSON.stringify({ error: 'RSS 地址格式不正确' }), 400);

  let domain = '';
  try { domain = new URL(feed).hostname; } catch (e) {}
  let site = siteIn;
  if (!site) site = domain ? 'https://' + domain : feed;
  else if (!/^https?:\/\//i.test(site)) site = 'https://' + site.replace(/^\/+/, '');

  // S04: 公开接口速率限制（无 KV binding 时跳过）
  const rl = await checkSubmitRateLimit(request, env);
  if (rl) return rl;

  // P08: 乐观锁重试，解决并发读-改-写竞态（GitHub 返回 409 时重读最新版本再写）
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const existing = await readGitHubFile(ALLIANCE_PATH, env).catch(function () { return null; });
    let data;
    try { data = existing ? JSON.parse(existing.content) : { updated: null, source: '', total: 0, active: 0, blogs: [] }; }
    catch (e) { data = { updated: null, source: '', total: 0, active: 0, blogs: [] }; }
    const blogs = Array.isArray(data.blogs) ? data.blogs : [];

    const dup = blogs.some(function (b) {
      return (b.domain && domain && b.domain.toLowerCase() === domain.toLowerCase())
          || (b.feed && feed && b.feed.toLowerCase() === feed.toLowerCase());
    });
    if (dup) return corsResponse(JSON.stringify({ error: '该博客已收录，请勿重复提交' }), 409);

    const now = new Date().toISOString();
    blogs.push({
      name: name,
      domain: domain,
      site: site,
      feed: feed,
      desc: desc,
      posts: 0,
      updated: now,
      added: now,
      location: '',
      sunset: false,
      ok: true,
      hidden: false,
      pending: true,
      tags: tags
    });

    const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    data.updated = now;
    data.source = data.source || 'https://www.boyouquan.com/blogs';
    data.total = blogs.length;
    data.active = blogs.filter(function (b) { return b.updated && String(b.updated).slice(0, 10) >= since; }).length;
    data.blogs = blogs;

    const content = JSON.stringify(data);
    const bytes = new TextEncoder().encode(content).length;
    if (bytes * 1.4 > 1000 * 1024) {
      return corsResponse(JSON.stringify({ error: '数据过大，暂无法提交，请联系管理员' }), 413);
    }
    try {
      await writeGitHubFile(ALLIANCE_PATH, content, existing ? existing.sha : undefined, 'Submit blog: ' + name, env);
      return corsResponse(JSON.stringify({ ok: true, message: '提交成功，等待审核后展示。' }));
    } catch (e) {
      if (attempt < MAX_ATTEMPTS - 1 && /409/.test(e.message || '')) {
        continue;  // 版本冲突，重读最新版本重试
      }
      throw e;
    }
  }
}

// 从博友圈重新导入：通过 GitHub Actions workflow_dispatch 触发（导入脚本翻 120 页，
// 不能放在 Worker 里同步跑，会超过 50 子请求 / 次的限制）。
async function triggerAllianceImport(env) {
  const url = GITHUB_API + '/repos/' + GITHUB_REPO + '/actions/workflows/alliance-refresh.yml/dispatches';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ ref: 'main' })
    });
    if (!res.ok) {
      const t = await res.text();
      return corsResponse(JSON.stringify({ error: '触发导入失败: ' + res.status + ' ' + t.slice(0, 200) }), res.status);
    }
    return corsResponse(JSON.stringify({ ok: true, message: '已触发从博友圈重新导入，后台约 1 分钟跑完，完成后自动发布。' }));
  } catch (e) {
    return corsResponse(JSON.stringify({ error: '触发导入异常: ' + e.message }), 500);
  }
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

    const path = url.pathname;

    // 分类/标签是公开信息，提交接口也公开（供 pennear.pgoj.top 提交页匿名调用）
    const isPublicPath = path === '/wgpjyhxlxn/api/taxonomies' || path === '/wgpjyhxlxn/api/ping' || path === '/wgpjyhxlxn/api/submit';
    if (!checkAuth(request, env) && !isLocalDev(request) && !isPublicPath) {
      return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
    }


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

      // ─── 专题管理 API ────────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/subsections' && request.method === 'GET') {
        return await listSubSections(request, env);
      }
      if (path === '/wgpjyhxlxn/api/subsection' && request.method === 'POST') {
        return await createSubSection(request, env);
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

      // ─── 博客联盟 API ────────────────────────────────────────────
      if (path === '/wgpjyhxlxn/api/alliance' && request.method === 'GET') {
        return await getAlliance(env);
      }
      if (path === '/wgpjyhxlxn/api/alliance' && request.method === 'PUT') {
        return await updateAlliance(request, env);
      }
      if (path === '/wgpjyhxlxn/api/alliance/import' && request.method === 'POST') {
        return await triggerAllianceImport(env);
      }

      // ─── 公开提交接口（无需登录，供 pennear.pgoj.top 提交页调用） ─────────
      if (path === '/wgpjyhxlxn/api/submit' && request.method === 'POST') {
        return await submitBlog(request, env);
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
