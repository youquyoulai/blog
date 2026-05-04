// 拉取所有 Waline 评论数据（分批）
const fs = require('fs');

async function main() {
  let allComments = [];
  let seenIds = new Set();
  let batch = 1;
  
  // 用 recent 接口，每次最多 100 条
  // 通过 sortBy 参数尝试获取不同排序
  const sortOptions = [
    'insertedAt_desc',
    'insertedAt_asc',
  ];
  
  for (const sortBy of sortOptions) {
    const url = `https://waline.pgoj.top/api/comment?type=recent&count=100&sortBy=${sortBy}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.data) {
      for (const c of json.data) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allComments.push(c);
        }
      }
    }
  }
  
  console.log(`Total unique comments: ${allComments.length}`);
  
  // 收集所有 path
  const paths = new Set(allComments.map(c => c.path));
  console.log(`Unique paths: ${paths.size}`);
  
  // 遍历每个 path 拉取完整评论（按 path 查询支持分页）
  let extraCount = 0;
  for (const path of paths) {
    let page = 1;
    while (true) {
      const url = `https://waline.pgoj.top/api/comment?path=${encodeURIComponent(path)}&pageSize=50&page=${page}`;
      const resp = await fetch(url);
      const json = await resp.json();
      const pageData = json.data;
      if (!pageData || !pageData.data || pageData.data.length === 0) break;
      
      for (const c of pageData.data) {
        if (!seenIds.has(c.id)) {
          seenIds.add(c.id);
          allComments.push(c);
          extraCount++;
        }
      }
      
      if (page >= pageData.totalPages) break;
      page++;
    }
  }
  
  console.log(`After path traversal: ${allComments.length} (found ${extraCount} extra)`);
  
  // 按 id 排序
  allComments.sort((a, b) => a.id - b.id);
  
  // 保存
  fs.writeFileSync('e:/blog/waline_comments.json', JSON.stringify(allComments, null, 2));
  console.log(`Saved to waline_comments.json`);
  console.log(`ID range: ${allComments[0]?.id} - ${allComments[allComments.length-1]?.id}`);
  
  // 统计
  const withPid = allComments.filter(c => c.pid).length;
  const paths2 = new Set(allComments.map(c => c.path));
  console.log(`Replies (with pid): ${withPid}`);
  console.log(`Article paths: ${paths2.size}`);
}

main().catch(console.error);
