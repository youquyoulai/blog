const fs = require('fs');
const h = fs.readFileSync('public/search/index.html', 'utf8');
const scripts = h.match(/<script[^>]*>/g);
const debug = h.match(/search-layout[^<]*/);
const body = h.match(/body[^>]*>/);
console.log('Body:', body ? body[0] : '?');
console.log('Scripts:', scripts ? scripts.join('\n') : 'none');
console.log('Debug:', debug ? debug[0] : '无');
