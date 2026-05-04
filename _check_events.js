fetch('https://twikoo.pgoj.top/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'GET_COMMENTS',path:'/archives/wodejicidakaonan.html',pageSize:10,page:1})}).then(r=>r.json()).then(d=>{
  console.log('code:', d.code || 'none');
  console.log('count:', d.count);
  if(d.data) console.log('comments:', d.data.length);
  if(d.message) console.log('msg:', d.message);
});
