// 用 node 直接查 D1 数据库不太现实，这个文件只是占位
// 实际上需要通过 wrangler 执行 SQL
console.log("请手动运行: npx wrangler d1 execute twikoo --command 'SELECT DISTINCT url FROM Comment LIMIT 10;'");
