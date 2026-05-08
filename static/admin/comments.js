/* ===== 评论管理 ===== */
var WALINE_API = 'https://waline.pgoj.top';
var currentComments = [];
var replyTarget = null;

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

async function loadComments() {
  var el = document.getElementById('commentList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  try {
    var filter = document.getElementById('commentFilter').value;
    var url = WALINE_API + '/comment?type=list';
    if (filter) url += '&status=' + filter;
    var res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    // Waline API 返回: { errno:0, data: { data: [...], total, page, ... } }
    var raw = data && data.data;
    if (raw && Array.isArray(raw.data)) {
      currentComments = raw.data;
    } else if (Array.isArray(raw)) {
      currentComments = raw;
    } else {
      currentComments = [];
    }
    // 统一字段: id 兼容 objectId
    currentComments = currentComments.map(function(c) {
      if (!c.id && c.objectId) c.id = c.objectId;
      return c;
    });
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
  el.innerHTML = html;
}

function renderCommentCard(comment, depth) {
  var borderColor = depth > 0 ? 'var(--accent)' : 'transparent';
  var indentStyle = depth > 0 ? 'margin-left:' + (depth * 20) + 'px;' : '';
  var statusColor = comment.status === 'waiting' ? 'var(--orange)' : 'var(--green)';
  var time = formatCommentTime(comment.time);
  var pageUrl = comment.url || '';
  var children = (Array.isArray(currentComments) ? currentComments : []).filter(function(c) { return c.pid == comment.id || c.pid == comment.objectId; });
  children.sort(function(a, b) { return (a.time || 0) - (b.time || 0); });

  var html = '<div class="post-item comment-card" style="border-left:3px solid ' + borderColor + ';' + indentStyle + '">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:500;font-size:0.9rem;">' + escHtml(comment.nick) +
          ' <span style="font-size:0.75rem;color:' + statusColor + ';">● ' + (comment.status || 'approved') + '</span>' +
        '</div>' +
        '<div style="font-size:0.8rem;color:var(--muted);margin-top:4px;">' + time +
          (pageUrl ? ' · <a href="' + escHtml(pageUrl) + '" target="_blank" style="color:var(--accent2);">' + escHtml(pageUrl) + '</a>' : '') +
        '</div>' +
        '<div style="margin-top:8px;font-size:0.85rem;line-height:1.6;color:var(--text);word-break:break-word;">' + stripTags(comment.comment || '').substring(0, 200) + '</div>' +
      '</div>' +
      '<div style="display:flex;gap:4px;flex-shrink:0;flex-direction:column;align-items:flex-end;">' +
        (comment.status === 'waiting' ? '<button class="btn btn-sm" onclick="approveComment(' + comment.id + ')" style="color:var(--green);border-color:var(--green);font-size:0.75rem;padding:4px 8px;">批准</button>' : '') +
        '<button class="btn btn-sm" onclick="replyComment(' + comment.id + ')" style="color:var(--accent);border-color:var(--accent);font-size:0.75rem;padding:4px 8px;">回复</button>' +
        '<button class="btn btn-sm btn-danger" onclick="deleteComment(' + comment.id + ')" style="font-size:0.75rem;padding:4px 8px;">删除</button>' +
      '</div>' +
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
  var mail = document.getElementById('replyMail').value.trim() || 'admin@pgoj.top';
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
  toast('approve 功能开发中', 'error');
}

async function deleteComment(id) {
  toast('delete 功能开发中', 'error');
}
