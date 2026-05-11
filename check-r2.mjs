import https from 'node:https';

const url = new URL('https://api.pgoj.top/api/images');
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'GET',
  headers: { 'X-Admin-Token': 'blog2026migrate' }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log('folders:', JSON.stringify(parsed.folders, null, 2));
    console.log('totalFiles:', parsed.totalFiles);
    console.log('objects count:', (parsed.objects || []).length);
    if (parsed.objects) parsed.objects.forEach(o => console.log('  obj:', o.key));
  });
});
req.end();
