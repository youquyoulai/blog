fetch('https://twikoo.pgoj.top/', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    event: 'GET_COMMENTS',
    path: '/archives/teachers-no-insulting-words-or-behaviors.html',
    pageSize: 10,
    page: 1,
    includeReply: true
  })
}).then(r => r.json()).then(d => {
  console.log('=== with .html ===');
  console.log('code:', d.code);
  console.log('count:', d.count);
  console.log('data:', JSON.stringify(d.data || d, null, 2));
}).then(() => {
  return fetch('https://twikoo.pgoj.top/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      event: 'GET_COMMENTS',
      path: '/archives/teachers-no-insulting-words-or-behaviors',
      pageSize: 10,
      page: 1,
      includeReply: true
    })
  }).then(r => r.json());
}).then(d => {
  console.log('=== without .html ===');
  console.log('code:', d.code);
  console.log('count:', d.count);
  console.log('data:', JSON.stringify(d.data || d, null, 2));
});
