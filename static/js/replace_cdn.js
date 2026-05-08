const fs = require('fs');
const path = require('path');

// 替换 waline.js
const jsPath = 'E:/blog/static/js/waline/waline.js';
let jsData = fs.readFileSync(jsPath, 'utf8');
const jsCount = (jsData.match(/unpkg\.com\/@waline/g) || []).length;
if (jsCount > 0) {
    jsData = jsData.replace(/unpkg\.com\/@waline/g, 'cdn.jsdelivr.net/npm/@waline');
    fs.writeFileSync(jsPath, jsData, 'utf8');
    console.log(`waline.js: replaced ${jsCount} occurrences`);
} else {
    console.log('waline.js: no unpkg.com found');
}

// 替换 waline.css
const cssPath = 'E:/blog/static/js/waline/waline.css';
if (fs.existsSync(cssPath)) {
    let cssData = fs.readFileSync(cssPath, 'utf8');
    const cssCount = (cssData.match(/unpkg\.com/g) || []).length;
    if (cssCount > 0) {
        cssData = cssData.replace(/unpkg\.com/g, 'cdn.jsdelivr.net/npm');
        fs.writeFileSync(cssPath, cssData, 'utf8');
        console.log(`waline.css: replaced ${cssCount} occurrences`);
    } else {
        console.log('waline.css: no unpkg.com found');
    }
} else {
    console.log('waline.css: file not found');
}
