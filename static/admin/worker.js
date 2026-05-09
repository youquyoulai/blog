/**
 * 博客管理后台 - Cloudflare Worker API
 * 功能：R2图片上传/列表/删除/Resize、GitHub文章管理
 * 部署：wrangler deploy admin/worker.js --name blog-admin-api
 */

// ═════════════════════════════════════════════════════════════════
// 图片 resize 配置（可选功能，需要开启 Cloudflare Image Resizing）
// R2 公开访问 URL，作为 Image Resizing 的 origin
const R2_ORIGIN = 'https://img.pgoj.top';

// ═════════════════════════════════════════════════════════════════
// CORS 配置
// ═════════════════════════════════════════════════════════════════
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
};

function corsResponse(body, status = 200, extraHeaders) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
  };
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers[key] = value;
    }
  }
  return new Response(body, { status, headers });
}

function checkAuth(request, env) {
  try {
    const token = request.headers.get('X-Admin-Token');
    const expectedToken = env.ADMIN_TOKEN;
    console.log('checkAuth: token=' + token + ', expected=' + (expectedToken ? 'exists' : 'undefined'));
    return token && expectedToken && token === expectedToken;
  } catch (e) {
    console.error('checkAuth error:', e.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// R2 图片操作
// ═════════════════════════════════════════════════════════════════
async function listImages(request, env) {
  const { objects } = await env.R2_BUCKET.list();
  const baseUrl = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  const list = objects.map(function(obj) {
    return {
      key: obj.key,
      url: baseUrl + '/' + obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
    };
  });
  return corsResponse(JSON.stringify({ images: list }));
}

async function uploadImage(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return corsResponse(JSON.stringify({ error: 'No file' }), 400);

  // 直接使用前端传来的文件名（已包含尺寸后缀如 -orig, -800, -300）
  const key = file.name;
  const arrayBuffer = await file.arrayBuffer();
  await env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type },
  });

  const url = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '') + '/' + key;
  return corsResponse(JSON.stringify({ ok: true, key, url }));
}

async function deleteImage(key, env) {
  await env.R2_BUCKET.delete(key);
  return corsResponse(JSON.stringify({ ok: true }));
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
const POSTS_DIR = 'content/posts';

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
  if (!res.ok) {
    const text = await res.text();
    throw new Error('GitHub ' + res.status + ': ' + text.substring(0, 200));
  }
  return res.json();
}

async function listPosts(request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR,
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

async function getPost(filename, env) {
  const token = env.GITHUB_TOKEN;
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + filename,
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
  const { filename, content } = body;
  if (!filename || !content) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  // 替换 @image:xxx 为 Markdown 图片语法
  const processedContent = await replaceImageRefs(content, env);
  const encoded = utf8ToBase64(processedContent);
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + filename,
    'PUT',
    env.GITHUB_TOKEN,
    { message: 'Create ' + filename, content: encoded }
  );
  return corsResponse(JSON.stringify({ ok: true, commit: data.commit }));
}

async function updatePost(slug, request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const body = await request.json();
  const { content, sha } = body;
  if (!content || !sha) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  // 替换 @image:xxx 为 Markdown 图片语法
  const processedContent = await replaceImageRefs(content, env);
  const encoded = utf8ToBase64(processedContent);
  const filename = slug.endsWith('.md') ? slug : slug + '.md';
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + filename,
    'PUT',
    env.GITHUB_TOKEN,
    { message: 'Update ' + filename, content: encoded, sha: sha }
  );
  return corsResponse(JSON.stringify({ ok: true, commit: data.commit }));
}

async function deletePost(slug, request, env) {
  const authToken = request.headers.get('X-Admin-Token');
  if (authToken !== env.ADMIN_TOKEN) return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
  const sha = request.headers.get('X-File-Sha');
  if (!sha) return corsResponse(JSON.stringify({ error: 'Missing sha' }), 400);

  const filename = slug.endsWith('.md') ? slug : slug + '.md';
  await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + filename,
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
  // 通过请求 GitHub 仓库的 dispatch event 触发 Pages 重建
  const token = env.GITHUB_TOKEN;
  await githubFetch(
    '/repos/' + GITHUB_REPO + '/dispatches',
    'POST',
    token,
    { event_type: 'rebuild' }
  );
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
async function getTaxonomies(env) {
  const data = await githubFetch(
    '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR,
    'GET',
    env.GITHUB_TOKEN
  );
  const files = data.filter(function(f) { return f.name.endsWith('.md'); });

  const categories = {};
  const tags = {};
  const totalPosts = files.length;

  for (const f of files) {
    const fileData = await githubFetch(
      '/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR + '/' + f.name,
      'GET',
      env.GITHUB_TOKEN
    );
    const content = base64ToUtf8(fileData.content);
    const frontmatter = content.split('---')[1] || '';

    // 提取 categories
    const catMatch = frontmatter.match(/categories:\s*\[([^\]]+)\]/);
    if (catMatch) {
      const cats = catMatch[1].split(',').map(s => s.trim().replace(/["']/g, ''));
      cats.forEach(c => { if (c) categories[c] = (categories[c] || 0) + 1; });
    }

    // 提取 tags
    const tagMatch = frontmatter.match(/tags:\s*\[([^\]]+)\]/);
    if (tagMatch) {
      const tgs = tagMatch[1].split(',').map(s => s.trim().replace(/["']/g, ''));
      tgs.forEach(t => { if (t) tags[t] = (tags[t] || 0) + 1; });
    }
  }

  return corsResponse(JSON.stringify({
    totalPosts,
    categories: Object.entries(categories).sort((a,b) => b[1]-a[1]).map(([name,count]) => ({name,count})),
    tags: Object.entries(tags).sort((a,b) => b[1]-a[1]).map(([name,count]) => ({name,count})),
  }));
}

// ═════════════════════════════════════════════════════════════════
// 友链管理
// ═════════════════════════════════════════════════════════════════
const LINKS_PATH = 'themes/xlxn/data/links.yaml';

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
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 公开的连接测试接口（无需认证）
    const url = new URL(request.url);
    if (url.pathname === '/api/ping') {
      return corsResponse(JSON.stringify({ ok: true, timestamp: Date.now() }));
    }

    if (!checkAuth(request, env)) {
      return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401);
    }

    const path = url.pathname;

    try {
      // ─── R2 图片 API ─────────────────────────────────────────────
      if (path === '/api/images' && request.method === 'GET') {
        return await listImages(request, env);
      }
      if (path === '/api/images/upload' && request.method === 'POST') {
        return await uploadImage(request, env);
      }
      if (path.startsWith('/api/images/') && request.method === 'DELETE') {
        const key = decodeURIComponent(path.replace('/api/images/', ''));
        return await deleteImage(key, env);
      }
      if (path === '/api/images/resize' && request.method === 'GET') {
        return await resizeImage(request, env);
      }

      // ─── GitHub 文章 API ──────────────────────────────────────────
      if (path === '/api/posts' && request.method === 'GET') {
        return await listPosts(request, env);
      }
      if (path === '/api/posts' && request.method === 'POST') {
        return await createPost(request, env);
      }
      if (path.startsWith('/api/posts/') && request.method === 'PUT') {
        const slug = decodeURIComponent(path.replace('/api/posts/', ''));
        return await updatePost(slug, request, env);
      }
      if (path.startsWith('/api/posts/') && request.method === 'DELETE') {
        const slug = decodeURIComponent(path.replace('/api/posts/', ''));
        return await deletePost(slug, request, env);
      }
      if (path.startsWith('/api/post/') && request.method === 'GET') {
        const filename = decodeURIComponent(path.replace('/api/post/', ''));
        return await getPost(filename, env);
      }

      // ─── 分类/标签 API ──────────────────────────────────────────
      if (path === '/api/taxonomies' && request.method === 'GET') {
        return await getTaxonomies(env);
      }

      // ─── 友链 API ───────────────────────────────────────────────
      if (path === '/api/links' && request.method === 'GET') {
        return await getLinks(env);
      }
      if (path === '/api/links' && request.method === 'PUT') {
        return await updateLinks(request, env);
      }

      // ─── 页面管理 API ────────────────────────────────────────────
      if (path === '/api/pages' && request.method === 'GET') {
        return await listPages(env);
      }
      if (path === '/api/pages' && request.method === 'POST') {
        return await createPage(request, env);
      }
      if (path.startsWith('/api/pages/') && request.method === 'PUT') {
        const slug = decodeURIComponent(path.replace('/api/pages/', ''));
        return await updatePage(slug, request, env);
      }
      if (path.startsWith('/api/pages/') && request.method === 'DELETE') {
        const slug = decodeURIComponent(path.replace('/api/pages/', ''));
        return await deletePage(slug, request, env);
      }
      if (path.startsWith('/api/page/') && request.method === 'GET') {
        const filename = decodeURIComponent(path.replace('/api/page/', ''));
        return await getPage(filename, env);
      }

      // ─── 构建触发 ─────────────────────────────────────────────────
      if (path === '/api/deploy' && request.method === 'POST') {
        return await triggerDeploy(env);
      }

      return corsResponse(JSON.stringify({ error: 'Not Found' }), 404);
    } catch (e) {
      console.error('Worker 错误:', e.message);
      return corsResponse(JSON.stringify({ error: e.message }), 500);
    }
  },
};
