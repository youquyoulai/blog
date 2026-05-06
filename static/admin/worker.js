/**
 * 博客管理后台 - Cloudflare Worker API
 * 功能：R2图片上传/列表/删除、GitHub文章管理
 * 部署：wrangler deploy admin/worker.js --name blog-admin-api
 */

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
  return corsResponse(JSON.stringify(list));
}

async function uploadImage(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return corsResponse(JSON.stringify({ error: 'No file' }), 400);

  const key = Date.now() + '_' + file.name;
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
