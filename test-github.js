const token = 'wgp@369852';
const GITHUB_REPO = 'youquyoulai/blog';
const POSTS_DIR = 'content/posts';
const GITHUB_RAW = 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/main';

async function test() {
  console.log('测试 GitHub Token...');
  const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + POSTS_DIR, {
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'test'
    }
  });
  console.log('状态码:', res.status);
  const data = await res.json();
  if (res.status === 200) {
    console.log('成功! 文章数:', data.length);
  } else {
    console.log('错误:', data.message || JSON.stringify(data).substring(0, 200));
  }
}

test().catch(console.error);
