const res = await fetch('https://api.pgoj.top/api/images', {
  headers: { 'X-Admin-Token': 'blog2026migrate' }
});
const data = await res.json();
console.log('folders:', JSON.stringify(data.folders, null, 2));
console.log('totalFiles:', data.totalFiles);
