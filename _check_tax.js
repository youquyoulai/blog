const fs = require('fs');
const content = fs.readFileSync('./public/taxonomies.json', 'utf8');
const d = JSON.parse(content);
console.log('totalPosts:', d.totalPosts);
console.log('categories:', d.categories ? d.categories.length : 'undefined');
console.log('tags:', d.tags ? d.tags.length : 'undefined');
console.log('First 3 cats:', d.categories ? d.categories.slice(0,3) : 'undefined');
console.log('First 3 tags:', d.tags ? d.tags.slice(0,3) : 'undefined');