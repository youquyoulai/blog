// 集成修复后的Waline API代理到worker.js
const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, 'worker.js');
const fixPath = path.join(__dirname, 'worker-waline-fix.js');

// 读取原worker.js
let workerContent = fs.readFileSync(workerPath, 'utf8');

// 读取修复后的Waline API代理代码
const fixContent = fs.readFileSync(fixPath, 'utf8');

// 替换Waline API代理部分
// 找到开始标记
const startMarker = '// ══════════════════════════════════════════════════════════════\n// Waline 评论管理 API 代理';
const endMarker = '// ══════════════════════════════════════════════════════════════\n';

const startIndex = workerContent.indexOf(startMarker);
if (startIndex === -1) {
  console.error('找不到Waline API代理开始标记');
  process.exit(1);
}

// 找到结束标记（下一个║════开头的行）
const afterStart = workerContent.substring(startIndex + startMarker.length);
const endIndex = afterStart.indexOf('// ══════════════════════════════════════════════════════════════\n');

if (endIndex === -1) {
  console.error('找不到Waline API代理结束标记');
  process.exit(1);
}

const fullEndIndex = startIndex + startMarker.length + endIndex;

// 替换
const newContent = workerContent.substring(0, startIndex) +
                  startMarker + '\n' +
                  fixContent + '\n' +
                  workerContent.substring(fullEndIndex);

// 写入新文件
const newWorkerPath = path.join(__dirname, 'worker-waline-integrated.js');
fs.writeFileSync(newWorkerPath, newContent, 'utf8');

console.log('集成完成！新文件:', newWorkerPath);
console.log('请检查', newWorkerPath, '然后替换原worker.js');
