/* ===== 评论管理 ===== */
var WALINE_API = 'https://waline.pgoj.top';
var currentComments = [];
var replyTarget = null;
var commentMeta = {};
var currentPage = 1;
var pageSize = 50;

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

async function loadComments() {
  var el = document.getElementById('commentList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  try {
    var filter = document.getElementById('commentFilter').value;
    var url = WALINE_API + '/comment?type=list&pageSize=' + pageSize + '&page=' + currentPage;
    if (filter) url += '&status=' + filter;
    var res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var raw = data && data.data;
    if (raw && Array.isArray(raw.data)) {
      currentComments = raw.data;
    } else if (Array.isArray(raw)) {
      currentComments = raw;
    } else {
      currentComments = [];
    }
    currentComments = currentComments.map(function(c) {
      if (!c.id && c.objectId) c.id = c.objectId;
      return c;
    });
    commentMeta = { total: raw && raw.total ? raw.total : currentComments.length };
    renderComments();
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p>加载失败：' + escHtml(e.message) + '</p></div>';
  }
}

function renderComments() {
  var el = document.getElementById('commentList');
  var list = Array.isArray(currentComments) ? currentComments : [];
  if (list.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>暂无评论</p></div>';
    return;
  }
  var topLevel = list.filter(function(c) { return !c.pid; });
  topLevel.sort(function(a, b) { return (b.time || 0) - (a.time || 0); });

  var html = '<div class="post-list">';
  for (var i = 0; i < topLevel.length; i++) {
    html += renderCommentCard(topLevel[i], 0);
  }
  html += '</div>';
  // 分页
  var total = commentMeta.total || 0;
  var totalPages = Math.ceil(total / pageSize);
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:20px;flex-wrap:wrap;">';
    html += '<button class="btn btn-sm" onclick="commentPrevPage()" ' + (currentPage <= 1 ? 'disabled style="opacity:0.4;cursor:default;"' : '') + '><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15,18 9,12 15,6"/></svg> 上一页</button>';
    html += '<span style="font-size:0.82rem;color:var(--muted);padding:6px 12px;background:var(--surface);border:1px solid var(--border);border-radius:100px;">第 ' + currentPage + ' / ' + totalPages + ' 页 · 共 ' + total + ' 条</span>';
    html += '<button class="btn btn-sm" onclick="commentNextPage()" ' + (currentPage >= totalPages ? 'disabled style="opacity:0.4;cursor:default;"' : '') + '>下一页 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg></button>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function commentPrevPage() {
  if (currentPage > 1) { currentPage--; loadComments(); }
}

function commentNextPage() {
  var total = commentMeta.total || 0;
  var totalPages = Math.ceil(total / pageSize);
  if (currentPage < totalPages) { currentPage++; loadComments(); }
}

function renderCommentCard(comment, depth) {
  var borderColor = depth > 0 ? 'var(--accent)' : 'transparent';
  var indentStyle = depth > 0 ? 'margin-left:' + (depth * 20) + 'px;' : '';
  var statusColor = comment.status === 'waiting' ? 'var(--orange)' : 'var(--green)';
  var statusLabel = comment.status === 'waiting' ? '待审核' : (comment.status === 'spam' ? '垃圾' : '已批准');
  var time = formatCommentTime(comment.time);
  var pageUrl = comment.url || '';
  var children = (Array.isArray(currentComments) ? currentComments : []).filter(function(c) { return c.pid == comment.id || c.pid == comment.objectId; });
  children.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });

  var html = '<div class="post-item comment-card" style="border-left:3px solid ' + borderColor + ';' + indentStyle + '">' +
    '<div style="flex:1;min-width:0;">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="font-weight:600;font-size:0.9rem;">' + escHtml(comment.nick) + '</span>' +
        '<span style="font-size:0.72rem;padding:2px 8px;border-radius:100px;font-weight:500;background:' + (comment.status === 'waiting' ? 'rgba(245,158,11,0.1)' : comment.status === 'spam' ? 'rgba(228,30,63,0.08)' : 'rgba(0,164,0,0.08)') + ';color:' + statusColor + ';">' + statusLabel + '</span>' +
      '</div>' +
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:4px;">' + time +
        (pageUrl ? ' · <a href="' + escHtml(pageUrl) + '" target="_blank" style="color:var(--accent);">' + escHtml(pageUrl) + '</a>' : '') +
      '</div>' +
      '<div style="margin-top:8px;font-size:0.85rem;line-height:1.6;color:var(--text);word-break:break-word;">' + stripTags(comment.comment || '').substring(0, 200) + '</div>' +
    '</div>' +
    '<div class="comment-actions">' +
      (comment.status === 'waiting' ? '<button class="action-btn approve" onclick="approveComment(' + comment.id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>批准</button>' : '') +
      (comment.status !== 'spam' ? '<button class="action-btn spam" onclick="spamComment(' + comment.id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>垃圾</button>' : '') +
      '<button class="action-btn reply" onclick="replyComment(' + comment.id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,17 4,12 9,7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>回复</button>' +
      '<button class="action-btn del" onclick="deleteComment(' + comment.id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></svg>删除</button>' +
    '</div>' +
  '</div>';
  for (var i = 0; i < children.length; i++) {
    html += renderCommentCard(children[i], depth + 1);
  }
  return html;
}

function formatCommentTime(ts) {
  if (!ts) return '';
  var ms = ts;
  if (typeof ts === 'number' && ts < 1e12) ms = ts * 1000;
  return new Date(ms).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function replyComment(id) {
  var comment = (Array.isArray(currentComments) ? currentComments : []).find(function(c) { return c.id == id || c.objectId == id; });
  if (!comment) return;
  var rid = comment.rid || comment.id;
  replyTarget = { id: comment.id, rid: rid, nick: comment.nick };
  document.getElementById('replyToInfo').innerHTML = '回复 <strong>' + escHtml(comment.nick) + '</strong>：' + stripTags(comment.comment || '').substring(0, 50) + '...';
  document.getElementById('replyContent').value = '';
  document.getElementById('replyModal').classList.add('open');
}

async function submitReply() {
  if (!replyTarget) return;
  var nick = document.getElementById('replyNick').value.trim() || '平哥';
  var mail = document.getElementById('replyMail').value.trim() || 'wuliwuju@126.com';
  var link = document.getElementById('replyLink').value.trim() || 'https://www.pgoj.top';
  var content = document.getElementById('replyContent').value.trim();
  if (!content) { toast('请输入回复内容', 'error'); return; }
  // 获取被回复评论的 URL
  var parentComment = (Array.isArray(currentComments) ? currentComments : []).find(function(c) { return c.id == replyTarget.id; });
  var commentUrl = parentComment && parentComment.url ? parentComment.url : '';
  try {
    var res = await fetch(WALINE_API + '/comment', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        nick: nick,
        mail: mail,
        link: link,
        comment: content,
        url: commentUrl,
        pid: replyTarget.id,
        rid: replyTarget.rid,
        status: 'approved'
      })
    });
    if (!res.ok) {
      var err = await res.json().catch(function() { return { errno: -1 }; });
      throw new Error(err.errmsg || 'HTTP ' + res.status);
    }
    toast('回复已发送', 'success');
    closeReplyModal();
    loadComments();
  } catch (e) {
    toast('回复失败：' + e.message, 'error');
  }
}

function closeReplyModal() {
  document.getElementById('replyModal').classList.remove('open');
  replyTarget = null;
}

async function approveComment(id) {
  try {
    var res = await fetch(WALINE_API + '/comment/' + id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ status: 'approved' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var result = await res.json();
    if (result.errno !== 0) throw new Error(result.errmsg || '操作失败');
    toast('已批准', 'success');
    loadComments();
  } catch (e) {
    toast('批准失败：' + e.message, 'error');
  }
}

async function spamComment(id) {
  if (!confirm('确定标记为垃圾评论？')) return;
  try {
    var res = await fetch(WALINE_API + '/comment/' + id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ status: 'spam' })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var result = await res.json();
    if (result.errno !== 0) throw new Error(result.errmsg || '操作失败');
    toast('已标记为垃圾', 'success');
    loadComments();
  } catch (e) {
    toast('操作失败：' + e.message, 'error');
  }
}

async function deleteComment(id) {
  if (!confirm('确定删除这条评论？')) return;
  try {
    var res = await fetch(WALINE_API + '/comment/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    toast('已删除', 'success');
    loadComments();
  } catch (e) {
    toast('删除失败：' + e.message, 'error');
  }
}
