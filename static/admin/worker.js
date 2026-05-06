/**
 * 博客管理后台 - Cloudflare Worker API
 * 功能：R2图片上传/列表/删除、GitHub文章管理
 * 部署：wrangler deploy admin/worker.js --name blog-admin-api
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
};

function corsResponse(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extra },
  });
}

function checkAuth(request, env) {
  const token = request.headers.get('X-Admin-Token');
  return token === env.ADMIN_TOKEN;
}

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
      // ─── R2 图片 API ───────────────────────────────────────────────
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

      // ─── Waline 评论管理 API ─────────────────────────────────────
      if (path === '/api/comments' && request.method === 'GET') {
        return await listComments(request, env);
      }
      if (path === '/api/comments/approve' && request.method === 'POST') {
        return await approveComment(request, env);
      }
      if (path === '/api/comments/delete' && request.method === 'POST') {
        return await deleteComment(request, env);
      }

      return corsResponse(JSON.stringify({ error: 'Not Found' }), 404);
    } catch (e) {
      return corsResponse(JSON.stringify({ error: e.message }), 500);
    }
  },
};

// ══════════════════════════════════════════════════════════════════
// R2 图片操作
// ══════════════════════════════════════════════════════════════════

async function listImages(request, env) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') || undefined;
  const prefix = url.searchParams.get('prefix') || '';

  const listed = await env.R2_BUCKET.list({
    limit: 50,
    cursor,
    prefix,
  });

  const images = listed.objects
    .filter(o => /\.(jpg|jpeg|png|gif|webp|svg|avif|heic)$/i.test(o.key))
    .map(o => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded,
      url: `${env.R2_PUBLIC_URL}/${o.key}`,
    }));

  return corsResponse(JSON.stringify({
    images,
    truncated: listed.truncated,
    cursor: listed.truncated ? listed.cursor : null,
  }));
}

async function uploadImage(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return corsResponse(JSON.stringify({ error: 'No file' }), 400);

  // 生成文件名：年月/原始文件名
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${ym}/${originalName}`;

  const arrayBuffer = await file.arrayBuffer();
  await env.R2_BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;
  return corsResponse(JSON.stringify({ key, url: publicUrl }));
}

async function deleteImage(key, env) {
  await env.R2_BUCKET.delete(key);
  return corsResponse(JSON.stringify({ ok: true }));
}

// ══════════════════════════════════════════════════════════════════
// GitHub 文章操作
// ══════════════════════════════════════════════════════════════════

const GH_API = 'https://api.github.com';
const REPO = 'youquyoulai/blog';
const POSTS_PATH = 'content/posts';

async function ghFetch(path, method, body, env) {
  console.log('ghFetch:', method, path);
  const res = await fetch(`${GH_API}/repos/${REPO}${path}`, {
    method,
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'blog-admin-worker',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log('ghFetch 响应状态:', res.status, '响应内容:', text.substring(0, 200));
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function listPosts(request, env) {
  console.log('listPosts: 开始获取文章列表');
  try {
    // 获取 content/posts 目录下所有 .md 文件
    const data = await ghFetch(`/contents/${POSTS_PATH}`, 'GET', null, env);
    console.log('listPosts: GitHub 返回数据', JSON.stringify(data).substring(0, 200));
    
    if (!Array.isArray(data)) {
      console.error('listPosts: 返回数据不是数组', typeof data);
      return corsResponse(JSON.stringify({ error: 'Invalid response from GitHub', detail: typeof data }), 500);
    }
    
    const posts = data
      .filter(f => f.name.endsWith('.md'))
      .map(f => ({ name: f.name, sha: f.sha, path: f.path }))
      .sort((a, b) => b.name.localeCompare(a.name));
    console.log('listPosts: 找到', posts.length, '篇文章');
    return corsResponse(JSON.stringify({ posts }));
  } catch (e) {
    console.error('listPosts: 错误', e.message);
    throw e;
  }
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

async function getPost(filename, env) {
  const data = await ghFetch(`/contents/${POSTS_PATH}/${filename}`, 'GET', null, env);
  const content = base64ToUtf8(data.content);
  return corsResponse(JSON.stringify({ filename, content, sha: data.sha }));
}

async function createPost(request, env) {
  const { filename, content } = await request.json();
  if (!filename || !content) return corsResponse(JSON.stringify({ error: 'Missing fields' }), 400);

  const encoded = utf8ToBase64(content);
  await ghFetch(`/contents/${POSTS_PATH}/${filename}`, 'PUT', {
    message: `✏️ 新建文章: ${filename}`,
    content: encoded,
  }, env);

  return corsResponse(JSON.stringify({ ok: true, filename }));
}

async function updatePost(filename, request, env) {
  const { content, sha } = await request.json();
  const encoded = utf8ToBase64(content);

  await ghFetch(`/contents/${POSTS_PATH}/${filename}`, 'PUT', {
    message: `✏️ 更新文章: ${filename}`,
    content: encoded,
    sha,
  }, env);

  return corsResponse(JSON.stringify({ ok: true }));
}

async function deletePost(filename, request, env) {
  const { sha } = await request.json();
  await ghFetch(`/contents/${POSTS_PATH}/${filename}`, 'DELETE', {
    message: `🗑️ 删除文章: ${filename}`,
    sha,
  }, env);
  return corsResponse(JSON.stringify({ ok: true }));
}

async function triggerDeploy(env) {
  // 触发 Cloudflare Pages 重新构建（通过 GitHub dispatch）
  await fetch(`${GH_API}/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'blog-admin-worker',
    },
    body: JSON.stringify({ event_type: 'manual-deploy' }),
  });
  return corsResponse(JSON.stringify({ ok: true }));
}

// ══════════════════════════════════════════════════════════════════
// Waline 评论管理 API 代理
// ══════════════════════════════════════════════════════════════════
const WALINE_API = 'https://waline.pgoj.top';
const WALINE_TOKEN = 'wgp@369852'; // Waline 管理 Token

async function walineFetch(path, method, body) {
  const url = `${WALINE_API}${path}`;
  console.log('Waline API 请求:', method, url);
  
  // 尝试多种认证方式
  const authMethods = [
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${WALINE_TOKEN}` } },
    { name: 'Cookie', headers: { 'Cookie': `token=${WALINE_TOKEN}` } },
  ];
  
  let lastError = null;
  
  for (const auth of authMethods) {
    const headers = {
      'Content-Type': 'application/json',
      ...auth.headers,
    };
    
    try {
      console.log(`尝试认证方式: ${auth.name}`);
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const text = await res.text();
      console.log(`认证方式 ${auth.name} 响应状态:`, res.status);
      console.log(`响应内容（前200字符）:`, text.substring(0, 200));
      
      if (res.ok) {
        return JSON.parse(text);
      }
      
      lastError = `Waline API ${res.status}: ${text.substring(0, 200)}`;
    } catch (e) {
      console.log(`认证方式 ${auth.name} 失败:`, e.message);
      lastError = e.message;
    }
  }
  
  throw new Error(lastError || '所有认证方式都失败了');
}

// 获取评论列表 + 统计
async function listComments(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const page = url.searchParams.get('page') || '1';
  const pageSize = url.searchParams.get('pageSize') || '20';

  try {
    // 获取各状态评论数量（用于统计）
    const [allData, waitingData, approvedData, spamData] = await Promise.all([
      walineFetch(`/comment?type=list&page=1&pageSize=1&status=all`, 'GET').catch(e => { console.log('获取全部评论统计失败:', e.message); return { result: 'ok', total: 0, data: [] }; }),
      walineFetch(`/comment?type=list&page=1&pageSize=1&status=waiting`, 'GET').catch(e => { console.log('获取待审核评论统计失败:', e.message); return { result: 'ok', total: 0, data: [] }; }),
      walineFetch(`/comment?type=list&page=1&pageSize=1&status=approved`, 'GET').catch(e => { console.log('获取已通过评论统计失败:', e.message); return { result: 'ok', total: 0, data: [] }; }),
      walineFetch(`/comment?type=list&page=1&pageSize=1&status=spam`, 'GET').catch(e => { console.log('获取垃圾评论统计失败:', e.message); return { result: 'ok', total: 0, data: [] }; }),
    ]);

    // 获取当前状态的评论列表
    const listData = await walineFetch(
      `/comment?type=list&page=${page}&pageSize=${pageSize}&status=${status}`,
      'GET'
    );

    // 正确解析Waline API返回格式
    // Waline返回格式: { result: "ok", data: [...], total: N }
    const comments = (listData.data || []).map(item => ({
      id: item.objectId || item._id || item.id,
      nick: item.nick || item.author || '匿名',
      avatar: item.avatar || '',
      link: item.link || '',
      comment: item.comment || item.content || '',
      url: item.url || item.page || '',
      time: item.time || item.createdAt || Date.now(),
      status: item.status || 'approved',
    }));

    return corsResponse(JSON.stringify({
      comments: comments,
      total: listData.total || 0,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      stats: {
        all: allData.total || 0,
        waiting: waitingData.total || 0,
        approved: approvedData.total || 0,
        spam: spamData.total || 0,
      },
    }));
  } catch (e) {
    console.error('listComments 错误:', e.message);
    throw e;
  }
}

// 审核通过评论
async function approveComment(request, env) {
  const body = await request.json();
  const { id } = body;
  if (!id) return corsResponse(JSON.stringify({ error: 'Missing id' }), 400);

  await walineFetch(`/comment?type=approve`, 'POST', { ids: [id] });
  return corsResponse(JSON.stringify({ ok: true }));
}

// 删除/标记为垃圾评论
async function deleteComment(request, env) {
  const body = await request.json();
  const { id, spam } = body;
  if (!id) return corsResponse(JSON.stringify({ error: 'Missing id' }), 400);

  if (spam) {
    await walineFetch(`/comment?type=spam`, 'POST', { ids: [id] });
  } else {
    await walineFetch(`/comment?type=delete`, 'POST', { ids: [id] });
  }
  return corsResponse(JSON.stringify({ ok: true }));
}
