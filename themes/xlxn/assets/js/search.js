(function() {
    var container = document.getElementById('searchResults');
    if (!container) return;
    var params = new URLSearchParams(window.location.search);
    var query = (params.get('s') || '').trim();
    if (!query) {
        container.innerHTML = '<p class="search-empty">请输入搜索关键词</p>';
        return;
    }
    fetch('/searchindex.json').then(function(r) { return r.json(); }).then(function(data) {
        var q = query.toLowerCase();
        var results = data.filter(function(item) {
            var text = (item.title + ' ' + item.summary + ' ' + (item.tags || []).join(' ') + ' ' + (item.categories || []).join(' ')).toLowerCase();
            return text.indexOf(q) !== -1;
        });
        if (results.length === 0) {
            container.innerHTML = '<p class="search-empty">' + escapeHtml('未找到与 "' + query + '" 相关的结果') + '</p>';
            return;
        }
        var html = '<p class="search-count">找到 ' + results.length + ' 条结果</p>';
        results.forEach(function(item) {
            var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var title = item.title.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark>$1</mark>');
            var summary = (item.summary || '').replace(/<[^>]*>/g, '').substring(0, 150);
            html += '<article class="search-result-item">';
            html += '<a href="' + escapeHtml(item.url) + '" class="search-result-link"><h3>' + title + '</h3></a>';
            html += '<div class="search-result-meta">' + escapeHtml(item.date) + ' · ' + escapeHtml((item.categories || []).join(', ')) + '</div>';
            html += '<p class="search-result-summary">' + escapeHtml(summary) + '...</p>';
            html += '</article>';
        });
        container.innerHTML = html;
    }).catch(function() {
        container.innerHTML = '<p class="search-empty">搜索索引加载失败，请稍后重试</p>';
    });

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
})();
