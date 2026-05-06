// 修复后的Waline API代理部分
// 替换 worker.js 中的对应部分

// ═════════════════════════════════════════════════════════════
// Waline 评论管理 API 代理
// ═════════════════════════════════════════════════════════════
const WALINE_API = 'https://waline.pgoj.top';
const WALINE_TOKEN = 'wgp@369852'; // Waline 管理 Token

async function walineFetch(path, method, body) {
  const url = `${WALINE_API}${path}`;
  console.log('Waline API 请求:', method, url);
  
  // 尝试多种认证方式
  const authMethods = [
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${WALINE_TOKEN}` } },
    { name: 'Cookie', headers: { 'Cookie': `token=${WALINE_TOKEN}` } },
    { name: 'X-Waline-Token', headers: { 'X-Waline-Token': WALINE_TOKEN } },
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

  try {
    await walineFetch(`/comment?type=approve`, 'POST', { ids: [id] });
    return corsResponse(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error('approveComment 错误:', e.message);
    throw e;
  }
}

// 删除/标记为垃圾评论
async function deleteComment(request, env) {
  const body = await request.json();
  const { id, spam } = body;
  if (!id) return corsResponse(JSON.stringify({ error: 'Missing id' }), 400);

  try {
    if (spam) {
      await walineFetch(`/comment?type=spam`, 'POST', { ids: [id] });
    } else {
      await walineFetch(`/comment?type=delete`, 'POST', { ids: [id] });
    }
    return corsResponse(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error('deleteComment 错误:', e.message);
    throw e;
  }
}
