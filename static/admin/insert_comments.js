const fs = require('fs');
const path = 'e:\\blog\\static\\admin\\index.html';
let content = fs.readFileSync(path, 'utf8');

const insertCode = `
// ═════════════
// 评论管理
// ═════════════
let currentComments = [];
let commentPage = 1;

async function loadComments() {
  const el = document.getElementById('commentList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  const status = document.getElementById('commentStatus').value;
  commentPage = 1;
  try {
    const data = await api('/api/comments?status=' + status + '&page=1&pageSize=20');
    currentComments = data.comments || [];
    renderComments();
    if (data.stats) {
      document.getElementById('commentStats').innerHTML =
        '<span>全部: ' + (data.stats.all||0) + '</span>' +
        '<span style="color:var(--orange);"> 待审核: ' + (data.stats.waiting||0) + '</span>' +
        '<span style="color:var(--green);"> 已通过: ' + (data.stats.approved||0) + '</span>' +
        '<span style="color:var(--red);"> 垃圾: ' + (data.stats.spam||0) + '</span>';
    }
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p>加载失败: ' + e.message + '</p></div>';
  }
}

function renderComments() {
  const el = document.getElementById('commentList');
  if (currentComments.length === 0) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>暂无评论</p></div>';
    return;
  }
  let html = '<div style="display:flex;flex-direction:column;gap:10px;">';
  for (let i = 0; i < currentComments.length; i++) {
    const c = currentComments[i];
    const isPending = c.isApproved === false && !c.isSpam;
    const isSpam = c.isSpam;
    const nick = escHtml(c.nick || c.author || '匿名');
    const mail = c.mail ? '<span style="font-size:0.75rem;color:var(--muted);">' + escHtml(c.mail) + '</span>' : '';
    const time = formatTime(c.created || c.time || c.date);
    const commentText = formatComment(escHtml(c.comment || c.content || ''));
    const linkHtml = c.link ? '<div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">来源: <a href="' + escHtml(c.link) + '" target="_blank">' + escHtml(c.link) + '</a></div>' : '';
    const pendingBadge = isPending ? '<span style="font-size:0.7rem;background:rgba(244,114,182,0.15);color:var(--orange);padding:1px 6px;border-radius:4px;">待审核</span>' : '';
    const spamBadge = isSpam ? '<span style="font-size:0.7rem;background:rgba(220,38,38,0.15);color:var(--red);padding:1px 6px;border-radius:4px;">垃圾</span>' : '';
    const approveBtn = isPending ? '<button class="btn btn-sm" style="color:var(--green);border-color:var(--green);" onclick="approveComment(' + i + ')">✅ 通过</button>' : '';
    html += '<div class="comment-card" style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;' + (isSpam?'opacity:0.6;':'') + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">' +
            '<strong style="font-size:0.9rem;">' + nick + '</strong>' + mail +
            '<span style="font-size:0.75rem;color:var(--muted);">' + time + '</span>' +
            spamBadge + pendingBadge +
          '</div>' +
          '<div style="font-size:0.85rem;line-height:1.6;word-break:break-word;">' + commentText + '</div>' +
          linkHtml +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">' +
          approveBtn +
          '<button class="btn btn-sm" style="color:var(--orange);border-color:var(--orange);" onclick="markSpam(' + i + ')">🚫 垃圾</button>' +
          '<button class="btn btn-sm btn-danger" onclick="deleteComment(' + i + ')">🗑️ 删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}

function formatComment(text) {
  return text.replace(/\\n/g, '<br>');
}

async function approveComment(index) {
  const c = currentComments[index];
  if (!c) return;
  try {
    await api('/api/comments/approve', 'POST', { id: c._id || c.id });
    toast('已通过', 'success');
    loadComments();
  } catch (e) { toast('操作失败: ' + e.message, 'error'); }
}

async function markSpam(index) {
  const c = currentComments[index];
  if (!c) return;
  try {
    await api('/api/comments/spam', 'POST', { id: c._id || c.id });
    toast('已标记垃圾', 'success');
    loadComments();
  } catch (e) { toast('操作失败: ' + e.message, 'error'); }
}

async function deleteComment(index) {
  const c = currentComments[index];
  if (!c) return;
  if (!confirm('确定删除这条评论？')) return;
  try {
    await api('/api/comments/delete', 'POST', { id: c._id || c.id });
    toast('已删除', 'success');
    loadComments();
  } catch (e) { toast('删除失败: ' + e.message, 'error'); }
}
`;

// 在 <script> 后插入
const anchor = '<script>\n// ═════════════════════════════════════════════════════════════\n// 配置';
if (!content.includes(anchor)) {
  console.log('ERROR: anchor not found, trying alternative...');
  // 尝试另一种匹配
  const altAnchor = '<script>\n';
  const pos = content.indexOf(altAnchor);
  if (pos === -1) { console.log('ERROR: <script> not found'); process.exit(1); }
  content = content.slice(0, pos + altAnchor.length) + insertCode + '\n' + content.slice(pos + altAnchor.length);
} else {
  content = content.replace(anchor, '<script>\n' + insertCode + '\n// ═════════════════════════════════════════════════════════════\n// 配置');
}
fs.writeFileSync(path, content, 'utf8');
console.log('OK: comments JS inserted');
