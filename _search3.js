fetch('https://unpkg.com/@waline/client@3.13.0/dist/waline.js')
  .then(r => r.text())
  .then(t => {
    // Find the WalineComment setup function - look for how comments are rendered
    var idx = t.indexOf('__name:"WalineComment"');
    // Get the setup function content
    var chunk = t.substring(idx, idx + 5000);
    console.log(chunk);
  });
