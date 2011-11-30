var _ = require('underscore'),
    uglify = require('uglify-js');

function liveCssClientCode() {
    function startListening() {
        function findCssIncludes() {
            var cssIncludes = [],
                links = document.getElementsByTagName('link'),
                i;
            for (i = 0 ; i < links.length ; i += 1) {
                if (/\bstylesheet\b/i.test(links[i].getAttribute('rel'))) {
                    cssIncludes.push({type: 'link', href: links[i].getAttribute('href'), node: links[i]});
                }
            }
            for (i = 0 ; i < document.styleSheets.length ; i += 1) {
                var styleSheet = document.styleSheets[i];
                for (var j = 0 ; j < styleSheet.cssRules.length ; j += 1) {
                    var cssRule = styleSheet.cssRules[j];
                    if (cssRule.type === 3) { // CSSImportRule
                        cssIncludes.push({type: 'import', href: cssRule.href, node: cssRule, styleElement: styleSheet.ownerNode});
                    }
                }
            }
            return cssIncludes;
        }

        var socket = io.connect('http://localhost', {reconnect: true});
        socket.on('connect', function () {
            var cssIncludes = findCssIncludes(),
                hrefs = [];
            for (var i = 0 ; i < cssIncludes.length ; i += 1) {
                hrefs.push(cssIncludes[i].href);
            }
            socket.emit('watch', hrefs, location.href);
        }).on('change', function (href) {
            var cssIncludes = findCssIncludes();
            for (var i = 0 ; i < cssIncludes.length ; i += 1) {
                var cssInclude = cssIncludes[i],
                    cssIncludeHrefWithoutBuster = cssInclude.href.replace(/[?&]livecssbuster=\d+/, '');
                if (cssIncludeHrefWithoutBuster === href) {
                    var newHref = cssIncludeHrefWithoutBuster + (cssIncludeHrefWithoutBuster.indexOf('?') === -1 ? '?' : '&') + 'livecssbuster=' + new Date().getTime();
                    if (cssInclude.type === 'import') {
                        var replacerRegExp = new RegExp("@import\\s+url\\(" + cssInclude.href.replace(/[\?\[\]\(\)\{\}]/g, "\\$&") + "\\)");
                        cssInclude.styleElement.innerHTML = cssInclude.styleElement.innerHTML.replace(replacerRegExp, '@import url(' + newHref + ')');
                    } else {
                        cssInclude.node.setAttribute('href', newHref);
                    }
                    // Replacing the first occurrence should be good enough. Besides, the @import replacement code invalidates
                    // the rest of the cssIncludes in the same stylesheet.
                    break;
                }
            }
        });
    };
    if (!('io' in window)) {
        var socketIoScriptElement = document.createElement('script');
        socketIoScriptElement.onload = startListening;
        socketIoScriptElement.setAttribute('src', '/socket.io/socket.io.js');
        document.head.appendChild(socketIoScriptElement);
    } else {
        startListening();
    }
}

module.exports = function (queryObj) {
    return function addLiveCssToOneBootstrapper(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (htmlAsset) {
            assetGraph.findRelations({type: 'HtmlScript', from: htmlAsset, node: {id: 'oneBootstrapper'}}).forEach(function (htmlScript) {
                var topLevelStatements = htmlScript.to.parseTree[1];
                for (var i = 0 ; i < topLevelStatements.length ; i += 1) {
                    var statement = topLevelStatements[i];
                    if (statement[0] === 'stat' && statement[1][0] === 'call' && statement[1][1][0] === 'function' && statement[1][1][1] === 'installOneDevelopmentMode') {
                        Array.prototype.push.apply(statement[1][1][3], uglify.parser.parse("(" + liveCssClientCode.toString() + ")")[1][0][1][3]);
                    }
                }
            });
        });
    };
};
