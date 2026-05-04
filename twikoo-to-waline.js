/**
 * Twikoo D1 数据导出 + 转 Waline JSON
 *
 * 用法（在 twikoo-cloudflare 目录下执行）：
 *   node ../twikoo-to-waline.js
 *
 * 输出：twikoo-comments.json（Waline 导入格式）
 */

const { execSync } = require('child_process');

// 1. 从 D1 导出 Twikoo 评论
console.log('正在从 D1 导出 Twikoo 评论...');

let rawData;
try {
  const result = execSync(
    'npx wrangler d1 execute twikoo --command "SELECT * FROM Comment ORDER BY created ASC;" --json',
    { encoding: 'utf8', cwd: 'E:\\blog\\twikoo-cloudflare', shell: 'cmd.exe' }
  );
  rawData = result;
} catch (e) {
  console.error('导出失败，尝试直接读取...');
  // 如果上面的方式失败，改用 .cmd 脚本
  try {
    const result2 = execSync(
      'cmd /c "cd /d E:\\blog\\twikoo-cloudflare && npx wrangler d1 execute twikoo --command \"SELECT * FROM Comment ORDER BY created ASC;\" --json"',
      { encoding: 'utf8', shell: 'cmd.exe' }
    );
    rawData = result2;
  } catch (e2) {
    console.error('导出失败，请手动执行：');
    console.error('  cd E:\\blog\\twikoo-cloudflare');
    console.error('  npx wrangler d1 execute twikoo --command "SELECT * FROM Comment ORDER BY created ASC;" --json > twikoo-export.json');
    process.exit(1);
  }
}

console.log('导出完成，正在解析...');
console.log(rawData.substring(0, 500));
