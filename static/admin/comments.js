// ══════════════════════════════════════════════════════════
// 评论管理功能
// ══════════════════════════════════════════════════════════

let currentCommentPage = 1;
// 注意：COMMENT_PAGE_SIZE 已在 index.html 中声明，此处不再重复

// 加载评论列表
async function loadComments(page = 1) {
  const el = document.getElementById('commentList');
  const status = document.getElementById('commentStatus').value;
  currentCommentPage = page;

  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';

  try {
    const data = await api('/api/comments?status=' + status + '&page=' + page + '&pageSize=' + COMMENT_PAGE_SIZE);

    // 更新统计数据
    if (data.stats) {
      renderCommentStats(data.stats);
    }

    // 渲染评论列表
    renderComments(data.comments || []);

    // 渲染分页
    renderCommentPagination(data.total || 0, page, data.pageSize || COMMENT_PAGE_SIZE);
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><p>加载失败: ' + e.message + '</p></div>';
  }
}

// 渲染评论统计
function renderCommentStats(stats) {
  const el = document.getElementById('commentStats');
  if (!stats) return;

  el.innerHTML = '<span>📊 全部: <strong>' + (stats.all || 0) + '</strong></span>' +
    ' <span>✅ 已通过: <strong>' + (stats.approved || 0) + '</strong></span>' +
    ' <span>⏳ 待审核: <strong style="color:#f59e0b;">' + (stats.waiting || 0) + '</strong></span>' +
    ' <span>🚫 垃圾: <strong style="color:var(--red);">' + (stats.spam || 0) + '</strong></span>';
}

// 渲染评论列表
function renderComments(comments) {
  const el = document.getElementById('commentList');

  if (!comments || comments.length === 0) {
    el.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><p>暂无评论</p></div>';
    return;
  }

  let html = '<div class="comment-list">';

  for (let i = 0; i < comments.length; i++) {
    const c = comments[i];
    const id = c.id || c.objectId || c._id || '';
    const nick = escapeHtml(c.nick || c.author || '匿名');
    const avatar = c.avatar || '';
    const link = c.link ? ' <a href="' + c.link + '" target="_blank" style="font-size:0.75rem;color:var(--accent2);">主页</a>' : '';
    const time = formatTime(c.time || c.createdAt || c.insertedAt);
    const status = (c.status || 'approved').toLowerCase();
    const commentBody = escapeHtml(c.comment || c.content || '');
    const pageUrl = c.url || c.page || '';

    let actions = '';
    if (status === 'waiting') {
      actions += '<button class="btn btn-sm btn-success" onclick="approveComment(\'' + id + '\')">✅ 通过</button> ';
    }
    if (status !== 'spam') {
      actions += '<button class="btn btn-sm" onclick="markSpam(\'' + id + '\')">🚫 垃圾</button> ';
    }
    actions += '<button class="btn btn-sm btn-danger" onclick="deleteComment(\'' + id + '\')">🗑️ 删除</button>';

    html += '<div class="comment-item" style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<img src="' + avatar + '" alt="" style="width:32px;height:32px;border-radius:50%;" onerror="this.style.display=\'none\'">' +
        '<strong>' + nick + '</strong>' + link +
        '<span style="margin-left:auto;font-size:0.75rem;color:var(--muted);">' + time + '</span>' +
      '</div>' +
      '<div style="font-size:0.9rem;margin-bottom:8px;">' + commentBody + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem;">' +
        '<span style="color:var(--muted);">📄 ' + pageUrl + '</span>' +
        '<div>' + actions + '</div>' +
      '</div>' +
    '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

// 渲染分页
function renderCommentPagination(total, page, pageSize) {
  const el = document.getElementById('commentPagination');
  if (!el) return;

  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }

  let html = '';

  if (page > 1) {
    html += '<button class="btn btn-sm" onclick="loadComments(' + (page - 1) + ')">← 上一页</button> ';
  }

  html += '<span style="font-size:0.85rem;color:var(--muted);padding:0 8px;">第 ' + page + ' / ' + totalPages + ' 页</span>';

  if (page < totalPages) {
    html += ' <button class="btn btn-sm" onclick="loadComments(' + (page + 1) + ')">下一页 →</button>';
  }

  el.innerHTML = html;
}

// 审核通过评论
async function approveComment(id) {
  if (!confirm('确定通过这条评论？')) return;
  try {
    await api('/api/comments/approve', 'POST', { id: id });
    showToast('已通过', 'success');
    loadComments(currentCommentPage);
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error');
  }
}

// 删除评论
async function deleteComment(id) {
  if (!confirm('确定删除这条评论？')) return;
  try {
    await api('/api/comments/delete', 'POST', { id: id, spam: false });
    showToast('已删除', 'success');
    loadComments(currentCommentPage);
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error');
  }
}

// 标记为垃圾评论
async function markSpam(id) {
  if (!confirm('标记为垃圾评论？')) return;
  try {
    await api('/api/comments/delete', 'POST', { id: id, spam: true });
    showToast('已标记为垃圾', 'success');
    loadComments(currentCommentPage);
  } catch (e) {
    showToast('操作失败: ' + e.message, 'error');
  }
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// HTML转义
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

// 显示提示消息
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast toast-' + type;
  toast.style.display = 'block';
  setTimeout(function() {
    toast.style.display = 'none';
  }, 3000);
}

// 在Tab切换时加载评论
document.addEventListener('DOMContentLoaded', function() {
  // 监听标签切换，如果是评论标签则加载评论
  const commentTab = document.querySelector('[data-tab="comments"]');
  if (commentTab) {
    commentTab.addEventListener('click', function() {
      loadComments(1);
    });
  }
});
