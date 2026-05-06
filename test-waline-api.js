// 测试Waline API连通性
const WALINE_API = 'https://waline.pgoj.top/api';

async function testWalineAPI() {
  console.log('开始测试Waline API...');
  
  // 测试1: 检查API根路径
  try {
    const res = await fetch(WALINE_API);
    console.log('测试1 - API根路径:', res.status, await res.text().catch(() => ''));
  } catch (e) {
    console.log('测试1失败:', e.message);
  }
  
  // 测试2: 检查评论列表API（不带认证）
  try {
    const res = await fetch(`${WALINE_API}/comment?type=list&page=1&pageSize=5&status=all`);
    console.log('测试2 - 评论列表（无认证）:', res.status);
    const text = await res.text();
    console.log('响应内容（前200字符）:', text.substring(0, 200));
  } catch (e) {
    console.log('测试2失败:', e.message);
  }
  
  // 测试3: 检查评论列表API（带Token认证）
  try {
    const res = await fetch(`${WALINE_API}/comment?type=list&page=1&pageSize=5&status=all`, {
      headers: {
        'Authorization': 'Bearer wgp@369852'
      }
    });
    console.log('测试3 - 评论列表（Token认证）:', res.status);
    const text = await res.text();
    console.log('响应内容（前200字符）:', text.substring(0, 200));
  } catch (e) {
    console.log('测试3失败:', e.message);
  }
  
  // 测试4: 检查评论列表API（带Cookie认证）
  try {
    const res = await fetch(`${WALINE_API}/comment?type=list&page=1&pageSize=5&status=all`, {
      headers: {
        'Cookie': 'token=wgp@369852'
      }
    });
    console.log('测试4 - 评论列表（Cookie认证）:', res.status);
    const text = await res.text();
    console.log('响应内容（前200字符）:', text.substring(0, 200));
  } catch (e) {
    console.log('测试4失败:', e.message);
  }
  
  console.log('测试完成！');
}

testWalineAPI();
