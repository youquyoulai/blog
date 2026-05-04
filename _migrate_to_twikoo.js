/**
 * Waline -> Twikoo 数据迁移脚本
 * 生成 SQL 文件，通过 wrangler d1 execute 导入
 */
const fs = require('fs');
const path = require('path');

const walineData = JSON.parse(fs.readFileSync(path.join(__dirname, 'waline_comments.json'), 'utf8'));

// Waline path -> Twikoo url 映射
// Waline path 格式: /archives/xxx.html 或 /pages/about/
// Twikoo url 格式: 和前端传的 pathname 一致
function convertPath(walinePath) {
  // 保持原样，前端会传带 .html 的路径
  return walinePath;
}

// 时间字符串 -> Unix 毫秒时间戳
function toTimestamp(str) {
  if (!str) return Date.now();
  // 已经是 ISO 格式（含 T 和 Z）: "2026-04-25T07:46:42.484Z"
  if (str.includes('T')) return new Date(str).getTime();
  // 空格分隔格式: "2026-01-26 13:35:43"
  return new Date(str.replace(' ', 'T') + 'Z').getTime();
}

// 转义 SQL 字符串
function esc(s) {
  if (s == null) return "''";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

const sqls = [];

for (const c of walineData) {
  const _id = String(c.objectId || c.id);
  const uid = '';
  const nick = c.nick || '';
  const mail = c.mail || '';
  const mailMd5 = c.mail_md5 || '';
  const link = c.link || '';
  const ua = c.userAgent || '';
  const ip = c.ip || '';
  const master = (c.type === 'administrator' || c.nick === 'pgoj') ? 1 : 0;
  const url = convertPath(c.path || '');
  const href = '';  // Twikoo 里 href 是文章完整 URL，可为空
  const comment = c.comment || '';
  const pid = c.pid ? String(c.pid) : '';
  const rid = c.rid ? String(c.rid) : '';
  const isSpam = c.isSpam ? 1 : 0;
  const created = toTimestamp(c.insertedAt || c.createdAt);
  const updated = toTimestamp(c.updatedAt || c.insertedAt || c.createdAt);
  const like = '[]';
  const top = c.sticky ? 1 : 0;
  const avatar = c.avatar || '';

  sqls.push(
    `INSERT OR IGNORE INTO comment (_id, uid, nick, mail, mailMd5, link, ua, ip, master, url, href, comment, pid, rid, isSpam, created, updated, like, top, avatar) VALUES (${esc(_id)}, ${esc(uid)}, ${esc(nick)}, ${esc(mail)}, ${esc(mailMd5)}, ${esc(link)}, ${esc(ua)}, ${esc(ip)}, ${master}, ${esc(url)}, ${esc(href)}, ${esc(comment)}, ${esc(pid)}, ${esc(rid)}, ${isSpam}, ${created}, ${updated}, ${esc(like)}, ${top}, ${esc(avatar)});`
  );
}

const sqlContent = sqls.join('\n');
fs.writeFileSync(path.join(__dirname, '_twikoo_import.sql'), sqlContent, 'utf8');

console.log(`生成 SQL: ${sqls.length} 条评论`);
console.log('文件: _twikoo_import.sql');
