fetch('https://unpkg.com/@waline/client@3.13.0/dist/waline.js')
  .then(r => r.text())
  .then(t => {
    // Search for CommentList or comment list rendering logic
    var patterns = [
      /__name:"CommentList"/g,
      /__name:"WalineComment"/g,
      /wl-reverse/g,
      /wl-card-item/g,
    ];
    patterns.forEach(function(re) {
      var m;
      var count = 0;
      while ((m = re.exec(t)) !== null) {
        console.log('=== Match at ' + m.index + ' ===');
        console.log(t.substring(m.index, m.index + 500));
        console.log('...');
        count++;
        if (count >= 3) break;
      }
    });
  });
