const fs = require('fs');
const h = fs.readFileSync('public/search/index.html', 'utf8');
const scripts = h.match(/<script[^>]*>/g).filter(s => s.includes('src=') && !s.includes('type='));
console.log('Scripts with src:');
scripts.forEach(s => console.log(' ', s));
