var d = require('./waline_comments.json');
d.forEach(function(c, i) {
  var str = c.insertedAt || c.createdAt || '';
  var t = new Date(str.replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) {
    console.log('NaN time at index', i, 'id:', c.id, 'insertedAt:', c.insertedAt, 'createdAt:', c.createdAt);
  }
});
console.log('done');
